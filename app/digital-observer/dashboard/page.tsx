import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bell,
  Camera,
  CameraOff,
  CheckCircle2,
  Moon,
  Plus,
  Radar,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { ObserverCameraMedia } from "@/components/digital-observer/observer-camera-media";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import {
  formatObserverDate,
  loadObserverRuntime,
  observerEventLabel,
  observerModeForSite,
  observerStatusLabel,
  resolveObserverEntitlement
} from "@/lib/domain/digital-observer/runtime";

type PageProps = { searchParams?: Promise<{ site?: string }> };

function sceneFor(index: number, mode: "home" | "business") {
  const home = ["home-entry", "home-living", "home-nursery", "home-yard"];
  const business = ["business-entry", "business-store", "business-warehouse", "business-office", "business-parking", "business-loading"];
  const scenes = mode === "home" ? home : business;
  return scenes[index % scenes.length];
}

function badgeTone(status?: string | null) {
  if (["connected", "healthy", "online", "active", "resolved"].includes(String(status))) return "do-badge good";
  if (["degraded", "testing", "needs_review", "reviewing"].includes(String(status))) return "do-badge warn";
  if (["offline", "failed", "blocked", "critical"].includes(String(status))) return "do-badge bad";
  return "do-badge info";
}

function activityBuckets(signals: any[]) {
  const bucketHours = 4;
  const bucketCount = 6;
  const now = Date.now();
  const start = now - bucketHours * bucketCount * 60 * 60 * 1000;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    count: 0,
    label: new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }).format(new Date(start + index * bucketHours * 60 * 60 * 1000))
  }));
  for (const signal of signals) {
    const timestamp = new Date(signal.created_at).getTime();
    const index = Math.floor((timestamp - start) / (bucketHours * 60 * 60 * 1000));
    if (Number.isFinite(timestamp) && index >= 0 && index < bucketCount) buckets[index].count += 1;
  }
  const maximum = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return buckets.map((bucket) => ({ ...bucket, percent: Math.max(bucket.count ? 12 : 3, Math.round((bucket.count / maximum) * 100)) }));
}

