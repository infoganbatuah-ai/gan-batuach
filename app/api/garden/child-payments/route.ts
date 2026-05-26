import { z } from "zod";
import { ok, fail, handleRouteError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  child_id: z.string().uuid(),
  action: z.enum(["mark_paid", "mark_unpaid", "partial_payment", "discount", "special_arrangement"]),
  amount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  valid_until: z.string().optional()
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
    const child = await supabase.from("children" as any).select("id, garden_id, monthly_fee").eq("id", payload.child_id).maybeSingle();
    if (child.error || !child.data || (child.data as any).garden_id !== profile.garden_id) {
      return fail("לא ניתן לעדכן תשלום לילד שאינו משויך לגן שלך.", 403);
    }
    const paymentStatus = statusFor(payload.action);
    const paidAt = payload.action === "mark_paid" || payload.action === "partial_payment" ? new Date().toISOString().slice(0, 10) : null;
    const validUntil = payload.valid_until || (payload.action === "mark_paid" ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10) : null);
    const update = await supabase.from("children" as any).update({
      payment_status: paymentStatus,
      last_payment_date: paidAt,
      valid_until: validUntil,
      next_payment_due: validUntil ? new Date(new Date(validUntil).getTime() + 86400000).toISOString().slice(0, 10) : null,
      payment_notes: payload.notes ?? null
    }).eq("id", payload.child_id);
    if (update.error) return fail("לא ניתן לעדכן את סטטוס התשלום כרגע.", 500, update.error);
    const history = await supabase.from("child_payment_history" as any).insert({
      garden_id: profile.garden_id,
      child_id: payload.child_id,
      amount: payload.amount || (child.data as any).monthly_fee || 0,
      action: payload.action,
      payment_status: paymentStatus,
      paid_at: paidAt,
      valid_until: validUntil,
      notes: payload.notes ?? null,
      created_by: profile.id
    });
    if (history.error) console.error("Payment history insert failed", history.error);
    return ok({ payment_status: paymentStatus, valid_until: validUntil });
  } catch (error) {
    return handleRouteError(error);
  }
}
