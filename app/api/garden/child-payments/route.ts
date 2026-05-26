import { z } from "zod";
import { ok, fail, handleRouteError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  child_id: z.string().uuid(),
  action: z.enum(["mark_paid", "mark_unpaid", "partial_payment", "discount", "special_arrangement"]),
  amount: z.coerce.number().min(0).default(0),
  amount_paid: z.coerce.number().min(0).optional(),
  payment_date: z.string().optional(),
  valid_from: z.string().optional(),
  notes: z.string().optional(),
  valid_until: z.string().optional(),
  payment_method: z.string().optional(),
  custom_monthly_fee: z.coerce.number().min(0).optional(),
  arrangement_notes: z.string().optional(),
  arrangement_valid_until: z.string().optional()
});

function statusFor(action: string) {
  if (action === "mark_paid") return "paid";
  if (action === "mark_unpaid") return "overdue";
  if (action === "partial_payment") return "partial";
  if (action === "discount") return "discount";
  return "special_arrangement";
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const child = await supabase
      .from("children" as any)
      .select("id, garden_id, monthly_fee, payment_status, custom_monthly_fee, arrangement_valid_until, payment_group_id, kindergarten_fee_groups(monthly_fee)")
      .eq("id", payload.child_id)
      .maybeSingle();
    if (child.error || !child.data || (child.data as any).garden_id !== profile.garden_id) {
      return fail("לא ניתן לעדכן תשלום לילד שאינו משויך לגן שלך.", 403);
    }
    const childData = child.data as any;
    const paymentStatus = statusFor(payload.action);
    const today = new Date().toISOString().slice(0, 10);
    const activeArrangement = childData.custom_monthly_fee !== null && (!childData.arrangement_valid_until || new Date(childData.arrangement_valid_until).getTime() >= Date.now());
    const groupFee = Array.isArray(childData.kindergarten_fee_groups)
      ? Number(childData.kindergarten_fee_groups[0]?.monthly_fee ?? 0)
      : Number(childData.kindergarten_fee_groups?.monthly_fee ?? 0);
    const defaultAmount = activeArrangement ? Number(childData.custom_monthly_fee ?? 0) : groupFee || Number(childData.monthly_fee ?? 0);
    const amountPaid = payload.amount_paid ?? (payload.amount || defaultAmount);
    const paidAt = payload.action === "mark_paid" || payload.action === "partial_payment" || payload.action === "discount"
      ? payload.payment_date || today
      : null;
    const validUntil = payload.valid_until || (payload.action === "mark_paid" ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10) : null);
    const childPatch: Record<string, unknown> = {
      payment_status: paymentStatus,
      last_payment_date: paidAt,
      valid_until: validUntil,
      next_payment_due: validUntil ? new Date(new Date(validUntil).getTime() + 86400000).toISOString().slice(0, 10) : null,
      payment_notes: payload.notes ?? payload.arrangement_notes ?? null,
      last_amount_paid: amountPaid,
      last_payment_method: payload.payment_method ?? null
    };
    if (payload.action === "special_arrangement") {
      childPatch.custom_monthly_fee = payload.custom_monthly_fee ?? amountPaid;
      childPatch.arrangement_notes = payload.arrangement_notes ?? payload.notes ?? null;
      childPatch.arrangement_valid_until = payload.arrangement_valid_until ?? validUntil;
    }
    const update = await supabase.from("children" as any).update(childPatch).eq("id", payload.child_id);
    if (update.error) return fail("לא ניתן לעדכן את סטטוס התשלום כרגע.", 500, update.error);
    const history = await supabase.from("child_payment_history" as any).insert({
      garden_id: profile.garden_id,
      child_id: payload.child_id,
      amount: amountPaid,
      amount_paid: amountPaid,
      action: payload.action,
      payment_status: paymentStatus,
      paid_at: paidAt,
      valid_from: payload.valid_from ?? paidAt,
      valid_until: validUntil,
      payment_method: payload.payment_method ?? null,
      previous_status: childData.payment_status ?? null,
      new_status: paymentStatus,
      notes: payload.notes ?? payload.arrangement_notes ?? null,
      created_by: profile.id
    });
    if (history.error) console.error("Payment history insert failed", history.error);
    const audit = await supabase.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: profile.role,
      performed_by_user: profile.id,
      performed_by_role: profile.role,
      garden_id: profile.garden_id,
      entity_type: "children",
      entity_id: payload.child_id,
      action: "child_payment_update",
      before_data: { payment_status: childData.payment_status, monthly_fee: childData.monthly_fee, custom_monthly_fee: childData.custom_monthly_fee },
      after_data: {
        action: payload.action,
        amount: amountPaid,
        payment_date: paidAt,
        valid_from: payload.valid_from ?? paidAt,
        valid_until: validUntil,
        previous_status: childData.payment_status ?? null,
        new_status: paymentStatus,
        payment_method: payload.payment_method ?? null
      }
    });
    if (audit.error) console.error("Payment audit insert failed", audit.error);
    return ok({ payment_status: paymentStatus, valid_until: validUntil, amount_paid: amountPaid });
  } catch (error) {
    return handleRouteError(error);
  }
}
