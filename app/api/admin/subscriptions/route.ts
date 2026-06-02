import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { buildReminderRows, planTypes, subscriptionStatuses } from "@/lib/domain/billing";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  garden_id: z.string().uuid(),
  plan_id: z.string().uuid().optional().nullable(),
  status: z.enum(subscriptionStatuses),
  plan_type: z.enum(planTypes),
  start_date: z.string().optional(),
  expires_at: z.string().optional().nullable(),
  renewal_date: z.string().optional().nullable(),
  trial_ends_at: z.string().optional().nullable(),
  admin_override: z.coerce.boolean().default(false),
  override_reason: z.string().optional().nullable(),
  suspension_reason: z.string().optional().nullable(),
  billing_contact_name: z.string().optional().nullable(),
  billing_contact_email: z.string().optional().nullable(),
  billing_contact_phone: z.string().optional().nullable()
});

export async function GET() {
  try {
    await requireRole(["admin"]);
    const supabase = await createClient();
    const [subscriptions, plans, gardens, payments] = await Promise.all([
      supabase.from("kindergarten_subscriptions" as any).select("*, gardens(name, city), subscription_plans(name, price_amount, currency)").order("created_at", { ascending: false }).limit(250),
      supabase.from("subscription_plans" as any).select("*").order("sort_order"),
      supabase.from("gardens" as any).select("id, name, city").order("name").limit(500),
      supabase.from("subscription_payments" as any).select("*").order("created_at", { ascending: false }).limit(100)
    ]);
    const errors = [subscriptions.error, plans.error, gardens.error, payments.error].filter(Boolean);
    if (errors.length) console.error("[admin-subscriptions-load]", errors);
    return ok({
      subscriptions: subscriptions.data ?? [],
      plans: plans.data ?? [],
      gardens: gardens.data ?? [],
      payments: payments.data ?? [],
      warning: errors.length ? "חלק מנתוני המנויים לא נטענו" : null
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const existing = await supabase
      .from("kindergarten_subscriptions" as any)
      .select("*")
      .eq("garden_id", payload.garden_id)
      .in("status", ["active", "trial", "pending_payment", "suspended"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const patch = {
      ...payload,
      start_date: payload.start_date ?? new Date().toISOString().slice(0, 10),
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
      suspended_at: payload.status === "suspended" ? new Date().toISOString() : null,
      cancelled_at: payload.status === "cancelled" ? new Date().toISOString() : null,
      trial_status: payload.status === "trial" ? "active" : "not_active"
    };

    const mutation = existing.data?.id
      ? await supabase.from("kindergarten_subscriptions" as any).update(patch).eq("id", existing.data.id).select("*").single()
      : await supabase.from("kindergarten_subscriptions" as any).insert({ ...patch, created_by: profile.id }).select("*").single();

    if (mutation.error || !mutation.data) {
      console.error("[subscription-save]", mutation.error);
      return fail("לא ניתן לשמור מנוי כרגע.", 500);
    }

    const reminders = buildReminderRows(mutation.data);
    if (reminders.length) {
      const reminderWrite = await supabase.from("subscription_reminders" as any).upsert(reminders, { onConflict: "subscription_id,reminder_key,channel" });
      if (reminderWrite.error) console.error("[subscription-reminders-upsert]", reminderWrite.error);
    }

    await supabase.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: "admin",
      garden_id: payload.garden_id,
      entity_type: "kindergarten_subscriptions",
      entity_id: mutation.data.id,
      action: existing.data?.id ? "update_kindergarten_subscription" : "create_kindergarten_subscription",
      before_data: existing.data ?? null,
      after_data: mutation.data
    });

    return ok({ subscription: mutation.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
