import Link from "next/link";
import {
  Activity,
  BellRing,
  BrainCircuit,
  Building2,
  Camera,
  CircleDollarSign,
  Gauge,
  House,
  MapPinned,
  Radar,
  ServerCog,
  ShieldCheck,
  TrendingUp,
  UsersRound
} from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireDigitalObserverAdmin } from "@/lib/domain/digital-observer/admin-access";
import { loadDigitalObserverAdminRuntime } from "@/lib/domain/digital-observer/admin-runtime";
import { formatObserverDate, observerStatusLabel } from "@/lib/domain/digital-observer/runtime";
import { getDigitalObserverServiceReadiness } from "@/lib/domain/digital-observer/service-readiness";

function percentage(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function latestSevenDays(signals: Record<string, any>[]) {
  const now = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now);
    day.setDate(now.getDate() - (6 - index));
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(day);
    const label = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", weekday: "short" }).format(day);
    return {
      key,
      label,
      count: signals.filter((signal) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(signal.created_at)) === key).length
    };
  });
}

function mapPosition(site: Record<string, any>) {
  const lat = Number(site.latitude);
  const lng = Number(site.longitude);
  return {
    insetInlineStart: `${Math.max(7, Math.min(91, ((lng + 180) / 360) * 100))}%`,
    top: `${Math.max(9, Math.min(86, ((90 - lat) / 180) * 100))}%`
  };
}

