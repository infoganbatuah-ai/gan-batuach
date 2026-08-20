import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";

const watchTypes = ["movement_in_area", "no_movement", "door_left_open", "person_near_object", "restricted_area_entry", "after_hours_activity", "camera_obstruction", "custom_text_instruction"] as const;

const createSchema = z.object({
  action: z.literal("create"),
  observer_site_id: z.string().uuid(),
  camera_source_id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(1500).optional().nullable(),
  watch_type: z.enum(watchTypes),
  priority: z.coerce.number().int().min(1).max(10).default(5),
  schedule_mode: z.enum(["always_active", "business_hours", "night_only"]).default("always_active")
});

const updateSchema = z.object({ action: z.literal("disable"), id: z.string().uuid() });
const schema = z.discriminatedUnion("action", [createSchema, updateSchema]);

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const { profile, supabase: sessionSupabase } = session;
    const supabase = sessionSupabase as any;
    const payload = schema.parse(await request.json());

    if (payload.action === "create") {
      const site = await getObserverSiteAccess(supabase, profile, payload.observer_site_id, { manage: true });
      if (!site) return fail("אין הרשאה ליצור בקשת ניטור באתר הזה.", 403);
      if (payload.camera_source_id) {
        const camera = await supabase.from("digital_observer_camera_sources" as any)
          .select("id")
          .eq("id", payload.camera_source_id)
          .eq("observer_site_id", payload.observer_site_id)
          .maybeSingle();
        if (!camera.data) return fail("המצלמה שנבחרה אינה שייכת לאתר.", 422);
      }
      const { data, error } = await supabase.from("observer_watch_requests" as any).insert({
        observer_site_id: payload.observer_site_id,
        kindergarten_id: null,
        camera_source_id: payload.camera_source_id ?? null,
        camera_id: null,
        created_by: profile.id,
        title: payload.title,
        description: payload.description || null,
        watch_type: payload.watch_type,
        active: true,
        priority: payload.priority,
        schedule: { mode: payload.schedule_mode },
        notification_channels: ["in_app"],
        requires_human_review: true,
        metadata: { product: "digital_observer", execution_state: "provider_readiness", no_automatic_accusation: true }
      }).select("id,title,description,watch_type,priority,active,created_at").single();
      if (error || !data) return fail("לא ניתן לשמור את בקשת הניטור.", 400);
      return ok({ request: data, message: "הבקשה נשמרה. היא תופעל מול וידאו רק לאחר חיבור Gateway ו-AI מאושרים." }, 201);
    }

    const existing = await supabase.from("observer_watch_requests" as any)
      .select("id,observer_site_id")
      .eq("id", payload.id)
      .maybeSingle();
    if (!existing.data?.observer_site_id) return fail("בקשת הניטור לא נמצאה.", 404);
    const site = await getObserverSiteAccess(supabase, profile, existing.data.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לעדכן את בקשת הניטור.", 403);
    const result = await supabase.from("observer_watch_requests" as any)
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", payload.id)
      .select("id,active")
      .single();
    if (result.error) return fail("לא ניתן להשבית את בקשת הניטור.", 400);
    return ok({ request: result.data, message: "בקשת הניטור הושבתה." });
  } catch (error) {
    return handleRouteError(error);
  }
}
