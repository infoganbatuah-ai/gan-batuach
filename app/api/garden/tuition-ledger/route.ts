import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";
import { projectTuitionPeriod, type TuitionPeriod } from "@/lib/domain/tuition-ledger";

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_due_day"), day: z.number().int().min(1).max(31).nullable() }),
  z.object({ action: z.literal("generate_period"), enrollment_id: z.string().uuid(), month: z.iso.date(), agreed_partial_amount: z.number().min(0).optional(), partial_reason: z.string().min(3).max(500).optional() }),
  z.object({ action: z.literal("manual_settlement"), period_id: z.string().uuid(), amount: z.number().positive(), method: z.enum(["bank_transfer", "standing_order", "checks", "cash", "external_other"]), reference: z.string().max(160).optional(), reason: z.string().max(500).optional(), idempotency_key: z.string().min(8).max(160) }),
  z.object({ action: z.literal("adjustment"), period_id: z.string().uuid(), amount: z.number().refine(value => value !== 0), reason: z.string().min(3).max(500), idempotency_key: z.string().min(8).max(160) })
]);

export async function GET(request: Request) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const childId = new URL(request.url).searchParams.get("child_id");
    if (childId && !z.string().uuid().safeParse(childId).success) return fail("מזהה ילד לא תקין.", 422);
    const supabase = await createClient();
    let query = supabase.from("tuition_billing_periods" as never)
      .select("id,garden_id,enrollment_id,child_id,period_start,period_end,due_at,base_amount,adjustment_total,settled_total,unapplied_credit_total,status,reconciliation_reason,price_source" as never)
      .eq("garden_id", access.gardenId).order("period_start", { ascending: false }).limit(200);
    if (childId) query = query.eq("child_id", childId);
    const [periods, enrollments, garden] = await Promise.all([
      query,
      supabase.from("child_kindergarten_enrollments" as never).select("id,child_id,garden_id,children(full_name)" as never)
        .eq("garden_id", access.gardenId).eq("status", "active").limit(200),
      supabase.from("gardens" as never).select("tuition_due_day" as never).eq("id", access.gardenId).maybeSingle()
    ]);
    if (periods.error || enrollments.error || garden.error) return fail("טעינת חיובי שכר הלימוד נכשלה.", 500);
    return ok({ periods: ((periods.data ?? []) as unknown as TuitionPeriod[]).map(period => projectTuitionPeriod(period)), enrollments: enrollments.data ?? [], due_day: (garden.data as { tuition_due_day?: number | null } | null)?.tuition_due_day ?? null, garden_id: access.gardenId, provider_payment_available: false });
  } catch (error) { return handleSafeRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const payload = action.parse(await request.json());
    const supabase = await createClient();
    if (payload.action === "set_due_day") {
      const result = await supabase.rpc("set_garden_tuition_due_day" as never, { target_garden_id: access.gardenId, requested_day: payload.day } as never);
      if (result.error) return fail("עדכון מועד החיוב נדחה.", result.error.code === "42501" ? 403 : 409);
      return ok({ due_day: result.data });
    }
    if (payload.action === "generate_period") {
      const enrollment = await supabase.from("child_kindergarten_enrollments" as never).select("id,garden_id" as never).eq("id", payload.enrollment_id).eq("garden_id", access.gardenId).maybeSingle();
      if (enrollment.error || !enrollment.data) return fail("הרשמה אינה שייכת לגן הנבחר.", 403);
      const result = await supabase.rpc("ensure_tuition_billing_period" as never, { target_enrollment_id: payload.enrollment_id, target_month: payload.month, agreed_partial_amount: payload.agreed_partial_amount ?? null, partial_reason: payload.partial_reason ?? null } as never);
      if (result.error) return fail(result.error.message?.includes("tuition_partial_period_review_required") ? "חודש התחלה או סיום חלקי דורש סכום מוסכם וסיבה." : "לא ניתן ליצור תקופת חיוב. בדקו הרשמה פעילה ומחיר מוסכם.", result.error.code === "42501" ? 403 : 409);
      return ok({ period: result.data });
    }
    const period = await supabase.from("tuition_billing_periods" as never).select("id,garden_id" as never).eq("id", payload.period_id).eq("garden_id", access.gardenId).maybeSingle();
    if (period.error || !period.data) return fail("תקופת החיוב אינה שייכת לגן הנבחר.", 403);
    const result = await supabase.rpc("apply_manual_tuition_entry" as never, {
      target_period_id: payload.period_id,
      requested_kind: payload.action === "adjustment" ? "adjustment" : "manual_settlement",
      requested_amount: payload.amount,
      requested_method: payload.action === "manual_settlement" ? payload.method : null,
      requested_reference: payload.action === "manual_settlement" ? payload.reference ?? null : null,
      requested_reason: payload.reason ?? null,
      requested_key: payload.idempotency_key
    } as never);
    if (result.error) return fail("רישום התשלום נדחה. בדקו יתרה, הרשאה ומפתח פעולה.", result.error.code === "42501" ? 403 : 409);
    return ok({ period: result.data, provider_payment_confirmed: false });
  } catch (error) { return handleSafeRouteError(error); }
}
