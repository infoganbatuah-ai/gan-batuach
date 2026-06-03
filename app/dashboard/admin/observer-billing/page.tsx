import { AlertTriangle, CalendarClock, CreditCard, PackageCheck, RotateCw } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function money(value?: number | null, currency = "ILS") {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency }).format(Number(value ?? 0));
}

function date(value?: string | null) {
  if (!value) return "לא נקבע";
  return new Intl.DateTimeFormat("he-IL").format(new Date(value));
}

function statusClass(status?: string) {
  if (status === "active") return "pill good";
  if (status === "trial" || status === "pending_payment") return "pill warn";
  return "pill bad";
}

export default async function AdminObserverBillingPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("observer billing", async () => {
    const supabase = await createClient();
    const [subscriptions, events, usage, packages] = await Promise.all([
      supabase
        .from("observer_subscriptions" as any)
        .select("*, observer_sites(name, site_type), observer_monitoring_packages(name, package_type, monthly_price, annual_price, currency)")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("observer_billing_events" as any)
        .select("*, observer_sites(name, site_type)")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("observer_usage_tracking" as any)
        .select("*, observer_sites(name, site_type)")
        .order("period_start", { ascending: false })
        .limit(300),
      supabase
        .from("observer_monitoring_packages" as any)
        .select("id, name, package_type, monthly_price, annual_price, currency, active")
        .order("sort_order", { ascending: true })
    ]);
    [subscriptions, events, usage, packages].forEach((query, index) => logSupabaseError("observer billing query " + index, query.error));
    return {
      subscriptions: subscriptions.data ?? [],
      events: events.data ?? [],
      usage: usage.data ?? [],
      packages: packages.data ?? [],
      queryError: subscriptions.error ? "לא ניתן לטעון מנויי Digital Observer כרגע" : null
    };
  }, { subscriptions: [] as any[], events: [] as any[], usage: [] as any[], packages: [] as any[], queryError: null as string | null });
  const data = result.data;
  const active = data.subscriptions.filter((item: any) => item.status === "active").length;
  const trials = data.subscriptions.filter((item: any) => item.status === "trial").length;
  const overdue = data.subscriptions.filter((item: any) => item.status === "overdue" || item.status === "pending_payment").length;
  const suspended = data.subscriptions.filter((item: any) => item.status === "suspended").length;
  const revenueReady = data.subscriptions.reduce((sum: number, item: any) => {
    const plan = item.observer_monitoring_packages;
    if (item.status !== "active" || !plan) return sum;
    return sum + Number(item.billing_cycle === "annual" ? plan.annual_price : plan.monthly_price ?? 0);
  }, 0);
  const packageDistribution = data.subscriptions.reduce<Record<string, number>>((acc: Record<string, number>, item: any) => {
    const name = item.observer_monitoring_packages?.name ?? "ללא חבילה";
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <DashboardShell role="admin" title="Observer Billing">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Future standalone product</p>
          <h1>Billing automation ל-Digital Observer העצמאי.</h1>
          <p>מסך readiness בלבד למנויי בתים, עסקים, מחסנים, משרדים וחניונים. חיוב Gan Batuach נשאר קבוע: 700 ש״ח לחודש לגן, כולל תצפיתן דיגיטלי.</p>
        </div>
        <span className="pill warn">Mock billing only</span>
      </div>
      <AdminDataError message={result.error ?? data.queryError} />

      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><PackageCheck /><strong>{active}</strong><span>מנויים פעילים</span></article>
        <article className="metric-card"><CalendarClock /><strong>{trials}</strong><span>Trials</span></article>
        <article className="metric-card"><AlertTriangle /><strong>{overdue}</strong><span>Pending / overdue</span></article>
        <article className="metric-card"><CreditCard /><strong>{money(revenueReady)}</strong><span>Revenue readiness</span></article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Lifecycle readiness</h2><p>Trial → Active → Pending payment → Overdue → Suspended → Cancelled.</p></div>
          <div className="risk-list">
            <div>Active <b>{active}</b></div>
            <div>Trial <b>{trials}</b></div>
            <div>Overdue / pending <b>{overdue}</b></div>
            <div>Suspended <b>{suspended}</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Package distribution</h2><p>Future standalone packages only.</p></div>
          <div className="risk-list">
            {Object.keys(packageDistribution).length === 0 ? <div>אין מנויי standalone עדיין <b>mock</b></div> : Object.entries(packageDistribution).map(([name, count]) => <div key={name}>{name} <b>{count}</b></div>)}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>Standalone subscriptions</h2>
          <p>אין כאן מנויי Gan Batuach. גנים נשארים במסלול 700 ש״ח לחודש.</p>
        </div>
        {data.subscriptions.length === 0 ? (
          <div className="empty-state"><strong>אין עדיין מנויי Digital Observer standalone</strong><span>לאחר יצירת אתרי standalone ושיוך חבילות יופיעו כאן מנויים.</span></div>
        ) : (
          <div className="procedure-list">
            {data.subscriptions.map((subscription: any) => (
              <article className="card procedure-card" key={subscription.id}>
                <div>
                  <span className={statusClass(subscription.status)}>{subscription.status}</span>
                  <span className="pill">{subscription.billing_cycle}</span>
                  <h3>{subscription.observer_sites?.name ?? "אתר Digital Observer"}</h3>
                  <p>{subscription.observer_monitoring_packages?.name ?? "ללא חבילה"} · חידוש {date(subscription.renewal_date)}</p>
                  <small>{subscription.provider} · {subscription.payment_method_summary ?? "אמצעי תשלום יוגדר בעתיד"}</small>
                </div>
                <div className="procedure-meta">
                  <span>Trial ends: {date(subscription.trial_ends_at)}</span>
                  <span>Period: {date(subscription.current_period_start)} - {date(subscription.current_period_end)}</span>
                  <span>{subscription.admin_override ? "Admin override" : "Observe only"}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Billing automation events</h2><p>Mock reminders and payment lifecycle events.</p></div>
          <div className="risk-list">
            {data.events.length === 0 ? <div>אין אירועי billing עדיין <b>mock</b></div> : data.events.slice(0, 10).map((event: any) => (
              <div key={event.id}>{event.event_type} · {event.observer_sites?.name ?? "אתר"} <b>{event.status}</b></div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Usage and limits</h2><p>Camera, AI, storage and alert usage for future package enforcement.</p></div>
          <div className="risk-list">
            {data.usage.length === 0 ? <div>אין usage tracking עדיין <b>observe only</b></div> : data.usage.slice(0, 10).map((item: any) => (
              <div key={item.id}>{item.observer_sites?.name ?? "אתר"} · {item.period_start} <b>{item.active_cameras} מצלמות · {item.ai_events_count} אירועים</b></div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <RotateCw />
          <h2>Retry schedule readiness</h2>
          <p>התשתית כוללת retry schedule, renewal reminders, failed payment alerts וערוצי email/SMS/WhatsApp/Push. אין שליחת חיוב אמיתי בשלב הזה.</p>
        </article>
        <article className="card action-panel">
          <CreditCard />
          <h2>Payment provider readiness</h2>
          <p>מוכן לארכיטקטורת provider עתידית: credit card, recurring billing, invoice generation ו-payment failure handling.</p>
        </article>
      </section>
    </DashboardShell>
  );
}
