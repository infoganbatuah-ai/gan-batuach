import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { GardenSubscriptionActions } from "@/components/subscription-admin-manager";
import { requireRole } from "@/lib/auth";
import { evaluateSubscriptionAccess, loadGardenSubscriptionData } from "@/lib/domain/billing";
import { getIntegrationSafetyModes, getSafeIntegrationStatus } from "@/lib/domain/provider-integration-safety";
import { createClient } from "@/lib/supabase/server";
import { CheckCircle2, CreditCard, ShieldCheck, WalletCards } from "lucide-react";
import {
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherPageTitle,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  pending_admin_approval: "ממתין לאישור אדמין",
  approved_pending_onboarding: "אושר, ממתין להשלמת פרופיל",
  approved_pending_subscription: "הגן אושר — יש להשלים תשלום מנוי",
  demo_active: "דמו פעיל",
  active: "פעיל",
  trial: "ניסיון",
  pending_payment: "המנוי עדיין לא הופעל",
  payment_failed: "תשלום נכשל",
  frozen: "מוקפא",
  suspended: "מושעה",
  expired: "פג תוקף",
  cancelled: "בוטל"
};

function statusTone(status?: string | null) {
  if (["active", "trial", "demo_active"].includes(String(status))) return "pill good";
  if (["pending_payment", "approved_pending_subscription", "approved_pending_onboarding", "pending_admin_approval"].includes(String(status))) return "pill warn";
  return "pill bad";
}

