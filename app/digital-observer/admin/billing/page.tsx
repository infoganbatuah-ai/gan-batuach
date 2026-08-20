import Link from "next/link";
import { AlertTriangle, CalendarClock, CreditCard, PackageCheck, ShieldCheck } from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireRole } from "@/lib/auth";
import { formatObserverDate, observerStatusLabel } from "@/lib/domain/digital-observer/runtime";
import { createClient } from "@/lib/supabase/server";

export default async function DigitalObserverAdminBillingPage() {
  const { profile } = await requireRole(["admin"], "/digital-observer/login?next=/digital-observer/admin/billing", "/digital-observer/dashboard");
  const supabase = await createClient();
  const [subscriptions, providers, events] = await Promise.all([
    supabase.from("observer_site_subscriptions" as any).select("id,observer_site_id,status,subscription_status,entitlement_status,payment_provider,purchase_channel,trial_end,renewal_date,observer_sites(name,site_type),observer_monitoring_packages(name,monthly_price,currency)").order("created_at", { ascending: false }).limit(300),
    supabase.from("observer_payment_provider_readiness" as any).select("id,provider_key,provider_name,status,mode,missing_configuration").limit(50),
    supabase.from("observer_billing_events" as any).select("id,event_type,status,created_at,observer_sites(name,site_type)").order("created_at", { ascending: false }).limit(30)
  ]);
  const rows = subscriptions.data ?? [];
  const trials = rows.filter((item: any) => item.status === "trial" || item.subscription_status === "trial").length;
  const pending = rows.filter((item: any) => ["pending_payment", "overdue", "suspended"].includes(String(item.status ?? item.subscription_status))).length;

  return <ObserverAppShell profile={profile} mode="business" activeHref="/digital-observer/admin/billing" title="מנויים וחיוב" statusLabel="Mock / Sandbox בלבד">
    <div className="do-page-stack">
      <section className="do-business-summary"><article className="do-metric"><PackageCheck /><strong>{rows.length}</strong><span>מנויים</span></article><article className="do-metric"><CalendarClock /><strong>{trials}</strong><span>תקופות ניסיון</span></article><article className="do-metric alert"><AlertTriangle /><strong>{pending}</strong><span>דורשים טיפול</span></article><article className="do-metric"><CreditCard /><strong>0</strong><span>חיובים חיים שבוצעו</span></article></section>
      <div className="do-notice warn"><ShieldCheck /><span>אין גביית כרטיס, חשבונית או receipt אמיתי בסביבה זו. השרת שומר entitlement במצב מוכנות בלבד.</span></div>
      <section className="do-grid cols-2"><article className="do-panel"><div className="do-section-head"><div><h2>ספקי חיוב</h2><p>המצב מוצג מהמסד, ללא סטטוס ירוק מומצא.</p></div><Link className="do-link" href="/digital-observer/admin/packages">ניהול חבילות</Link></div>{(providers.data ?? []).length ? <div className="do-row-list">{(providers.data ?? []).map((item: any) => <div className="do-row" key={item.id}><CreditCard /><span className="do-row-main"><strong>{item.provider_name}</strong><small>{item.provider_key}</small></span><span className="do-row-meta"><b>{observerStatusLabel(item.status)}</b><small>{observerStatusLabel(item.mode)}</small></span></div>)}</div> : <div className="do-empty"><CreditCard /><strong>אין ספק חי מוגדר</strong><span>נדרש חיבור Sandbox לפני בדיקת תשלום.</span></div>}</article><article className="do-panel"><h2>אירועי חיוב אחרונים</h2>{(events.data ?? []).length ? <div className="do-row-list">{(events.data ?? []).map((item: any) => <div className="do-row" key={item.id}><CalendarClock /><span className="do-row-main"><strong>{observerStatusLabel(item.event_type)}</strong><small>{item.observer_sites?.name ?? "אתר"}</small></span><span className="do-row-meta"><b>{observerStatusLabel(item.status)}</b><small>{formatObserverDate(item.created_at)}</small></span></div>)}</div> : <div className="do-empty"><CalendarClock /><strong>אין אירועי חיוב</strong><span>לא מוצגת הצלחת תשלום מזויפת.</span></div>}</article></section>
      <section className="do-panel"><div className="do-section-head"><div><h2>מנויי התצפיתן העצמאי</h2><p>גני ילדים ותשלומי הורים אינם כלולים בזרם זה.</p></div></div>{rows.length ? <div className="do-row-list">{rows.map((item: any) => <div className="do-row" key={item.id}><PackageCheck /><span className="do-row-main"><strong>{item.observer_sites?.name ?? "אתר עצמאי"}</strong><small>{item.observer_monitoring_packages?.name ?? "ללא חבילה"} · {observerStatusLabel(item.purchase_channel)}</small></span><span className="do-row-meta"><b>{observerStatusLabel(item.status ?? item.subscription_status)}</b><small>חידוש: {formatObserverDate(item.renewal_date)}</small></span></div>)}</div> : <div className="do-empty"><PackageCheck /><strong>אין מנויים להצגה</strong><span>לאחר שיוך חבילת ניסיון יופיעו כאן נתוני המסד.</span></div>}</section>
    </div>
  </ObserverAppShell>;
}
