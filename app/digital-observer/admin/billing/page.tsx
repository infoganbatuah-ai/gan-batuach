import Link from "next/link";
import { AlertTriangle, CalendarClock, CreditCard, PackageCheck, ShieldCheck } from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { createDigitalObserverAdminDataClient, requireDigitalObserverAdmin } from "@/lib/domain/digital-observer/admin-access";
import { formatObserverDate, observerStatusLabel } from "@/lib/domain/digital-observer/runtime";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";

async function safeQuery<T>(run: () => PromiseLike<{ data: T[] | null; error: unknown }>) {
  try {
    const result = await run();
    return { rows: result.error ? [] : result.data ?? [], error: result.error, failed: Boolean(result.error) };
  } catch (error) {
    return { rows: [], error, failed: true };
  }
}

export default async function DigitalObserverAdminBillingPage() {
  const { profile } = await requireDigitalObserverAdmin("/digital-observer/admin/billing");
  const result = await safeAdminData("observer standalone billing", async () => {
    const supabase = createDigitalObserverAdminDataClient();
    const [subscriptions, providers, events] = await Promise.all([
      safeQuery(() => supabase.from("observer_site_subscriptions" as any).select("id,observer_site_id,status,subscription_status,entitlement_status,payment_provider,purchase_channel,trial_end,renewal_date,observer_sites(name,site_type),observer_monitoring_packages(name,monthly_price,currency)").order("created_at", { ascending: false }).limit(300)),
      safeQuery(() => supabase.from("observer_payment_provider_readiness" as any).select("id,provider_key,provider_name,status,mode,missing_configuration").limit(50)),
      safeQuery(() => supabase.from("observer_billing_events" as any).select("id,event_type,status,created_at,observer_sites(name,site_type)").order("created_at", { ascending: false }).limit(30))
    ]);
    [subscriptions, providers, events].forEach((query, index) => logSupabaseError("observer standalone billing query " + index, query.error));
    return { subscriptions: subscriptions.rows, providers: providers.rows, events: events.rows, errors: [subscriptions, providers, events].map((query) => query.failed) };
  }, { subscriptions: [], providers: [], events: [], errors: [true, true, true] });
  const { subscriptions, providers, events, errors } = result.data;
  const rows = subscriptions;
  const trials = rows.filter((item: any) => item.status === "trial" || item.subscription_status === "trial").length;
  const pending = rows.filter((item: any) => ["pending_payment", "overdue", "suspended"].includes(String(item.status ?? item.subscription_status))).length;

  return <ObserverAppShell profile={profile} mode="admin" activeHref="/digital-observer/admin/billing" title="מנויים וחיוב" statusLabel="Mock / Sandbox בלבד">
    <div className="do-page-stack">
      {result.error || errors.some(Boolean) ? <div className="do-notice bad" role="alert"><span>{result.error ?? "חלק מנתוני החיוב אינם זמינים כרגע"}</span></div> : null}
      <section className="do-business-summary"><article className="do-metric"><PackageCheck /><strong>{errors[0] ? "לא זמין" : rows.length}</strong><span>מנויים</span></article><article className="do-metric"><CalendarClock /><strong>{errors[0] ? "לא זמין" : trials}</strong><span>תקופות ניסיון</span></article><article className="do-metric alert"><AlertTriangle /><strong>{errors[0] ? "לא זמין" : pending}</strong><span>דורשים טיפול</span></article><article className="do-metric"><CreditCard /><strong>מידע בלבד</strong><span>מדיניות חיוב</span></article></section>
      <div className="do-notice warn"><ShieldCheck /><span>אין גביית כרטיס, חשבונית או receipt אמיתי בסביבה זו. השרת שומר entitlement במצב מוכנות בלבד.</span></div>
      <section className="do-grid cols-2"><article className="do-panel"><div className="do-section-head"><div><h2>ספקי חיוב</h2><p>המצב מוצג מהמסד, ללא סטטוס ירוק מומצא.</p></div><Link className="do-link" href="/digital-observer/admin/packages">ניהול חבילות</Link></div>{errors[1] ? <div className="do-empty">נתוני הספקים אינם זמינים כרגע</div> : providers.length ? <div className="do-row-list">{providers.map((item: any) => <div className="do-row" key={item.id}><CreditCard /><span className="do-row-main"><strong>{item.provider_name}</strong><small>{item.provider_key}</small></span><span className="do-row-meta"><b>{observerStatusLabel(item.status)}</b><small>{observerStatusLabel(item.mode)}</small></span></div>)}</div> : <div className="do-empty"><CreditCard /><strong>אין ספק חי מוגדר</strong><span>נדרש חיבור Sandbox לפני בדיקת תשלום.</span></div>}</article><article className="do-panel"><h2>אירועי חיוב אחרונים</h2>{errors[2] ? <div className="do-empty">נתוני האירועים אינם זמינים כרגע</div> : events.length ? <div className="do-row-list">{events.map((item: any) => <div className="do-row" key={item.id}><CalendarClock /><span className="do-row-main"><strong>{observerStatusLabel(item.event_type)}</strong><small>{item.observer_sites?.name ?? "אתר"}</small></span><span className="do-row-meta"><b>{observerStatusLabel(item.status)}</b><small>{formatObserverDate(item.created_at)}</small></span></div>)}</div> : <div className="do-empty"><CalendarClock /><strong>אין אירועי חיוב</strong><span>לא מוצגת הצלחת תשלום מזויפת.</span></div>}</article></section>
      <section className="do-panel"><div className="do-section-head"><div><h2>מנויי התצפיתן העצמאי</h2><p>גני ילדים ותשלומי הורים אינם כלולים בזרם זה.</p></div></div>{errors[0] ? <div className="do-empty">נתוני המנויים אינם זמינים כרגע</div> : rows.length ? <div className="do-row-list">{rows.map((item: any) => <div className="do-row" key={item.id}><PackageCheck /><span className="do-row-main"><strong>{item.observer_sites?.name ?? "אתר עצמאי"}</strong><small>{item.observer_monitoring_packages?.name ?? "ללא חבילה"} · {observerStatusLabel(item.purchase_channel)}</small></span><span className="do-row-meta"><b>{observerStatusLabel(item.status ?? item.subscription_status)}</b><small>חידוש: {formatObserverDate(item.renewal_date)}</small></span></div>)}</div> : <div className="do-empty"><PackageCheck /><strong>אין מנויים להצגה</strong><span>לאחר שיוך חבילת ניסיון יופיעו כאן נתוני המסד.</span></div>}</section>
    </div>
  </ObserverAppShell>;
}
