import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell, Camera, Clock3, MapPin, Plus, Radar, Settings2, ShieldCheck } from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { ObserverCameraMedia } from "@/components/digital-observer/observer-camera-media";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import {
  formatObserverDate,
  loadObserverRuntime,
  observerEventLabel,
  observerModeForSite,
  observerStatusLabel
} from "@/lib/domain/digital-observer/runtime";

type PageProps = { params: Promise<{ id: string }> };

function sceneFor(index: number, mode: "home" | "business") {
  const scenes = mode === "home"
    ? ["home-entry", "home-living", "home-yard", "home-nursery"]
    : ["business-entry", "business-store", "business-office", "business-warehouse"];
  return scenes[index % scenes.length];
}

export default async function DigitalObserverSitePage({ params }: PageProps) {
  const { id } = await params;
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/sites");
  const runtime = await loadObserverRuntime(profile.id);
  const site = runtime.sites.find((item) => item.id === id);
  if (!site) notFound();

  const mode = observerModeForSite(site);
  const cameras = runtime.cameras.filter((item) => item.observer_site_id === site.id);
  const signals = runtime.signals.filter((item) => item.observer_site_id === site.id);
  const openSignals = signals.filter((item) => ["needs_review", "reviewing", "escalated"].includes(String(item.review_status)));
  const schedule = runtime.schedules.find((item) => item.observer_site_id === site.id);
  const subscription = runtime.subscriptions.find((item) => item.observer_site_id === site.id);
  const packageItem = runtime.packages.find((item) => item.id === subscription?.package_id);
  const connected = cameras.filter((item) => ["connected", "healthy", "online"].includes(String(item.status || item.health_status))).length;

  return (
    <ObserverAppShell
      profile={profile}
      mode={mode}
      activeHref="/digital-observer/sites"
      title={cleanSyntheticLabel(site.name, mode === "home" ? "הבית שלי" : "העסק שלי")}
      statusLabel={site.monitoring_enabled ? "ניטור מוגדר" : "ממתין להגדרה"}
      actions={<Link className="do-button primary" href={`/digital-observer/cameras/add?site=${site.id}`}><Plus /> הוספת מצלמה</Link>}
    >
      <div className="do-page-stack">
        <section className="do-overview-banner">
          <div><span className="do-badge info">{observerStatusLabel(site.site_type)}</span><h2>{cleanSyntheticLabel(site.name, "אתר")}</h2><p><MapPin /> {site.address || "כתובת טרם הוגדרה"}</p></div>
          <ShieldCheck />
        </section>

        <section className="do-metrics">
          <article><Camera /><span>מצלמות</span><strong>{cameras.length}</strong><small>{connected} מחוברות בפועל</small></article>
          <article><Bell /><span>אירועים פתוחים</span><strong>{openSignals.length}</strong><small>דורשים בדיקה אנושית</small></article>
          <article><Clock3 /><span>לוח ניטור</span><strong>{schedule ? observerStatusLabel(schedule.schedule_mode) : "לא הוגדר"}</strong><small>{schedule?.status ? observerStatusLabel(schedule.status) : "מוכן להגדרה"}</small></article>
          <article><ShieldCheck /><span>מנוי</span><strong>{packageItem?.name || "טרם נבחר"}</strong><small>{subscription ? observerStatusLabel(subscription.subscription_status || subscription.status) : "ללא חיוב"}</small></article>
        </section>

        <section className="do-panel">
          <div className="do-section-head"><div><h2>מצלמות האתר</h2><p>תצוגה חיה תופעל רק דרך Gateway מאובטח. כרגע מוצג סטטוס המקור האמיתי.</p></div><Link className="do-link" href={`/digital-observer/cameras?site=${site.id}`}>ניהול מצלמות</Link></div>
          {cameras.length ? <div className="do-camera-grid">{cameras.map((camera, index) => <Link href={`/digital-observer/cameras?site=${site.id}&camera=${camera.id}`} key={camera.id}><ObserverCameraMedia name={camera.display_name || "מצלמה"} mode={mode} scene={camera.preview_scene || sceneFor(index, mode)} status={camera.status || camera.health_status} /></Link>)}</div> : <div className="do-empty"><Camera /><strong>עדיין אין מקורות מצלמה</strong><span>הוסיפו מצלמה מדומה או מקור שממתין לחיבור Gateway, בלי להזין סודות בדפדפן.</span><Link className="do-button primary" href={`/digital-observer/cameras/add?site=${site.id}`}>הוספת מצלמה</Link></div>}
        </section>

        <section className="do-dashboard-columns">
          <article className="do-panel">
            <div className="do-section-head"><div><h2>אירועים אחרונים</h2><p>הזיהויים מוצגים כהערכה ולא כקביעה.</p></div><Link className="do-link" href={`/digital-observer/alerts?site=${site.id}`}>מרכז האירועים</Link></div>
            {signals.length ? <div className="do-row-list">{signals.slice(0, 6).map((signal) => <Link className="do-row" href={`/digital-observer/alerts?event=${signal.id}`} key={signal.id}><Radar /><span className="do-row-main"><strong>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</strong><small>{signal.recommended_action || "מומלץ לבדוק"}</small></span><span className="do-row-meta"><b>{observerStatusLabel(signal.severity)}</b><time>{formatObserverDate(signal.created_at, { year: undefined, month: undefined, day: undefined })}</time></span></Link>)}</div> : <div className="do-empty"><ShieldCheck /><strong>אין אירועים להצגה</strong><span>המערכת אינה ממציאה פעילות שלא נקלטה.</span></div>}
          </article>
          <article className="do-panel">
            <div className="do-section-head"><div><h2>פעולות אתר</h2><p>כל פעולה מובילה למסך עובד או למצב מוכנות ברור.</p></div></div>
            <div className="do-settings-links compact">
              <Link href={`/digital-observer/rules?site=${site.id}`}><Radar /><span><strong>כללי ניטור</strong><small>מה לבדוק ומתי להתריע</small></span></Link>
              <Link href={`/digital-observer/settings?site=${site.id}`}><Settings2 /><span><strong>הגדרות</strong><small>שעות, ערוצים ופרטיות</small></span></Link>
              <Link href="/digital-observer/billing"><ShieldCheck /><span><strong>מנוי ושמירה</strong><small>חבילה ו-retention עד 48 שעות</small></span></Link>
            </div>
          </article>
        </section>
      </div>
    </ObserverAppShell>
  );
}
