import { AdminDataError } from "@/components/admin-data-state";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { SubscriptionAdminManager, type SubscriptionGardenSummary, type SubscriptionPaymentSummary, type SubscriptionPlanSummary, type SubscriptionSummary } from "@/components/subscription-admin-manager";
import { AlertTriangle, CheckCircle2, CreditCard, ShieldCheck, WalletCards } from "lucide-react";
import { FinanceHero, FinanceMetric, FinanceMetrics, FinanceTruthBanner } from "@/components/finance-platform-ui";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  const { profile } = await requireRole(["admin"]);
  const result = await safeAdminData("subscription management", async () => {
    const supabase = await createClient();
    const [subscriptions, plans, gardens, payments] = await Promise.all([
      supabase.from("kindergarten_subscriptions" as never).select("*, gardens(name, city), subscription_plans(name, price_amount, currency)").order("created_at", { ascending: false }).limit(250),
      supabase.from("subscription_plans" as never).select("*").order("sort_order"),
      supabase.from("gardens" as never).select("id, name, city").order("name").limit(500),
      supabase.from("subscription_payments" as never).select("*").order("created_at", { ascending: false }).limit(100)
    ]);
    for (const [label, error] of [["subscriptions", subscriptions.error], ["plans", plans.error], ["gardens", gardens.error], ["payments", payments.error]] as const) logSupabaseError(label, error);
    return {
      subscriptions: (subscriptions.error ? [] : subscriptions.data ?? []) as unknown as SubscriptionSummary[],
      plans: (plans.error ? [] : plans.data ?? []) as unknown as SubscriptionPlanSummary[],
      gardens: (gardens.error ? [] : gardens.data ?? []) as unknown as SubscriptionGardenSummary[],
      payments: (payments.error ? [] : payments.data ?? []) as unknown as SubscriptionPaymentSummary[],
      subscriptionsAvailable: !subscriptions.error, plansAvailable: !plans.error, gardensAvailable: !gardens.error, paymentsAvailable: !payments.error,
      queryError: [subscriptions.error, plans.error, gardens.error, payments.error].some(Boolean) ? "חלק מנתוני המנויים לא נטענו" : null
    };
  }, { subscriptions: [] as SubscriptionSummary[], plans: [] as SubscriptionPlanSummary[], gardens: [] as SubscriptionGardenSummary[], payments: [] as SubscriptionPaymentSummary[], subscriptionsAvailable: false, plansAvailable: false, gardensAvailable: false, paymentsAvailable: false, queryError: null as string | null });

  const active = result.data.subscriptions.filter((item) => String(item.status) === "active").length;
  const trials = result.data.subscriptions.filter((item) => ["trial", "demo_active"].includes(String(item.status))).length;
  const failed = result.data.payments.filter((item) => String(item.billing_status) === "failed").length;
  const suspended = result.data.subscriptions.filter((item) => ["expired", "suspended", "frozen", "payment_failed"].includes(String(item.status))).length;

  return (
    <AdminAppFrame profile={profile} activeHref="/dashboard/admin/subscriptions" title="מנויים ותשלומים" subtitle="Gan Batuach, תשלומי גנים ו־Digital Observer נשארים מופרדים וברורים." badge="תשלומים">
      <div className="finance-platform">
        <FinanceHero eyebrow="ניהול פלטפורמה" title="מנויי גנים" text="תוכניות, סטטוסי מנוי, מוכנות תשלום ופעולות אדמין — בלי לחשוף או לערבב את ספר שכר הלימוד המשפחתי." />
        <FinanceMetrics>
          <FinanceMetric label="מנויים פעילים" value={result.data.subscriptionsAvailable ? active : "לא זמין"} hint="לא כולל ניסיון" icon={CheckCircle2} tone={result.data.subscriptionsAvailable ? "green" : "orange"} />
          <FinanceMetric label="בתקופת ניסיון" value={result.data.subscriptionsAvailable ? trials : "לא זמין"} hint="ללא הצלחת חיוב מדומה" icon={ShieldCheck} tone={result.data.subscriptionsAvailable ? "blue" : "orange"} />
          <FinanceMetric label="תשלומים שנכשלו" value={result.data.paymentsAvailable ? failed : "לא זמין"} hint="דורש טיפול" icon={CreditCard} tone={!result.data.paymentsAvailable ? "orange" : failed ? "red" : "green"} />
          <FinanceMetric label="מוקפאים / חסומים" value={result.data.subscriptionsAvailable ? suspended : "לא זמין"} hint="היסטוריה נשמרת" icon={AlertTriangle} tone={!result.data.subscriptionsAvailable || suspended ? "orange" : "green"} />
        </FinanceMetrics>
        <FinanceTruthBanner title="הפרדה מלאה" text="מסך זה מנהל מנוי גן → גן בטוח בלבד. לא מוצגים כאן יתרות של ילדים, הורים או שכר לימוד." />
        <AdminDataError message={result.error ?? result.data.queryError} />
        <section className="finance-section"><header><div><h3>ניהול מנויים ותוכניות</h3><p>כל מחיר נלקח מהתוכנית ומה־snapshot הקנוני; אין ערך קשיח בממשק.</p></div><span className="finance-status green"><WalletCards size={15} /> ללא פרטי כרטיס</span></header><SubscriptionAdminManager plans={result.data.plans} subscriptions={result.data.subscriptions} gardens={result.data.gardens} payments={result.data.payments} plansAvailable={result.data.plansAvailable} subscriptionsAvailable={result.data.subscriptionsAvailable} gardensAvailable={result.data.gardensAvailable} paymentsAvailable={result.data.paymentsAvailable} /></section>
      </div>
    </AdminAppFrame>
  );
}
