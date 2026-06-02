import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  checklist: z.array(z.object({
    label: z.string(),
    ok: z.boolean(),
    count: z.number().optional()
  })).default([])
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["manager", "owner", "staff"]);
    if (!profile.garden_id) return fail("לא נמצא גן משויך למשתמש", 422);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const unresolved = payload.checklist.filter((item) => !item.ok);
    const today = new Date().toISOString().slice(0, 10);

    const { error } = await supabase.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: profile.role,
      performed_by_user: profile.id,
      performed_by_role: profile.role,
      garden_id: profile.garden_id,
      entity_type: "daily_operations",
      entity_id: profile.garden_id,
      action: "close_kindergarten_day",
      after_data: { date: today, checklist: payload.checklist, unresolved_count: unresolved.length }
    });
    if (error) return fail("לא ניתן לשמור סגירת יום כרגע.", 500);

    return ok({ date: today, unresolved_count: unresolved.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
