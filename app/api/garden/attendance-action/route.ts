import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  child_id: z.string().uuid(),
  action: z.enum(["check_in", "check_out"])
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["manager", "owner", "staff"]);
    if (!profile.garden_id) return fail("לא נמצא גן משויך למשתמש", 422);

    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    const { data: child, error: childError } = await supabase
      .from("children" as any)
      .select("id,garden_id,full_name")
      .eq("id", payload.child_id)
      .eq("garden_id", profile.garden_id)
      .maybeSingle();
    if (childError) return fail("לא ניתן לבדוק את כרטיס הילד כרגע.", 400);
    if (!child) return fail("הילד לא נמצא בגן שלך.", 404);

    const { data: existing, error: existingError } = await supabase
      .from("attendance" as any)
      .select("id,status,check_in_at,check_out_at")
      .eq("garden_id", profile.garden_id)
      .eq("child_id", payload.child_id)
      .eq("attendance_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) return fail("לא ניתן לטעון את הנוכחות הנוכחית.", 400);

    const values: Record<string, unknown> = payload.action === "check_in"
      ? {
          garden_id: profile.garden_id,
          child_id: payload.child_id,
          attendance_date: today,
          status: "present",
          check_in_at: existing?.check_in_at ?? now,
          check_out_at: null,
          updated_by: profile.id
        }
      : {
          garden_id: profile.garden_id,
          child_id: payload.child_id,
          attendance_date: today,
          status: "left_early",
          check_in_at: existing?.check_in_at ?? now,
          check_out_at: now,
          updated_by: profile.id
        };

    const result = existing?.id
      ? await supabase.from("attendance" as any).update(values).eq("id", existing.id).select("id,status,check_in_at,check_out_at").single()
      : await supabase.from("attendance" as any).insert(values).select("id,status,check_in_at,check_out_at").single();
    if (result.error) return fail("שמירת הנוכחות נכשלה.", 400);

    await supabase.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: profile.role,
      performed_by_user: profile.id,
      performed_by_role: profile.role,
      garden_id: profile.garden_id,
      entity_type: "attendance",
      entity_id: result.data?.id ?? null,
      action: payload.action,
      after_data: { child_id: payload.child_id, date: today, status: values.status }
    });

    return ok({ attendance: result.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
