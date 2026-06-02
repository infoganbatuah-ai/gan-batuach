import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { SubscriptionAdminManager } from "@/components/subscription-admin-manager";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("subscription management", async () => {
    const supabase = await createClient();
    const [subscriptions, plans, gardens, payments] = await Promise.all([
      supabase.from("kindergarten_subscriptions" as any).select("*, gardens(name, city), subscription_plans(name, price_amount, currency)").order("created_at", { ascending: false }).limit(250),
      supabase.from("subscription_plans" as any).select("*").order("sort_order"),
      supabase.from("gardens" as any).select("id, name, city").order("name").limit(500),
      supabase.from("subscription_payments" as any).select("*").order("created_at", { ascending: false }).limit(100)
    ]);
    for (const [label, error] of [["subscriptions", subscriptions.error], ["plans", plans.error], ["gardens", gardens.error], ["payments", payments.error]] as const) logSupabaseError(label, error);
    return {
      subscriptions: subscriptions.data ?? [],
      plans: plans.data ?? [],
      gardens: gardens.data ?? [],
      payments: payments.data ?? [],
      queryError: [subscriptions.error, plans.error, gardens.error, payments.error].some(Boolean) ? "חלק מנתוני המנויים לא נטענו" : null
    };
  }, { subscriptions: [] as any[], plans: [] as any[], gardens: [] as any[], payments: [] as any[], queryError: null as string | null });

  return (
    <DashboardShell role="admin" title="Subscription Management">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Billing Platform</p>
          <h1>ניהול מנויים וחיובים.</h1>
          <p>תוכניות, Trial, חידושים, השעיות, תשלומים שנכשלו ותשתית לספקי תשלום עתידיים.</p>
        </div>
        <span className="pill good">V2A</span>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />
      <SubscriptionAdminManager plans={result.data.plans} subscriptions={result.data.subscriptions} gardens={result.data.gardens} payments={result.data.payments} />
    </DashboardShell>
  );
}