export default async function DigitalObserverDashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/dashboard");
  const runtime = await loadObserverRuntime(profile.id);
  const selectedSite = runtime.sites.find((site) => site.id === params?.site) ?? runtime.sites[0] ?? null;
  const mode = observerModeForSite(selectedSite);
  const siteCameras = selectedSite ? runtime.cameras.filter((camera) => camera.observer_site_id === selectedSite.id) : [];
  const siteSignals = selectedSite ? runtime.signals.filter((signal) => signal.observer_site_id === selectedSite.id) : [];
  const openSignals = siteSignals.filter((signal) => ["needs_review", "reviewing", "escalated"].includes(String(signal.review_status)));
  const activeCameras = siteCameras.filter((camera) => ["connected", "healthy", "online", "active"].includes(String(camera.status ?? camera.health_status))).length;
  const currentSubscription = selectedSite ? runtime.subscriptions.find((item) => item.observer_site_id === selectedSite.id) : null;
  const entitlement = resolveObserverEntitlement(currentSubscription);
  const isSynthetic = Boolean(selectedSite?.metadata?.qa_demo || selectedSite?.metadata?.is_demo || (profile as any).is_demo);
  const businessActivity = activityBuckets(siteSignals);

  return (
    <ObserverAppShell
      profile={profile}
      mode={mode}
      activeHref="/digital-observer/dashboard"
      title={mode === "home" ? "מסך הבית" : "סקירת העסק"}
      statusLabel={selectedSite?.monitoring_enabled ? "מצב ניטור פעיל" : "מצב הכנה בטוח"}
    >
      <div className={`do-page-stack do-dashboard do-dashboard-${mode}`}>
        {!runtime.runtimeMigrationApplied ? (
          <div className="do-notice warn" role="status">
            <AlertTriangle />
            <div><strong>שכבת המוצר החדשה מוכנה בקוד וממתינה למיגרציה</strong><small>אין ערכי מצלמה חלופיים או סטטוס חי מזויף. לאחר החלת המיגרציה, מקורות המצלמה, הקלטות ואנשים מוכרים ייקשרו ישירות לאתר.</small></div>
          </div>
        ) : null}

        {selectedSite && entitlement.status === "trial" ? (
          <div className="do-notice info do-dashboard-trial-strip" role="status">
            <ShieldCheck />
            <div><strong>תקופת הניסיון פעילה עד {formatObserverDate(entitlement.trialEndsAt, { hour: undefined, minute: undefined })}</strong><small>אפשר להגדיר ולבדוק חיבור מצלמות. ניטור חי, AI והתראות חיצוניות יופעלו רק לאחר מנוי פעיל וחיבור ספקים מאושרים.</small></div>
          </div>
        ) : null}

        {selectedSite && entitlement.status === "suspended" ? (
          <div className="do-notice warn do-dashboard-trial-strip" role="status">
            <AlertTriangle />
            <div><strong>תקופת הניסיון הסתיימה והשירות מושהה</strong><small>בדיקת חיבור המצלמות והגדרות המוכנות נשארות זמינות. צפייה חיה, ניטור AI והתראות חיצוניות אינם פעילים עד הסדרת מנוי.</small></div>
          </div>
        ) : null}

        {!selectedSite ? (
          <section className="do-empty">
            <ShieldCheck />
            <strong>בואו נגדיר את המקום הראשון שלכם</strong>
            <span>בחרו בית או עסק, הגדירו מה חשוב לכם וחברו מצלמה במצב בדיקה.</span>
            <Link className="do-button primary" href="/digital-observer/onboarding">תחילת הקמה</Link>
          </section>
        ) : mode === "home" ? (
          <>
            <section className="do-home-hero">
              <div>
                <h2>{openSignals.length ? "יש אירועים שמחכים לבדיקה" : siteCameras.length ? "הכול שקט לפי המידע שנקלט" : "מוכנים לחבר את הבית"}</h2>
                <p>{siteCameras.length ? `${activeCameras} מתוך ${siteCameras.length} מצלמות מחוברות` : "עדיין לא חוברה מצלמה"}. {openSignals.length ? `${openSignals.length} אירועים ממתינים לבדיקה.` : "אין אירוע חדש."}</p>
                {isSynthetic ? <span className="do-badge info">סביבה סינתטית לבדיקות</span> : null}
              </div>
              <div className="do-hero-shield"><ShieldCheck /></div>
            </section>

            <section className="do-section do-dashboard-camera-first">
              <div className="do-section-head"><div><h2>המצלמות שלי</h2><p>תמונה חיה מוצגת רק כאשר Gateway מאובטח מחובר.</p></div><div className="do-section-actions"><Link className="do-link" href="/digital-observer/cameras">כל המצלמות</Link><Link className="do-icon-button accent" href={`/digital-observer/cameras/add?site=${selectedSite.id}`} aria-label="הוספת מצלמה"><Plus /></Link></div></div>
              {siteCameras.length ? (
                <div className="do-camera-grid">
                  {siteCameras.slice(0, 4).map((camera, index) => (
                    <Link className="do-dashboard-camera-card" href={`/digital-observer/cameras?camera=${camera.id}`} key={camera.id}>
                      <ObserverCameraMedia name={camera.display_name ?? "מצלמה"} mode="home" scene={camera.preview_scene ?? sceneFor(index, "home")} status={camera.status ?? camera.health_status} sourceMode={camera.source_mode} />
                      <span className="do-dashboard-camera-copy"><strong>{camera.display_name ?? "מצלמה"}</strong><small>{["connected", "healthy", "online", "active"].includes(String(camera.status ?? camera.health_status)) ? "מקור מחובר" : camera.source_mode === "demo" ? "תרחיש הדגמה" : "מוכן לחיבור"}</small></span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="do-empty"><CameraOff /><strong>אין מצלמות מחוברות</strong><span>אשף החיבור ישמור רק פרטי מוכנות. סיסמאות וכתובות RTSP אינן נשמרות בדפדפן.</span><Link className="do-button primary" href={`/digital-observer/cameras/add?site=${selectedSite.id}`}>הוספת מצלמה</Link></div>
              )}
            </section>

            <section className="do-home-dashboard-lower">
              <article className="do-panel">
                <div className="do-section-head"><div><h2>אירועים אחרונים</h2><p>כל זיהוי הוא המלצה לבדיקה, לא עובדה מוחלטת.</p></div><Link className="do-link" href="/digital-observer/alerts">הצגת הכול</Link></div>
                {siteSignals.length ? <div className="do-row-list">{siteSignals.slice(0, 4).map((signal) => <Link className="do-row" href={`/digital-observer/alerts?event=${signal.id}`} key={signal.id}><Radar /><span className="do-row-main"><strong>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</strong><small>{signal.recommended_action ?? "בדיקה אנושית מומלצת"}</small></span><span className="do-row-meta"><b className={badgeTone(signal.review_status)}>{observerStatusLabel(signal.review_status)}</b><time>{formatObserverDate(signal.created_at, { year: undefined, month: undefined, day: undefined })}</time></span></Link>)}</div> : <div className="do-empty"><CheckCircle2 /><strong>אין אירועים חדשים</strong><span>אירועים אמיתיים או סינתטיים יופיעו רק לאחר חיבור מקור והפעלת כלל ניטור.</span></div>}
              </article>
              <article className="do-panel">
                <div className="do-section-head"><div><h2>מצב הבית</h2><p>סיכום שנגזר מהנתונים המחוברים.</p></div></div>
                <div className="do-row-list">
                  <div className="do-row"><Camera /><span className="do-row-main"><strong>מצלמות פעילות</strong><small>{siteCameras.length ? `${activeCameras} מתוך ${siteCameras.length}` : "טרם חוברו"}</small></span><span className={activeCameras === siteCameras.length && siteCameras.length ? "do-badge good" : "do-badge warn"}>{siteCameras.length ? observerStatusLabel(activeCameras === siteCameras.length ? "healthy" : "degraded") : "מוכן להגדרה"}</span></div>
                  <div className="do-row"><Bell /><span className="do-row-main"><strong>התראות פתוחות</strong><small>{openSignals.length ? `${openSignals.length} לבדיקה` : "אין"}</small></span><span className={openSignals.length ? "do-badge warn" : "do-badge good"}>{openSignals.length ? "דורש תשומת לב" : "שקט"}</span></div>
                  <div className="do-row"><Moon /><span className="do-row-main"><strong>שעות שקטות</strong><small>{runtime.schedules.find((item) => item.observer_site_id === selectedSite.id)?.schedule_mode ? observerStatusLabel(runtime.schedules.find((item) => item.observer_site_id === selectedSite.id)?.schedule_mode) : "טרם הוגדרו"}</small></span><Link className="do-link" href="/digital-observer/settings">עריכה</Link></div>
                </div>
              </article>
            </section>
          </>
        ) : (
          <>
            <section className="do-business-summary">
              <article className="do-metric good"><ShieldCheck /><strong>{siteCameras.length && !openSignals.length ? "תקין" : "בדיקה"}</strong><span>סטטוס כללי</span></article>
              <article className="do-metric"><Camera /><strong>{activeCameras}</strong><span>מצלמות פעילות מתוך {siteCameras.length}</span></article>
              <article className="do-metric"><CameraOff /><strong>{Math.max(0, siteCameras.length - activeCameras)}</strong><span>מצלמות לא פעילות</span></article>
              <article className="do-metric alert"><Bell /><strong>{openSignals.length}</strong><span>אירועים פתוחים</span></article>
              <article className="do-metric"><Moon /><strong>{selectedSite.monitoring_enabled ? "פעיל" : "הכנה"}</strong><span>ניטור מחוץ לשעות</span></article>
            </section>

            <section className="do-business-dashboard-core">
              <article className="do-panel do-activity-panel">
                <div className="do-section-head"><div><h2>פעילות אחרונה</h2><p>אירועים לפי זמן ורמת דחיפות.</p></div><Link className="do-link" href="/digital-observer/alerts">מרכז האירועים</Link></div>
                <div className="do-activity-chart" aria-label="פעילות ב-24 השעות האחרונות">
                  <div className="do-activity-chart-head"><span><Activity /> פעילות ב-24 השעות האחרונות</span><strong>{businessActivity.reduce((sum, bucket) => sum + bucket.count, 0)} אירועים</strong></div>
                  <div className="do-activity-bars">{businessActivity.map((bucket) => <span key={bucket.label}><i style={{ height: `${bucket.percent}%` }} /><b>{bucket.count}</b><small>{bucket.label}</small></span>)}</div>
                </div>
                {siteSignals.length ? <div className="do-row-list">{siteSignals.slice(0, 6).map((signal) => <Link className="do-row" href={`/digital-observer/alerts?event=${signal.id}`} key={signal.id}><Radar /><span className="do-row-main"><strong>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</strong><small>{signal.recommended_action ?? "בדיקה אנושית מומלצת"}</small></span><span className="do-row-meta"><b className={badgeTone(signal.severity)}>{observerStatusLabel(signal.severity)}</b><time>{formatObserverDate(signal.created_at, { year: undefined, month: undefined, day: undefined })}</time></span></Link>)}</div> : <div className="do-empty"><Sparkles /><strong>אין אירועים להצגה</strong><span>המערכת לא ממציאה אירועים. הם יופיעו לאחר חיבור מצלמה וכלל ניטור.</span></div>}
              </article>
              <article className="do-panel do-open-events-panel">
                <div className="do-section-head"><div><h2>אירועים פתוחים</h2><p>אירועים שממתינים לבדיקה אנושית.</p></div><Link className="do-link" href="/digital-observer/alerts">צפו בכל האירועים</Link></div>
                {openSignals.length ? <div className="do-row-list">{openSignals.slice(0, 6).map((signal) => <Link className="do-row" href={`/digital-observer/alerts?event=${signal.id}`} key={signal.id}><Radar /><span className="do-row-main"><strong>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</strong><small>{signal.recommended_action ?? "בדיקה אנושית מומלצת"}</small></span><span className="do-row-meta"><b className={badgeTone(signal.severity)}>{observerStatusLabel(signal.severity)}</b><time>{formatObserverDate(signal.created_at, { year: undefined, month: undefined, day: undefined })}</time></span></Link>)}</div> : <div className="do-empty compact"><CheckCircle2 /><strong>אין אירועים פתוחים</strong><span>אירועים שיוגדרו לבדיקה יופיעו כאן.</span></div>}
              </article>
            </section>

            <section className="do-section">
              <div className="do-section-head"><div><h2>מצלמות פעילות</h2><p>סטטוס אמיתי או מצב חיבור גלוי, ללא תווית LIVE מזויפת.</p></div><Link className="do-link" href="/digital-observer/cameras">כל המצלמות</Link></div>
              {siteCameras.length ? <div className="do-camera-grid">{siteCameras.slice(0, 6).map((camera, index) => <Link className="do-dashboard-camera-card" href={`/digital-observer/cameras?camera=${camera.id}`} key={camera.id}><ObserverCameraMedia name={camera.display_name ?? "מצלמה"} mode="business" scene={camera.preview_scene ?? sceneFor(index, "business")} status={camera.status ?? camera.health_status} sourceMode={camera.source_mode} /><span className="do-dashboard-camera-copy"><strong>{camera.display_name ?? "מצלמה"}</strong><small>{["connected", "healthy", "online", "active"].includes(String(camera.status ?? camera.health_status)) ? "מקור מחובר" : camera.source_mode === "demo" ? "תרחיש הדגמה" : "מוכן לחיבור"}</small></span></Link>)}</div> : <div className="do-empty"><CameraOff /><strong>אין מקורות מצלמה באתר</strong><span>הוסף מקור IP, NVR/DVR, ONVIF, ספק ענן או Gateway. אין צורך לחשוף סיסמה ללקוח.</span><Link className="do-button primary" href="/digital-observer/cameras/add">הוספת מצלמה</Link></div>}
            </section>
          </>
        )}

      </div>
    </ObserverAppShell>
  );
}
