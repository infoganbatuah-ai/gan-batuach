import type { SupabaseClient } from "@supabase/supabase-js";

export const subscriptionStatuses = ["active", "trial", "pending_payment", "suspended", "expired", "cancelled"] as const;
export const planTypes = ["trial", "monthly", "annual", "enterprise"] as const;
export const billingProviders = ["manual", "credit_card", "tranzila", "meshulam", "pelecard", "grow", "stripe"] as const;

export type SubscriptionStatus = (typeof subscriptionStatuses)[number];
export type PlanType = (typeof planTypes)[number];
export type BillingProvider = (typeof billingProviders)[number];

export type BillingCapability =
  | "view_historical_data"
  | "manage_children"
  | "manage_staff"
  | "create_parent_leads"
  | "send_parent_messages"
  | "camera_playback"
  | "finance_updates";

export type BillingAccessPolicy = {
  ownerAccess: "full";
  parentHistoricalAccess: "allowed";
  adminOverride: boolean;
  blockedCapabilities: BillingCapability[];
  message: string;
};

export function evaluateSubscriptionAccess(status?: string | null, adminOverride = false): BillingAccessPolicy {
  if (status === "pending_payment" && !adminOverride) {
    return {
      ownerAccess: "full",
      parentHistoricalAccess: "allowed",
      adminOverride,
      blockedCapabilities: ["send_parent_messages", "camera_playback", "finance_updates"],
      message: "תשלום מנוי שנתי נדרש להפעלת המערכת. ניתן להשלים פרופיל, ילדים והורים, אך פעולות מתקדמות ייפתחו אחרי תשלום."
    };
  }

  if (adminOverride || status === "active" || status === "trial") {
    return {
      ownerAccess: "full",
      parentHistoricalAccess: "allowed",
      adminOverride,
      blockedCapabilities: [],
      message: "המנוי פעיל או בתקופת טיפול. כל הפעולות פתוחות."
    };
  }

  if (status === "expired" || status === "suspended" || status === "cancelled") {
    return {
      ownerAccess: "full",
      parentHistoricalAccess: "allowed",
      adminOverride,
      blockedCapabilities: ["manage_children", "manage_staff", "create_parent_leads", "send_parent_messages", "camera_playback", "finance_updates"],
      message: "המנוי אינו פעיל. בעלים ומנהלת עדיין יכולים להיכנס, הורים שומרים גישה להיסטוריה, אך פעולות ניהול חדשות מוגבלות עד חידוש או override אדמין."
    };
  }

  return {
    ownerAccess: "full",
    parentHistoricalAccess: "allowed",
    adminOverride,
    blockedCapabilities: [],
    message: "סטטוס המנוי לא הוגדר. אין חסימה אוטומטית עד בדיקת אדמין."
  };
}

const reminderKey = (label: string, days: number) => label + "_" + Math.abs(days) + "_days";

export const reminderOffsets = [
  { key: reminderKey("before", -), days: -90, title: "המנוי השנתי מסתיים בעוד 90 יום" },
  { key: reminderKey("before", -), days: -60, title: "המנוי השנתי מסתיים בעוד 60 יום" },
  { key: reminderKey("before", -), days: -30, title: "המנוי מסתיים בעוד 30 יום" },
  { key: reminderKey("before", -), days: -14, title: "המנוי מסתיים בעוד 14 יום" },
  { key: reminderKey("before", -), days: -7, title: "המנוי מסתיים בעוד שבוע" },
  { key: ["expiration", "day"].join("_"), days: 0, title: "המנוי מסתיים היום" },
  { key: ["after", "expiration"].join("_"), days: 1, title: "המנוי הסתיים" }
] as const;

export function buildReminderRows(subscription: any) {
  const expiration = subscription.expires_at || subscription.trial_ends_at || subscription.renewal_date;
  if (!expiration) return [];
  const expirationDate = new Date(expiration);
  if (Number.isNaN(expirationDate.getTime())) return [];
  return reminderOffsets.map((offset) => {
    const scheduled = new Date(expirationDate);
    scheduled.setDate(scheduled.getDate() + offset.days);
    return {
      subscription_id: subscription.id,
      garden_id: subscription.garden_id,
      reminder_key: offset.key,
      scheduled_for: scheduled.toISOString(),
      channel: "in_app",
      title: offset.title,
      message: offset.days >= 1
        ? "המנוי הסתיים. ניתן לחדש או לפנות לתמיכה כדי לפתוח grace period."
        : "כדאי להסדיר את חידוש המנוי כדי לשמור על רציפות עבודה בגן.",
      action_url: "/dashboard/garden/subscription",
      status: "pending"
    };
  });
}

export interface PaymentProviderAdapter {
  provider: BillingProvider;
  createCheckoutSession(input: { subscriptionId: string; amount: number; currency: string; successUrl: string; cancelUrl: string }): Promise<{ provider: BillingProvider; checkoutUrl?: string; reference?: string; status: "manual" | "pending" }>;
  cancelSubscription(input: { providerSubscriptionId?: string | null }): Promise<{ status: "cancelled" | "manual" }>;
}

class FutureProviderAdapter implements PaymentProviderAdapter {
  constructor(public provider: BillingProvider) {}

  async createCheckoutSession() {
    return { provider: this.provider, status: "manual" as const, reference: `${this.provider}:not-configured` };
  }

  async cancelSubscription() {
    return { status: "manual" as const };
  }
}

export function getPaymentProviderAdapter(provider: BillingProvider): PaymentProviderAdapter {
  return new FutureProviderAdapter(provider);
}

export async function loadGardenSubscriptionData(supabase: SupabaseClient<any, any, any>, gardenId: string) {
  const [subscription, plans, payments, invoices, receipts, reminders] = await Promise.all([
    supabase
      .from("kindergarten_subscriptions" as any)
      .select("*, subscription_plans(*)")
      .eq("garden_id", gardenId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("subscription_plans" as any).select("*").eq("active", true).order("sort_order"),
    supabase.from("subscription_payments" as any).select("*").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(50),
    supabase.from("billing_invoices" as any).select("*").eq("garden_id", gardenId).order("issued_at", { ascending: false }).limit(50),
    supabase.from("billing_receipts" as any).select("*").eq("garden_id", gardenId).order("issued_at", { ascending: false }).limit(50),
    supabase.from("subscription_reminders" as any).select("*").eq("garden_id", gardenId).order("scheduled_for", { ascending: true }).limit(20)
  ]);

  return {
    subscription: subscription.data ?? null,
    plans: plans.data ?? [],
    payments: payments.data ?? [],
    invoices: invoices.data ?? [],
    receipts: receipts.data ?? [],
    reminders: reminders.data ?? [],
    errors: [subscription.error, plans.error, payments.error, invoices.error, receipts.error, reminders.error].filter(Boolean).map((error: any) => error.message ?? String(error))
  };
}
