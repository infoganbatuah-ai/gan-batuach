import { AdminDataError } from "@/components/admin-data-state";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { SubscriptionAdminManager } from "@/components/subscription-admin-manager";
import { CreditCard, ShieldCheck } from "lucide-react";
import { DashboardGrid, MetricCard, PremiumCard, SectionHeader, StatusChip } from "@/components/gan-batuach-design-system";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  const { profile } = await requireRole(["admin"]);
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

  const active = result.data.subscriptions.filter((item) => String(item.status) === "active").length;
  const trials = result.data.subscriptions.filter((item) => ["trial", "demo_active"].includes(String(item.status))).length;
  const failed = result.data.payments.filter((item) => String(item.billing_status) === "failed").length;
  const suspended = result.data.subscriptions.filter((item) => ["expired", "suspended", "frozen", "payment_failed"].includes(String(item.status))).length;

  return (
    <AdminAppFrame profile={profile} activeHref="/dashboard/admin/subscriptions" title="מנויים ותשלומים" subtitle="Gan Batuach, תשלומי גנים ו־Digital Observer נשארים מופרדים וברורים." badge="תשלומים">
      <PremiumCard size="lg" className="admin-section-card">
        <SectionHeader eyebrow="Billing Platform" title="ניהול מנויים וחיובים" subtitle="תוכניות, Trial, חידושים, השעיות, תשלומים שנכשלו ותשתית לספקי תשלום עתידיים." icon={CreditCard} />
        <StatusChip tone="success" icon={ShieldCheck}>ללא חשיפת פרטי כרטיס</StatusChip>
      </PremiumCard>
      <DashboardGrid columns={4}>
        <MetricCard label="גנים משלמים" value={active} hint="לא כולל Trial / דמו" tone="success" icon={CreditCard} />
        <MetricCard label="בתקופת ניסיון" value={trials} hint="14 יום, ללא חיוב היום" tone="primary" icon={ShieldCheck} />
        <MetricCard label="תשלומים שנכשלו" value={failed} hint="דורש טיפול" tone={failed ? "warning" : "success"} icon={CreditCard} />
        <MetricCard label="מוקפאים/כשלים" value={suspended} hint="Lifecycle" tone={suspended ? "warning" : "success"} icon={ShieldCheck} />
      </DashboardGrid>
      <AdminDataError message={result.error ?? result.data.queryError} />
      <SubscriptionAdminManager plans={result.data.plans} subscriptions={result.data.subscriptions} gardens={result.data.gardens} payments={result.data.payments} />
    </AdminAppFrame>
  );
}
