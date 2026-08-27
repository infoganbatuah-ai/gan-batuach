import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle2, Clock3, Radar, ShieldAlert, ShieldCheck, UserCheck } from "lucide-react";
import { ObserverQuickAction } from "@/components/digital-observer/observer-action-forms";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { ObserverCameraMedia } from "@/components/digital-observer/observer-camera-media";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { formatObserverDate, loadObserverRuntime, observerEventLabel, observerModeForSite, observerStatusLabel } from "@/lib/domain/digital-observer/runtime";
import { getDigitalObserverProductReadiness } from "@/lib/domain/digital-observer/provider-readiness";

type PageProps = { searchParams?: Promise<{ event?: string; site?: string; severity?: string }> };
const severityClass = (value?: string) => ["critical", "urgent", "high"].includes(String(value)) ? "bad" : value === "medium" ? "warn" : "info";

export default async function DigitalObserverAlertsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/alerts");
  const runtime = await loadObserverRuntime(profile.id);
  const site = runtime.sites.find((item) => item.id === params?.site) ?? runtime.sites[0] ?? null;
  const mode = observerModeForSite(site);
  const allSignals = site ? runtime.signals.filter((item) => item.observer_site_id === site.id) : [];
  const signals = params?.severity ? allSignals.filter((item) => item.severity === params.severity) : allSignals;
  const selected = allSignals.find((item) => item.id === params?.event) ?? signals[0] ?? null;
  const camera = selected ? runtime.cameras.find((item) => item.id === selected.camera_id || item.camera_stream_id === selected.camera_id) : null;
  const readiness = getDigitalObserverProductReadiness();
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/alerts" title="מרכז ההתראות" statusLabel="ביקורת אנושית חובה">
    <div className="do-page-stack">
      <div className="do-notice info"><ShieldCheck /><span>AI Shadow מקבל אירועים לבדיקה בלבד. Push, SMS, WhatsApp ושיחה מוצגים כנתיבי ניתוב מוכנים, אך אינם שולחים או מחייגים ללא ספק מאושר והסכמה.</span></div>
      <section className="do-filter-bar"><div className="do-segmented"><Link className={!params?.severity ? "active" : ""} href="/digital-observer/alerts">הכול</Link><Link className={params?.severity === "critical" ? "active" : ""} href="/digital-observer/alerts?severity=critical">קריטי</Link><Link className={params?.severity === "high" ? "active" : ""} href="/digital-observer/alerts?severity=high">דחוף</Link><Link className={params?.severity === "medium" ? "active" : ""} href="/digital-observer/alerts?severity=medium">אזהרה</Link></div><span className="do-badge info">{signals.length} אירועים</span></section>
      <section className="do-event-layout">
        <article className="do-panel do-event-list"><div className="do-section-head"><div><h2>אירועים</h2><p>זיהוי AI מוצג כהערכה עם רמת ביטחון.</p></div></div>{signals.length ? <div className="do-row-list">{signals.map((signal) => <Link className={selected?.id === signal.id ? "do-row selected" : "do-row"} href={`/digital-observer/alerts?event=${signal.id}${params?.severity ? `&severity=${params.severity}` : ""}`} key={signal.id}><Radar /><span className="do-row-main"><strong>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</strong><small>{signal.recommended_action || "מומלץ לבדוק"}</small></span><span className="do-row-meta"><b className={`do-badge ${severityClass(signal.severity)}`}>{observerStatusLabel(signal.severity)}</b><time>{formatObserverDate(signal.created_at)}</time></span></Link>)}</div> : <div className="do-empty"><CheckCircle2 /><strong>אין אירועים להצגה</strong><span>לא מוצגים אירועים מדומים אם לא קיימת רשומה סינתטית או אמיתית באתר.</span></div>}</article>
        <article className="do-panel do-event-detail">{selected ? <><div className="do-section-head"><div><span className={`do-badge ${severityClass(selected.severity)}`}>{observerStatusLabel(selected.severity)}</span><h2>{observerEventLabel(selected.metadata?.event_type ?? selected.signal_type)}</h2><p>{formatObserverDate(selected.created_at)}</p></div></div>{camera ? <ObserverCameraMedia large name={camera.display_name} mode={mode} scene={camera.preview_scene} status={camera.status || camera.health_status} sourceMode={camera.source_mode} /> : <div className="do-event-placeholder"><ShieldAlert /><strong>אין preview זמין לאירוע</strong><span>האירוע נשמר ללא תמונה או קטע וידאו. המערכת אינה מציגה מדיה חלופית כאילו היא מן האירוע.</span></div>}<div className="do-confidence"><span>רמת ביטחון בזיהוי</span><strong>{selected.confidence == null ? "לא נמסרה" : `${Math.round(Number(selected.confidence) * 100)}%`}</strong></div><div className="do-notice info"><UserCheck /><span>{selected.recommended_action || "מומלץ לבצע בדיקה אנושית לפני פעולה."}</span></div><div className="do-button-row"><ObserverQuickAction endpoint="/api/digital-observer/events/review" body={{ signal_id: selected.id, review_status: "confirmed", note: "אושר בביקורת אנושית" }}><CheckCircle2 /> אישור אירוע</ObserverQuickAction><ObserverQuickAction endpoint="/api/digital-observer/events/review" body={{ signal_id: selected.id, review_status: "dismissed", note: "נדחה בביקורת אנושית" }}><ShieldCheck /> הכול בסדר, כיול האירוע</ObserverQuickAction><ObserverQuickAction endpoint="/api/digital-observer/events/review" body={{ signal_id: selected.id, review_status: "escalated", note: "הועבר להמשך בדיקה" }}><AlertTriangle /> העברה לבדיקה</ObserverQuickAction></div></> : <div className="do-empty"><Bell /><strong>בחרו אירוע</strong><span>פרטי האירוע ורמת הביטחון יופיעו כאן.</span></div>}</article>
      </section>
      <section className="do-grid cols-3">{readiness.alertChannels.filter((channel) => channel.key !== "in_app").slice(0, 3).map((channel) => <article className="do-panel" key={channel.key}><Bell /><h3>{channel.label}</h3><p>{channel.historyState}</p><span className={channel.mode === "disabled" ? "do-badge bad" : "do-badge warn"}>{channel.mode === "disabled" ? "כבוי עד ספק" : "ממתין Sandbox"}</span></article>)}</section>
      <section className="do-grid cols-4"><article className="do-metric"><Bell /><strong>{allSignals.length}</strong><span>כל האירועים</span></article><article className="do-metric alert"><AlertTriangle /><strong>{allSignals.filter((item) => ["critical","urgent","high"].includes(item.severity)).length}</strong><span>דחופים</span></article><article className="do-metric"><Clock3 /><strong>{allSignals.filter((item) => ["needs_review","reviewing"].includes(item.review_status)).length}</strong><span>ממתינים לבדיקה</span></article><article className="do-metric good"><CheckCircle2 /><strong>{allSignals.filter((item) => ["confirmed","resolved","dismissed"].includes(item.review_status)).length}</strong><span>נבדקו</span></article></section>
    </div>
  </ObserverAppShell>;
}
