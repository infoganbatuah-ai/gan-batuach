import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Formal complaints are submitted through the reporter-bound domain endpoint. */
export async function POST() {
  return fail("יש להגיש תלונה דרך מסלול התלונות המאובטח.", 405);
}

export async function GET() {
  try {
    const session = await getSessionProfile();
    if (!session.user) return fail("נדרשת התחברות מחדש.", 401);
    if (!session.profile || !["admin", "inspector", "manager", "owner"].includes(session.profile.role)) return fail("אין הרשאה לצפייה בתלונות.", 403);
    const supabase = await createClient();
    const { data, error } = await supabase.from("complaints" as never)
      .select("id,garden_id,child_id,subject,category,severity,status,visibility,routing_state,assigned_inspector_id,created_at,acknowledgement_due_at,response_due_at,resolution_due_at,acknowledged_at,resolved_at,closed_at,escalated_at")
      .order("created_at", { ascending: false }).limit(150);
    if (error) return fail("טעינת התלונות נכשלה.", 400);
    return ok(data ?? []);
  } catch (error) { return handleSafeRouteError(error); }
}
