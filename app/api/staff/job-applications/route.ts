import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ opening_id: z.string().uuid(), idempotency_key: z.string().trim().min(8).max(200).optional() });

export async function POST(request: Request) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile) return fail("נדרשת התחברות מחדש.", 401);
    if (session.profile.role !== "staff") return fail("אין הרשאה להגשת מועמדות צוות.", 403);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const result = await supabase.rpc("submit_staff_job_application", { target_opening_id: payload.opening_id, target_idempotency_key: payload.idempotency_key ?? null });
    if (result.error) {
      const message = result.error.message.includes("candidate_profile_incomplete") ? "יש להשלים את הפרופיל המקצועי והמסמכים לפני הגשת מועמדות."
        : result.error.message.includes("required_qualification_missing") ? "המועמדות דורשת הסמכה שחסרה בפרופיל."
          : result.error.message.includes("staff_opening_not_available") ? "המשרה אינה פתוחה עוד." : "לא ניתן להגיש את המועמדות כעת.";
      return fail(message, result.error.message.includes("not_available") ? 404 : 409);
    }
    return ok(result.data, 201);
  } catch (error) { return handleSafeRouteError(error); }
}
