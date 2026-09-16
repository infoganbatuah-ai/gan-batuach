import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { guardianCanAccessChild } from "@/lib/management/family-link";
import { createClient } from "@/lib/supabase/server";
import { projectTuitionPeriod, type TuitionPeriod } from "@/lib/domain/tuition-ledger";

export async function GET(request: Request) {
  try {
    const { user, profile } = await getSessionProfile();
    if (!user) return fail("נדרשת התחברות מחדש.", 401);
    if (!profile || profile.role !== "parent" || profile.active !== true) return fail("אין הרשאת הורה.", 403);
    const childFileId = new URL(request.url).searchParams.get("child_id");
    if (!childFileId || !z.string().uuid().safeParse(childFileId).success) return fail("יש לבחור ילד.", 422);
    const supabase = await createClient();
    if (!await guardianCanAccessChild(supabase, profile.id, childFileId)) return fail("אין הרשאה לצפות בחיובי הילד.", 403);
    const enrollment = await supabase.from("child_kindergarten_enrollments" as never)
      .select("id,garden_id,permanent_child_file_id" as never).eq("permanent_child_file_id", childFileId).order("created_at", { ascending: false }).limit(20);
    if (enrollment.error) return fail("טעינת ההרשמות נכשלה.", 500);
    const ids = ((enrollment.data ?? []) as unknown as Array<{ id: string }>).map(row => row.id);
    if (!ids.length) return ok({ periods: [], provider_payment_available: false });
    const periods = await supabase.from("tuition_billing_periods" as never)
      .select("id,garden_id,enrollment_id,period_start,period_end,due_at,base_amount,adjustment_total,settled_total,unapplied_credit_total,status,reconciliation_reason" as never)
      .in("enrollment_id", ids).order("period_start", { ascending: false }).limit(100);
    if (periods.error) return fail("טעינת חיובי שכר הלימוד נכשלה.", 500);
    return ok({ periods: ((periods.data ?? []) as unknown as TuitionPeriod[]).map(period => projectTuitionPeriod(period)), provider_payment_available: false });
  } catch (error) { return handleSafeRouteError(error); }
}
