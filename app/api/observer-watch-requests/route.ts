import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildMockWatchEventPayload, schedulePreset } from "@/lib/domain/observer-watch-request-engine";

const watchTypes = ["movement_in_area", "no_movement", "door_left_open", "person_near_object", "restricted_area_entry", "after_hours_activity", "camera_obstruction", "custom_text_instruction"] as const;

const createSchema = z.object({
  action: z.literal("create"),
  observer_site_id: z.string().uuid().optional().nullable(),
  kindergarten_id: z.string().uuid().optional().nullable(),
  camera_id: z.string().uuid().optional().nullable(),
  zone_id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(2),
  description: z.string().trim().optional().nullable(),
  watch_type: z.enum(watchTypes),
  priority: z.coerce.number().int().min(1).max(10).default(5),
  schedule_mode: z.string().default("always_active"),
  schedule: z.record(z.string(), z.unknown()).optional(),
  notification_channels: z.array(z.string()).default(["in_app"])
});

const idSchema = z.object({
  action: z.enum(["disable", "trigger_mock"]),
  id: z.string().uuid()
});

const payloadSchema = z.discriminatedUnion("action", [createSchema, idSchema]);

async function canAccessRequest(supabase: any, profile: any, request: any) {
  if (profile.role === "admin") return true;
  if ((profile.role === "manager" || profile.role === "owner") && request.kindergarten_id && request.kindergarten_id === profile.garden_id) return true;
  if (request.observer_site_id) {
    const { data } = await supabase
      .from("observer_site_memberships" as any)
      .select("id")
      .eq("observer_site_id", request.observer_site_id)
      .eq("profile_id", profile.id)
      .eq("active", true)
      .in("member_role", ["owner", "admin", "operator"])
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  }
  return false;
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin", "manager", "owner", "network_manager"]);
    const payload = payloadSchema.parse(await request.json());
    const supabase = await createClient();

    if (payload.action === "create") {
      const kindergartenId = profile.role === "admin" ? payload.kindergarten_id ?? null : profile.garden_id;
      if (!kindergartenId && !payload.observer_site_id) return fail("יש לבחור גן או אתר Digital Observer.", 422);
      if (payload.observer_site_id) return fail("כלל Digital Observer אמיתי חייב לעבור מהדר מובנה, validation ואישור משתמש. מסלול זה נשאר לכלי Legacy/Test של גנים בלבד.", 409);
      if (profile.role !== "admin" && payload.kindergarten_id && payload.kindergarten_id !== profile.garden_id) {
        return fail("אין הרשאה ליצור בקשת מעקב לגן אחר.", 403);
      }
      const row = {
        observer_site_id: payload.observer_site_id ?? null,
        kindergarten_id: kindergartenId,
        camera_id: payload.camera_id ?? null,
        zone_id: payload.zone_id ?? null,
        created_by: profile.id,
        title: payload.title,
        description: payload.description,
        watch_type: payload.watch_type,
        active: true,
        priority: payload.priority,
        schedule: payload.schedule ?? schedulePreset(payload.schedule_mode),
        notification_channels: payload.notification_channels,
        requires_human_review: true,
        metadata: { mock_ready: true, no_real_ai_execution: true, parent_visible: false }
      };
      const { data, error } = await supabase.from("observer_watch_requests" as any).insert(row).select("*").single();
      if (error || !data) {
        console.error("[observer-watch-create]", error);
        return fail("לא ניתן ליצור בקשת מעקב כרגע.", 500);
      }
      return ok({ request: data });
    }

    const existing = await supabase.from("observer_watch_requests" as any).select("*").eq("id", payload.id).single();
    if (existing.error || !existing.data) return fail("בקשת המעקב לא נמצאה.", 404);
    const allowed = await canAccessRequest(supabase, profile, existing.data);
    if (!allowed) return fail("אין הרשאה לעדכן את בקשת המעקב הזו.", 403);

    if (payload.action === "disable") {
      const { data, error } = await supabase
        .from("observer_watch_requests" as any)
        .update({ active: false, updated_at: new Date().toISOString(), metadata: { ...(existing.data.metadata ?? {}), disabled_by: profile.id } })
        .eq("id", payload.id)
        .select("*")
        .single();
      if (error || !data) return fail("לא ניתן להשבית את בקשת המעקב.", 500);
      return ok({ request: data });
    }

    // A real Digital Observer site receives camera truth only through its
    // authenticated Gateway/Journal path. Mock requests remain a
    // kindergarten/test utility and cannot create a competing site event.
    if (existing.data.observer_site_id) return fail("אירועי הדמיה אינם זמינים באתר ניטור אמיתי.", 409);
    const eventPayload = buildMockWatchEventPayload(existing.data, {
      kindergartenId: existing.data.kindergarten_id,
      observerSiteId: existing.data.observer_site_id,
      cameraId: existing.data.camera_id,
      zoneId: existing.data.zone_id
    });
    const { data: event, error } = await supabase.from("ai_camera_events" as any).insert(eventPayload).select("*").single();
    if (error || !event) {
      console.error("[observer-watch-trigger-mock]", error);
      return fail("לא ניתן ליצור אירוע mock לבקשת המעקב.", 500);
    }
    return ok({ event });
  } catch (error) {
    return handleRouteError(error);
  }
}