function money(value: unknown, currency = "ILS") {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function date(value: unknown) {
  if (!value) return "-";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString("he-IL");
}

function demoDaysLeft(subscription: any) {
  const end = subscription?.trial_ends_at ?? subscription?.expires_at;
  if (!end) return null;
  const parsed = new Date(String(end));
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.max(0, Math.ceil((parsed.getTime() - Date.now()) / 86400000));
}

export default async function GardenSubscriptionPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const role = profile.role === "owner" ? "owner" : "manager";
  const gardenId = profile.garden_id ?? "";
  const supabase = await createClient();
  const data = gardenId ? await loadGardenSubscriptionData(supabase as any, gardenId) : { subscription: null, plans: [], payments: [], invoices: [], receipts: [], reminders: [], errors: ["missing garden"] };
  const subscription = data.subscription as any;
  const plan = subscription?.subscription_plans;
  const policy = evaluateSubscriptionAccess(subscription?.status, Boolean(subscription?.admin_override));
  const providerModes = getIntegrationSafetyModes();
  const paymentProviderStatus = getSafeIntegrationStatus("payment", process.env.PAYMENT_PROVIDER);
  const classCount = Number(subscription?.metadata?.class_count ?? subscription?.metadata?.age_group_count ?? 1);
  const expectedMonthly = 800 + Math.max(0, classCount - 1) * 200;
  const daysLeft = demoDaysLeft(subscription);

  return (
    <DashboardShell role={role} title="מנוי גן בטוח" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "מאיה"}`} subtitle="סיכום ותשלום מנוי" avatarUrl={(profile as any).avatar_url ?? null} active="more">
      <TeacherPageTitle icon={WalletCards} title="סיכום ותשלום" subtitle="מנוי גן בטוח בלבד — לא תשלומי הורים" />
      <AdminDataError message={data.errors.length ? "חלק מנתוני המנוי לא נטענו" : null} />

      {subscription?.status !== "active" ? (
        <TeacherSection title="נדרש להשלים מנוי" subtitle="תשלום מנוי גן בטוח נדרש להפעלת המערכת המלאה.">
          <span className="pill warn">
            {subscription?.status === "demo_active" && daysLeft !== null
              ? `הגן בדמו — נותרו ${daysLeft} ימים`
              : subscription?.status === "payment_failed"
                ? "התשלום נכשל — ניתן לנסות שוב"
                : subscription?.status === "frozen"
                  ? "הגן מוקפא עד להסדרת תשלום"
                  : statusLabels[subscription?.status] ?? "הגן אושר — יש להשלים תשלום מנוי"}
          </span>
        </TeacherSection>
      ) : null}

      {!subscription ? (
        <TeacherEmptyState
          title="עדיין לא הוגדר מנוי לגן"
          text="יש לבחור מסלול שנתי ולהשלים תשלום כדי לפתוח את כל יכולות המערכת."
        />
      ) : (
        <>
          <TeacherStatsGrid>
            <TeacherStatCard title="תוכנית" value={plan?.name ?? "Gan Batuach"} hint="מנוי גן" icon={ShieldCheck} tone="purple" />
            <TeacherStatCard title="מחיר חודשי" value={money(subscription?.metadata?.monthly_amount_nis ?? expectedMonthly)} hint="משוער" icon={WalletCards} tone="blue" />
            <TeacherStatCard title="חידוש" value={date(subscription.renewal_date)} hint="תאריך הבא" icon={CreditCard} tone="green" />
            <TeacherStatCard title="סטטוס" value={statusLabels[subscription?.status] ?? "לא הוגדר"} hint="מנוי" icon={CheckCircle2} tone={["active", "trial", "demo_active"].includes(String(subscription?.status)) ? "green" : "orange"} />
          </TeacherStatsGrid>

          <section className="teacher-dashboard-grid">
            <TeacherSection title="פרטי המנוי" subtitle="התוכנית שנבחרה">
              <TeacherCompactList>
                <TeacherCompactItem title="מנוי שנתי בתשלום חודשי" subtitle="התחייבות ל-12 חודשים" tone="purple" meta={money(subscription?.metadata?.monthly_amount_nis ?? expectedMonthly)} />
                <TeacherCompactItem title="סה״כ לשנה" subtitle="חישוב לפי קבוצות / כיתות" tone="blue" meta={money((Number(subscription?.metadata?.monthly_amount_nis ?? expectedMonthly)) * 12)} />
                <TeacherCompactItem title="מצב ספק תשלום" subtitle={paymentProviderStatus === "production_ready" ? "ספק מוכן לפי env" : "אין להניח חיוב חי ללא הגדרה חיצונית"} tone={providerModes.payment === "live" ? "green" : "orange"} meta={providerModes.payment === "live" ? "Live" : providerModes.payment === "sandbox" ? "Sandbox" : "כבוי"} />
              </TeacherCompactList>
            </TeacherSection>

            <TeacherSection title="פירוט חיוב" subtitle="מנוי גן בטוח נפרד מתשלומי הורים">
              <TeacherCompactList>
                <TeacherCompactItem title="בסיס" subtitle="כיתה / קבוצת גיל ראשונה" tone="green" meta="₪800" />
                <TeacherCompactItem title="תוספת" subtitle="כל כיתה / קבוצת גיל נוספת" tone="blue" meta="+₪200" />
                <TeacherCompactItem title="דמו" subtitle="אם הופעל דמו, יש להסדיר תשלום לפני סיום התקופה" tone="orange" meta="3 ימים" />
              </TeacherCompactList>
            </TeacherSection>
          </section>

          <TeacherSection title="מדיניות גישה" subtitle={policy.message}>
            {policy.blockedCapabilities.length ? <div className="profile-actions">{policy.blockedCapabilities.map((capability) => <span className="pill warn" key={capability}>{capability}</span>)}</div> : <span className="pill good">כל הפעולות פתוחות</span>}
          </TeacherSection>
        </>
      )}

      <GardenSubscriptionActions plans={data.plans as any[]} />

      <details className="teacher-management-details">
        <summary>היסטוריית תשלומים וחשבוניות</summary>
        <section className="dashboard-section">
          <div className="section-heading"><h2>היסטוריית תשלומים</h2><p>חיוב גן בטוח הוא מנוי שנתי של הגן מול גן בטוח. תשלומי הורים מנוהלים בנפרד ומועברים ישירות לחשבון הגן.</p></div>
          {data.payments.length === 0 ? <div className="empty-state"><strong>אין עדיין תשלומים</strong><span>כאשר אדמין יתעד תשלום או ספק תשלומים יחובר, ההיסטוריה תופיע כאן.</span></div> : (
            <div className="card-list">{(data.payments as any[]).map((payment) => <article className="card action-panel" key={payment.id}><h3>{money(payment.amount, payment.currency)}</h3><p>{payment.payment_method ?? "ידני"} · {payment.billing_status}</p><span>{date(payment.created_at)}</span></article>)}</div>
          )}
        </section>
      </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
