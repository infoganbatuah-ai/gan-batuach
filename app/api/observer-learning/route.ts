import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const zoneTypes = ["classroom", "playground", "entrance", "exit", "sleeping_area", "restricted_area", "kitchen", "staff_only", "bathroom_entrance"] as const;

const payloadSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update_zone"),
    zone_id: z.string().uuid(),
    zone_type: z.enum(zoneTypes),
    name: z.string().min(1).optional(),
    is_restricted: z.boolean().optional()
  }),
  z.object({
    action: z.literal("save_routine"),
    kindergarten_id: z.string().uuid(),
    opening_start: z.string().optional(),
    opening_end: z.string().optional(),
    pickup_start: z.string().optional(),
    pickup_end: z.string().optional(),
    nap_start: z.string().optional(),
    nap_end: z.string().optional(),
    outdoor_start: z.string().optional(),
    outdoor_end: z.string().optional(),
    breakfast_time: z.string().optional(),
    lunch_time: z.string().optional()
  })
]);

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin", "manager", "owner"]);
    const payload = payloadSchema.parse(await request.json());
    const supabase = isAdminClientConfigured() ? createAdminClient() : await createClient();

    if (payload.action === "update_zone") {
      const { data: zone, error: zoneError } = await supabase.from("camera_zones" as any).select("*").eq("id", payload.zone_id).single();
      if (zoneError || !zone) return fail("אזור מצלמה לא נמצא.", 404);
      if (profile.role !== "admin" && profile.garden_id !== zone.kindergarten_id) return fail("אין הרשאה לעדכן אזור זה.", 403);
      const patch = {
        zone_type: payload.zone_type,
        name: payload.name ?? zone.name,
        is_restricted: payload.is_restricted ?? (payload.zone_type === "restricted_area" || payload.zone_type === "staff_only"),
        updated_at: new Date().toISOString(),
        metadata: { ...(zone.metadata ?? {}), manager_configured: true, no_image_drawing: true }
      };
      const { data, error } = await supabase.from("camera_zones" as any).update(patch).eq("id", payload.zone_id).select("*").single();
      if (error) return fail("שמירת אזור מצלמה נכשלה: " + error.message, 400);
      return ok({ zone: data });
    }

    if (profile.role !== "admin" && profile.garden_id !== payload.kindergarten_id) return fail("אין הרשאה לעדכן שגרה לגן זה.", 403);
    const routine = {
      kindergarten_id: payload.kindergarten_id,
      opening_hours: { start: payload.opening_start || "07:30", end: payload.opening_end || "16:30", days: ["sun", "mon", "tue", "wed", "thu"] },
      pickup_windows: [{ start: payload.pickup_start || "15:30", end: payload.pickup_end || "16:30" }],
      nap_time: { start: payload.nap_start || "13:00", end: payload.nap_end || "14:30" },
      outdoor_activity_hours: [{ start: payload.outdoor_start || "10:00", end: payload.outdoor_end || "11:00" }],
      meal_times: [{ label: "ארוחת בוקר", time: payload.breakfast_time || "09:00" }, { label: "ארוחת צהריים", time: payload.lunch_time || "12:00" }],
      metadata: { manager_configured: true, baseline_only: true },
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from("kindergarten_routine_configs" as any).upsert(routine, { onConflict: "kindergarten_id" }).select("*").single();
    if (error) return fail("שמירת שגרת גן נכשלה: " + error.message, 400);
    await supabase.from("kindergarten_learning_profiles" as any).upsert({
      kindergarten_id: payload.kindergarten_id,
      learning_status: "collecting_baseline",
      learning_started_at: new Date().toISOString(),
      baseline_version: "v0_mock",
      confidence_level: 0.18,
      metadata: { routine_configured: true, no_child_profiling: true },
      updated_at: new Date().toISOString()
    }, { onConflict: "kindergarten_id" });
    return ok({ routine: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
