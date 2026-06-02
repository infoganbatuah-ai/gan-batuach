import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { GardenSubscriptionActions } from "@/components/subscription-admin-manager";
import { requireRole } from "@/lib/auth";
import { evaluateSubscriptionAccess, loadGardenSubscriptionData } from "@/lib/domain/billing";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  active: "פעיל",
  trial: "ניסיון",
  pending_payment: "ממתין לתשלום",
  suspended: "מושעה",
  expired: "פג תוקף",
  cancelled: "בוטל"
};

function money(value: unknown, currency = "ILS") {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function date(value: unknown) {
  if (!value) return "-";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString("he-IL");
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

  return (
    <DashboardShell role={role} title="Subscription Center">
      <div className="dashboard-hero-card garden-hero-card">
        <div>
          <p className="eyebrow">Subscription Center</p>
          <h1>מנוי וחיוב של הגן.</h1>
          <p>מחיר קבוע: 700 ש״ח לחודש לגן. כולל מערכת ניהול, תצפיתן דיגיטלי כלול, מצלמות ותובנות בטיחות כחלק מהמערכת.</p>
        </div>
        <span className={["active", "trial"].includes(subscription?.status) ? "pill good" : subscription?.status === "pending_payment" ? "pill warn" : "pill bad"}>
          {statusLabels[subscription?.status] ?? "לא הוגדר"}
        </span>
      </div>
      <AdminDataError message={data.errors.length ? "חלק מנתוני המנוי לא נטענו" : null} />

      {!subscription ? (
        <section className="empty-state">
          <strong>עדיין לא הוגדר מנוי לגן</strong>
          <span>אדמין יכול להגדיר את תוכנית Gan Batuach הקבועה: 700 ש״ח לחודש לגן.</span>
        </section>
      ) : (
        <>
          <section className="grid cols-4 dashboard-panels">
            <article className="card metric-card"><span>תוכנית</span><strong>{plan?.name ?? "Gan Batuach 700"}</strong></article>
            <article className="card metric-card"><span>מחיר</span><strong>{money(plan?.price_amount, plan?.currency ?? "ILS")}</strong></article>
            <article className="card metric-card"><span>חידוש</span><strong>{date(subscription.renewal_date)}</strong></article>
            <article className="card metric-card"><span>תוקף</span><strong>{date(subscription.expires_at ?? subscription.trial_ends_at)}</strong></article>
          </section>

          <section className="card action-panel">
            <div className="section-heading"><h2>מדיניות גישה</h2><p>{policy.message}</p></div>
            {policy.blockedCapabilities.length ? <div className="profile-actions">{policy.blockedCapabilities.map((capability) => <span className="pill warn" key={capability}>{capability}</span>)}</div> : <span className="pill good">כל הפעולות פתוחות</span>}
          </section>
        </>
      )}

      <GardenSubscriptionActions plans={data.plans as any[]} />

      <section className="dashboard-section">
        <div className="section-heading"><h2>היסטוריית תשלומים</h2><p>חיוב גן בטוח הוא 700 ש״ח לחודש לגן. תצפיתן דיגיטלי כלול, ללא חבילת תצפיתן נפרדת בשלב זה.</p></div>
        {data.payments.length === 0 ? <div className="empty-state"><strong>אין עדיין תשלומים</strong><span>כאשר אדמין יתעד תשלום או ספק תשלומים יחובר, ההיסטוריה תופיע כאן.</span></div> : (
          <div className="card-list">{(data.payments as any[]).map((payment) => <article className="card action-panel" key={payment.id}><h3>{money(payment.amount, payment.currency)}</h3><p>{payment.payment_method ?? "ידני"} · {payment.billing_status}</p><span>{date(payment.created_at)}</span></article>)}</div>
        )}
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <h2>חשבוניות</h2>
          {data.invoices.length === 0 ? <p>אין חשבוניות עדיין.</p> : (data.invoices as any[]).map((invoice) => <p key={invoice.id}>{invoice.invoice_number} · {money(invoice.amount, invoice.currency)} · {invoice.billing_status}</p>)}
        </article>
        <article className="card action-panel">
          <h2>קבלות</h2>
          {data.receipts.length === 0 ? <p>אין קבלות עדיין.</p> : (data.receipts as any[]).map((receipt) => <p key={receipt.id}>{receipt.receipt_number} · {money(receipt.amount, receipt.currency)}</p>)}
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>תזכורות מנוי</h2><p>30, 14, 7, 3, 1 ימים, יום סיום ואחרי סיום. כרגע in-app, מוכנות ל-SMS/WhatsApp/Push.</p></div>
        {data.reminders.length === 0 ? <div className="empty-state"><strong>אין תזכורות מתוזמנות</strong><span>תזכורות ייווצרו כאשר אדמין יגדיר תאריך תוקף או חידוש.</span></div> : (
          <div className="card-list">{(data.reminders as any[]).map((reminder) => <article className="card action-panel" key={reminder.id}><h3>{reminder.title}</h3><p>{date(reminder.scheduled_for)} · {reminder.channel} · {reminder.status}</p></article>)}</div>
        )}
      </section>
    </DashboardShell>
  );
}
