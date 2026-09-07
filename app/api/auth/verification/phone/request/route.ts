import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { normalizeIsraeliMobile } from "@/lib/management/contact-verification";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ phone: z.string().min(8).max(30) });

export async function POST(request: Request) {
  try {
    const { user, profile } = await getSessionProfile();
    if (!user || !profile) return fail("נדרשת התחברות מחדש.", 401);
    const payload = schema.parse(await request.json());
    const phone = normalizeIsraeliMobile(payload.phone);
    if (!phone) return fail("יש להזין מספר נייד ישראלי תקין.", 422);
    const supabase = await createClient();
    const result = await supabase.auth.updateUser({ phone });
    if (result.error) return fail("לא ניתן לשלוח כרגע קוד אימות לטלפון.", 503);
    return ok({ sent: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