export default async function DigitalObserverAdminPage() {
  const { profile, observerAdmin } = await requireDigitalObserverAdmin();
  const runtime = await loadDigitalObserverAdminRuntime();
  const readiness = getDigitalObserverServiceReadiness();
  const homes = runtime.sites.filter((site) => site.site_type === "home");
  const businesses = runtime.sites.filter((site) => site.site_type === "business");
  const activeCameras = runtime.cameras.filter((camera) => ["active", "connected", "online", "healthy"].includes(String(camera.status ?? camera.health_status)));
  const openSignals = runtime.signals.filter((signal) => ["needs_review", "reviewing", "escalated"].includes(String(signal.review_status)));
  const highSignals = openSignals.filter((signal) => ["high", "urgent", "critical"].includes(String(signal.severity)));
  const activeSubscriptions = runtime.subscriptions.filter((subscription) => ["trial", "active"].includes(String(subscription.status ?? subscription.subscription_status)));
  const trends = latestSevenDays(runtime.signals);
  const maxTrend = Math.max(1, ...trends.map((item) => item.count));
  const frequentTypes = Object.entries(runtime.signals.reduce<Record<string, number>>((summary, signal) => {
    const key = String(signal.signal_type ?? signal.source_type ?? "unknown");
    summary[key] = (summary[key] ?? 0) + 1;
    return summary;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const locatedSites = runtime.sites.filter((site) => site.city || site.formatted_address || (site.latitude && site.longitude)).slice(0, 10);
  const mappedSites = locatedSites.filter((site) => Number.isFinite(Number(site.latitude)) && Number.isFinite(Number(site.longitude)));

  return (
    <ObserverAppShell profile={profile} mode="admin" activeHref="/digital-observer/admin" title="מרכז בקרה" statusLabel="בקרת תצפיתן עצמאית">
      <div className="do-page-stack do-admin-control-center">
        <section className="do-admin-hero">
          <div>
            <span className="do-eyebrow">תמונת מצב מערכת</span>
            <h2>התצפיתן מנוהל ממקום אחד</h2>
            <p>אתרים, מצלמות, אירועים, תורים ומנויים מוצגים מנתוני המערכת. שירות שאינו חי מסומן כמוכנות או הדמיה.</p>
          </div>
          <div className="do-admin-engine-state"><BrainCircuit /><strong>{readiness.ai.live ? "פעיל" : "Shadow"}</strong><span>מנוע תצפיתן</span><small>ביקורת אנושית נדרשת</small></div>
        </section>

        {!runtime.dataAvailable ? <div className="do-notice warn" role="status"><ServerCog /><span>חלק ממקורות הנתונים אינם זמינים. לא מוצגים מספרים חלופיים או הצלחה מזויפת.</span></div> : null}
        <div className="do-notice info"><ShieldCheck /><span>הרשאה: {observerAdmin.scope === "digital_observer_only" ? "Admin תצפיתן בלבד" : "Admin ותיק לצורכי מעבר"}. אין גישה אוטומטית למדיה פרטית, פרטי מצלמה סודיים או פרטי תשלום.</span></div>

        <section className="do-admin-kpis" aria-label="מדדי מערכת">
          <article><UsersRound /><span>לקוחות ואתרים</span><strong>{runtime.sites.length}</strong><small>{homes.length} ביתי · {businesses.length} עסקי</small></article>
          <article><Camera /><span>מצלמות מחוברות</span><strong>{activeCameras.length}<small>/{runtime.cameras.length}</small></strong><small>{percentage(activeCameras.length, runtime.cameras.length)}% מדווחות תקינות</small></article>
          <article className={openSignals.length ? "attention" : ""}><BellRing /><span>תור בדיקה</span><strong>{openSignals.length}</strong><small>{highSignals.length} בדחיפות גבוהה</small></article>
          <article><CircleDollarSign /><span>מנויים פעילים/ניסיון</span><strong>{activeSubscriptions.length}</strong><small>חיוב חי: כבוי</small></article>
        </section>

        <section className="do-admin-dashboard-grid">
          <article className="do-panel do-admin-map-panel">
            <div className="do-section-head"><div><h2>מפת לקוחות ואתרים מורשים</h2><p>כתובות מאומתות ומטא-דאטה מיקומי בלבד; אין הצגת וידאו.</p></div><Link className="do-link" href="/digital-observer/admin/access">ניהול אתרים</Link></div>
            {locatedSites.length ? <>
              <div className="do-admin-map" aria-label="מפת אתרי תצפיתן">
                <div className="do-admin-map-grid" />
                {mappedSites.map((site) => <span className={`do-admin-map-pin ${site.site_type === "home" ? "home" : "business"}`} style={mapPosition(site)} title={`${site.name} · ${site.city ?? site.formatted_address ?? "כתובת חלקית"}`} key={site.id}>{site.site_type === "home" ? <House /> : <Building2 />}</span>)}
                {!mappedSites.length ? <div className="do-admin-map-empty"><MapPinned /><strong>נדרשות קואורדינטות מאומתות</strong><span>כתובות ללא מיקום מדויק מופיעות ברשימה בלבד.</span></div> : null}
                <div className="do-admin-map-legend"><span><i className="home" />ביתי</span><span><i className="business" />עסקי</span></div>
              </div>
              <div className="do-admin-location-list">{locatedSites.slice(0, 4).map((site) => <div key={site.id}><MapPinned /><span><strong>{site.name}</strong><small>{site.city ?? site.formatted_address ?? "כתובת חלקית"}</small></span><b>{observerStatusLabel(site.observer_runtime_status ?? (site.active === false ? "disabled" : "readiness"))}</b></div>)}</div>
            </> : <div className="do-empty"><MapPinned /><strong>אין עדיין מיקומים מאומתים להצגה</strong><span>המערכת לא ממציאה נקודות מפה.</span></div>}
          </article>

          <article className="do-panel do-admin-trend-panel">
            <div className="do-section-head"><div><h2>אירועים ומגמה</h2><p>שבעת הימים האחרונים לפי זמן ישראל.</p></div><TrendingUp /></div>
            <div className="do-admin-trend" aria-label="מגמת אירועים בשבעה ימים">{trends.map((item) => <div key={item.key}><span style={{ height: `${Math.max(5, (item.count / maxTrend) * 100)}%` }} /><strong>{item.count}</strong><small>{item.label}</small></div>)}</div>
            <div className="do-admin-type-list">{frequentTypes.length ? frequentTypes.map(([type, count]) => <div key={type}><span>{observerStatusLabel(type)}</span><i><b style={{ width: `${percentage(count, Math.max(1, runtime.signals.length))}%` }} /></i><strong>{count}</strong></div>) : <div className="do-empty compact"><Activity /><strong>אין אירועים מתועדים</strong></div>}</div>
          </article>
        </section>

        <section className="do-grid cols-2">
          <article className="do-panel">
            <div className="do-section-head"><div><h2>בריאות מנוע ושירותים</h2><p>מצב תצורה אמיתי, ללא ירוק אוטומטי.</p></div><Link className="do-link" href="/digital-observer/admin/operations">מרכז תפעול</Link></div>
            <div className="do-admin-service-grid">
              <div><Camera /><span><strong>Gateway מצלמות</strong><small>DVR/NVR נשמר לשלב האחרון</small></span><b className="do-badge warn">{observerStatusLabel(readiness.cameraGateway.state)}</b></div>
              <div><BrainCircuit /><span><strong>AI ותצפיתן</strong><small>Shadow + החלטה אנושית</small></span><b className="do-badge info">{observerStatusLabel(readiness.ai.state)}</b></div>
              <div><BellRing /><span><strong>הודעות חיצוניות</strong><small>אין שליחה חיה</small></span><b className="do-badge warn">{observerStatusLabel(readiness.notifications.sms)}</b></div>
              <div><CircleDollarSign /><span><strong>חיוב וחשבוניות</strong><small>Mock / Sandbox בלבד</small></span><b className="do-badge info">{observerStatusLabel(readiness.billing.state)}</b></div>
            </div>
          </article>

          <article className="do-panel" id="queues">
            <div className="do-section-head"><div><h2>תורים ובקרות תצפיתן</h2><p>פעולה אנושית לפני הסלמה או שינוי מדיניות.</p></div><Radar /></div>
            <div className="do-admin-queue-list">
              <Link href="/digital-observer/admin/operations#ai"><span><BrainCircuit /><b>אירועים לבדיקה</b></span><strong>{openSignals.length}</strong></Link>
              <Link href="/digital-observer/admin/operations#notifications"><span><BellRing /><b>מסירות התראה מתועדות</b></span><strong>{runtime.deliveries.length}</strong></Link>
              <Link href="/digital-observer/admin/operations#policies"><span><ShieldCheck /><b>כללי ניטור פעילים</b></span><strong>{runtime.watchRequests.filter((item) => item.active !== false).length}</strong></Link>
              <Link href="/digital-observer/admin/operations#learning"><span><Gauge /><b>אתרים בתהליך למידה</b></span><strong>{runtime.learning.filter((item) => !["stable", "ready"].includes(String(item.learning_maturity))).length}</strong></Link>
            </div>
          </article>
        </section>

        <section className="do-panel do-admin-sites-table">
          <div className="do-section-head"><div><h2>אתרים, מצלמות ומנויים</h2><p>מקורות הנתונים של מרכז הבקרה.</p></div><Link className="do-link" href="/digital-observer/admin/billing">ניהול מנויים</Link></div>
          {runtime.sites.length ? <div className="do-admin-table" role="table">
            <div className="do-admin-table-head" role="row"><span>אתר</span><span>סוג</span><span>מצלמות</span><span>אירועים פתוחים</span><span>מנוי</span><span>עדכון</span></div>
            {runtime.sites.slice(0, 12).map((site) => {
              const cameras = runtime.cameras.filter((camera) => camera.observer_site_id === site.id);
              const signals = openSignals.filter((signal) => signal.observer_site_id === site.id);
              const subscription = runtime.subscriptions.find((item) => item.observer_site_id === site.id);
              return <div className="do-admin-table-row" role="row" key={site.id}><span><b>{site.name}</b><small>{site.city ?? "כתובת טרם אומתה"}</small></span><span><i className={`do-badge ${site.site_type === "home" ? "info" : "good"}`}>{observerStatusLabel(site.site_type)}</i></span><span>{cameras.length}</span><span>{signals.length}</span><span>{observerStatusLabel(subscription?.status ?? subscription?.subscription_status ?? "readiness")}</span><span>{formatObserverDate(site.created_at, { year: undefined })}</span></div>;
            })}
          </div> : <div className="do-empty"><Building2 /><strong>אין אתרי תצפיתן עצמאיים</strong><span>לא מוצגים נתוני גן בטוח במקום נתוני התצפיתן.</span></div>}
        </section>
      </div>
    </ObserverAppShell>
  );
}
