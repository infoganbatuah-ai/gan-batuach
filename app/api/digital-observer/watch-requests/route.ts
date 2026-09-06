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
      return fail("כלל Production חדש דורש תרגום מובנה, תצוגה מקדימה ואישור מפורש. יש להשתמש במהדר הכללים בשפה טבעית.", 409, {
        compiler_route: "/api/digital-observer/watch-rules",
        confirmation_required: true
      });
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
