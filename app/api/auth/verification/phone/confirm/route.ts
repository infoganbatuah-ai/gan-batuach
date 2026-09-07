import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { normalizeIsraeliMobile } from "@/lib/management/contact-verification";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ phone: z.string().min(8).max(30), code: z.string().trim().regex(/^\d{4,8}$/) });

export async function POST(request: Request) {
  try {
    const { user, profile } = await getSessionProfile();
    if (!user || !profile) return fail("נדרשת התחברות מחדש.", 401);
    if (!isAdminClientConfigured()) return fail("אימות הטלפון אינו זמין כרגע.", 503);
    const payload = schema.parse(await request.json());
    const phone = normalizeIsraeliMobile(payload.phone);
    if (!phone) return fail("יש להזין מספר נייד ישראלי תקין.", 422);
    const supabase = await createClient();
    const verification = await supabase.auth.verifyOtp({ phone, token: payload.code, type: "phone_change" });
    if (verification.error || !verification.data.user?.phone_confirmed_at) return fail("קוד האימות שגוי או שפג תוקפו.", 422);
    const now = verification.data.user.phone_confirmed_at;
    const admin = createAdminClient();
    const [profileWrite, selfServiceWrite] = await Promise.all([
      admin.from("profiles" as never).update({ phone, phone_verified_at: now, updated_at: new Date().toISOString() } as never).eq("id", user.id),
      admin.from("self_service_user_profiles" as never).update({ phone, updated_at: new Date().toISOString() } as never).eq("profile_id", user.id)
    ]);
    if (profileWrite.error || selfServiceWrite.error) return fail("הטלפון אומת, אך עדכון הפרופיל טרם הושלם.", 409);
    return ok({ verified: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
