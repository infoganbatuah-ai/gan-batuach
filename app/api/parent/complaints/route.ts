import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { complaintSchema } from "@/lib/validation";

function reporterProjection(row: any) {
  return {
    id: row.id, garden_id: row.garden_id, child_id: row.child_id,
    subject: row.subject, category: row.category, status: row.status,
    created_at: row.created_at, acknowledged_at: row.acknowledged_at,
    resolution_public: row.resolution_public, closed_at: row.closed_at
  };
}

export async function POST(request: Request) {
  try {
    const session = await getSessionProfile();
    if (!session.user) return fail("נדרשת התחברות מחדש.", 401);
    if (session.profile?.role !== "parent" || session.profile.active !== true) return fail("אין הרשאה להגשת תלונה.", 403);
    const payload = complaintSchema.parse(await request.json());
    const key = z.string().uuid().safeParse(request.headers.get("Idempotency-Key"));
    if (!key.success) return fail("נדרש מזהה בקשה למניעת כפילות.", 422);
    if (payload.attachment_urls?.length) return fail("יש לצרף מסמכים דרך אחסון פרטי בלבד.", 422);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_management_complaint" as never, {
      p_garden_id: payload.garden_id,
      p_child_id: payload.child_id ?? null,
      p_subject: payload.subject,
      p_description: payload.description,
      p_category: payload.category ?? "general",
      p_reported_urgency: payload.urgent ? "critical" : payload.severity,
      p_idempotency_key: key.data
    } as never);
    if (error) return fail(error.code === "42501" ? "אין הרשאה לילד או לגן שנבחרו." : "שמירת התלונה נכשלה.", error.code === "42501" ? 403 : 400);
    return ok(reporterProjection(data), 201);
  } catch (error) { return handleSafeRouteError(error); }
}

export async function GET() {
  try {
    const session = await getSessionProfile();
    if (!session.user) return fail("נדרשת התחברות מחדש.", 401);
    if (session.profile?.role !== "parent" || session.profile.active !== true) return fail("אין הרשאה לצפייה בתלונות.", 403);
    const supabase = await createClient();
    const { data, error } = await supabase.from("complaints" as never)
      .select("id,garden_id,child_id,subject,category,status,created_at,acknowledged_at,resolution_public,closed_at")
      .eq("reporter_user_id", session.user.id).order("created_at", { ascending: false }).limit(100);
    if (error) return fail("טעינת התלונות נכשלה.", 400);
    return ok(data ?? []);
  } catch (error) { return handleSafeRouteError(error); }
}
