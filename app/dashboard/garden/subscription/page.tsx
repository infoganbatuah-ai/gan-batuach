import Link from "next/link";
import { PermissionDeniedState } from "@/components/global-state-system";
import { CalendarClock, CheckCircle2, CreditCard, FileText, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { FinanceFrame } from "@/components/finance-platform-frame";
import { FinanceEmpty, FinanceHero, FinanceMetric, FinanceMetrics, FinanceSection, FinanceStatus, FinanceTruthBanner, dateText, money } from "@/components/finance-platform-ui";
import { GardenSubscriptionActions, type SubscriptionPlanSummary } from "@/components/subscription-admin-manager";
import { evaluateSubscriptionAccess, loadGardenSubscriptionData } from "@/lib/domain/billing";
import { getSafeIntegrationStatus } from "@/lib/domain/provider-integration-safety";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const labels: Record<string, string> = { active: "פעיל", trial: "ניסיון", demo_active: "דמו פעיל", pending_payment: "ממתין להסדרה", approved_pending_subscription: "נדרש מנוי", past_due: "באיחור", grace_period: "תקופת חסד", payment_failed: "תשלום נכשל", frozen: "מוקפא", suspended: "מושעה", expired: "פג תוקף", cancelled: "בוטל" };
type GardenSubscription = { status: string; admin_override?: boolean | null; unit_price_snapshot?: number | string | null; renewal_date?: string | null; commitment_months?: number | null; billing_interval?: string | null; subscription_plans?: { name?: string | null } | null };
type SubscriptionPayment = { id: string; amount: number | string; payment_method?: string | null; billing_status?: string | null };
type SubscriptionInvoice = { id: string; invoice_number?: string | null; amount: number | string; issued_at?: string | null; billing_status?: string | null };
type SubscriptionReceipt = { id: string; receipt_number?: string | null; amount: number | string; issued_at?: string | null };

export default async function GardenSubscriptionPage() {
  const access = await getManagementGardenContext();
  if (!access.allowed) return <PermissionDeniedState backHref="/dashboard/garden/finance" description="פרטי המנוי זמינים רק לבעלי תפקיד מורשים בגן הפעיל." />;
  const role = access.session.profile.role === "owner" ? "owner" : "manager";
  const supabase = await createClient();
  const [data, gardenRes] = await Promise.all([
    loadGardenSubscriptionData(supabase as never, access.gardenId),
    supabase.from("gardens" as never).select("name" as never).eq("id", access.gardenId).maybeSingle()
  ]);
  const subscription = data.subscription as unknown as GardenSubscription | null;
  const plan = subscription?.subscription_plans;
  const policy = evaluateSubscriptionAccess(subscription?.status, Boolean(subscription?.admin_override));
  const provider = getSafeIntegrationStatus("payment", process.env.PAYMENT_PROVIDER);
  // The provider safety contract never promotes a configured adapter to verified checkout.
  const providerReady = false;
  const providerLabel = provider === "disabled" ? "מושבת" : provider === "not_configured" ? "לא מוגדר" : "לא מאומת לייצור";
  const price = subscription?.unit_price_snapshot;
  const priceLabel = price == null ? "מחיר לא אומת" : money(price);
  const gardenName = String((gardenRes.data as { name?: string } | null)?.name ?? "הגן הפעיל");
  const payments = data.payments as unknown as SubscriptionPayment[];
  const invoices = data.invoices as unknown as SubscriptionInvoice[];
  const receipts = data.receipts as unknown as SubscriptionReceipt[];

  return <DashboardShell role={role} title="מנוי גן בטוח" appHome>
    <FinanceFrame role={role} name={access.session.profile.full_name} avatarUrl={(access.session.profile as { profile_image_url?: string | null }).profile_image_url} activeHref="/dashboard/garden/finance" title="מנוי גן בטוח" subtitle="הגן ← גן בטוח · מסלול נפרד משכר לימוד">
      <FinanceHero eyebrow={gardenName} title="מנוי הפלטפורמה" text="התוכנית, המחיר המוסכם, תקופת ההתחייבות ומוכנות ספק התשלום — ללא ערבוב עם תשלומי הורים." action={<Link className="button secondary" href="/dashboard/garden/finance"><WalletCards size={18} /> חזרה למרכז הכספים</Link>} />
      {data.errors.length ? <FinanceTruthBanner kind="warning" title="חלק מנתוני המנוי אינם זמינים" text="מקור נתונים שנכשל אינו מוצג כיתרה או מסמך ריק." /> : null}
      {subscription ? <>
        <FinanceMetrics>
          <FinanceMetric label="תוכנית" value={plan?.name ?? "גן בטוח"} hint="מנוי הגן" icon={ShieldCheck} tone="purple" />
          <FinanceMetric label="מחיר מוסכם" value={priceLabel} hint={subscription.billing_interval === "annual" ? "לשנה" : "לתקופת חיוב"} icon={WalletCards} tone="blue" />
          <FinanceMetric label="מועד חידוש" value={dateText(subscription.renewal_date)} hint={`${subscription.commitment_months ?? "לא הוגדרה"} חודשי התחייבות`} icon={CalendarClock} tone="green" />
          <FinanceMetric label="סטטוס" value={labels[subscription.status] ?? "לא הוגדר"} hint="מנוי פלטפורמה" icon={CheckCircle2} tone={["active", "trial", "demo_active"].includes(subscription.status) ? "green" : "orange"} />
        </FinanceMetrics>
        <section className="finance-subscription-card"><div><FinanceStatus status={subscription.status}>{labels[subscription.status] ?? subscription.status}</FinanceStatus><h3>{plan?.name ?? "תוכנית גן בטוח"}</h3><p>{policy.message}</p></div><div className="finance-subscription-price"><span>מחיר מוגדר</span><strong>{priceLabel}</strong><small>{subscription.billing_interval === "annual" ? "חיוב שנתי" : "מחזור לפי הרשומה"}</small></div></section>
      </> : <FinanceEmpty title="מנוי עדיין לא הוגדר" text="אדמין מורשה יכול להגדיר תוכנית ומחיר. אין כאן חיוב או הפעלה אוטומטיים." />}
      <FinanceTruthBanner title="הפרדה חשבונאית" text="המנוי הוא התחייבות של הגן כלפי גן בטוח. הוא אינו משנה חיובים, יתרות או היסטוריה של משפחות." />
      <div className="finance-two-column">
        <FinanceSection title="מוכנות ספק תשלום" text="יכולת מוצגת כפעילה רק לאחר אימות ייצור ומדיניות">
          <div className="finance-provider-state"><span><CreditCard size={22} />{providerReady ? "ספק תשלום מאומת" : "ספק תשלום אינו זמין"}</span><p>{providerReady ? "הספק עבר אימות ייצור; פעולות עדיין כפופות לכוונת חיוב והרשאה." : "אין Checkout, חיוב חוזר או הצלחה מדומה. טיפול ידני נשאר המצב האמיתי."}</p><FinanceStatus status={providerReady ? "verified" : "pending_payment"}>{providerReady ? "מאומת לייצור" : providerLabel}</FinanceStatus></div>
          <details className="finance-action-drawer" style={{ marginTop: 12 }}><summary>פעולות מנוי מורשות</summary><div className="finance-action-body"><GardenSubscriptionActions plans={data.plans as unknown as SubscriptionPlanSummary[]} /></div></details>
        </FinanceSection>
        <FinanceSection title="גישה לפי מצב מנוי" text="היסטוריה נשמרת גם כאשר פעולות חדשות מוגבלות">
          {policy.blockedCapabilities.length ? <div className="finance-history">{policy.blockedCapabilities.map((item) => <article className="finance-history-row" key={item}><span><ShieldCheck size={20} /></span><div><b>פעולה מוגבלת</b><small>{item}</small></div><FinanceStatus status="pending">לטיפול</FinanceStatus></article>)}</div> : <FinanceTruthBanner kind="success" title="יכולות הניהול פתוחות" text="לא נמצאו הגבלות מנוי קנוניות למצב הנוכחי." />}
        </FinanceSection>
      </div>
      <div className="finance-three-column">
        <FinanceSection title="תשלומי מנוי" text="היסטוריה נפרדת"><div className="finance-history">{payments.slice(0, 4).map((item) => <article className="finance-history-row" key={item.id}><span><CreditCard size={20} /></span><div><b>{money(item.amount)}</b><small>{item.payment_method ?? "ידני"}</small></div><FinanceStatus status={item.billing_status ?? "pending"}>{item.billing_status ?? "ממתין"}</FinanceStatus></article>)}{!payments.length ? <FinanceEmpty title="אין תשלומי מנוי" text="לא יוצג תשלום לפני שהוא קיים ברשומה הקנונית." /> : null}</div></FinanceSection>
        <FinanceSection title="חשבוניות מנוי" text="רק מסמכים קיימים"><div className="finance-history">{invoices.slice(0, 4).map((item) => <article className="finance-history-row" key={item.id}><span><FileText size={20} /></span><div><b>{item.invoice_number}</b><small>{money(item.amount)} · {dateText(item.issued_at)}</small></div><FinanceStatus status={item.billing_status ?? "pending"}>{item.billing_status ?? "ממתין"}</FinanceStatus></article>)}{!invoices.length ? <FinanceEmpty title="אין חשבוניות זמינות" text="המערכת אינה מייצרת מספר חשבונית או מסמך מס מדומה." /> : null}</div></FinanceSection>
        <FinanceSection title="קבלות מנוי" text="מסמכים מאומתים בלבד"><div className="finance-history">{receipts.slice(0, 4).map((item) => <article className="finance-history-row" key={item.id}><span><ReceiptText size={20} /></span><div><b>{item.receipt_number}</b><small>{money(item.amount)} · {dateText(item.issued_at)}</small></div><FinanceStatus status="paid">זמין</FinanceStatus></article>)}{!receipts.length ? <FinanceEmpty title="אין קבלות זמינות" text="קבלה תופיע רק אם נוצרה במסלול המנוי הקנוני." /> : null}</div></FinanceSection>
      </div>
    </FinanceFrame>
  </DashboardShell>;
}
