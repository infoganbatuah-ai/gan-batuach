import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Camera,
  CameraOff,
  CheckCircle2,
  Moon,
  Plus,
  Radar,
  ShieldCheck,
  Sparkles,
  UsersRound
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
  const currentPackage = runtime.packages.find((item) => item.id === currentSubscription?.package_id);
  const firstName = cleanSyntheticLabel(profile.full_name, mode === "home" ? "הבית שלך" : "העסק שלך").split(" ")[0];
  const isSynthetic = Boolean(selectedSite?.metadata?.qa_demo || selectedSite?.metadata?.is_demo || (profile as any).is_demo);

  return (
    <ObserverAppShell
      profile={profile}
      mode={mode}
      activeHref="/digital-observer/dashboard"
      title={mode === "home" ? "מסך הבית" : "סקירת העסק"}
      statusLabel={selectedSite?.monitoring_enabled ? "מצב ניטור פעיל" : "מצב הכנה בטוח"}
      actions={<Link className="do-button primary" href="/digital-observer/cameras/add"><Plus /> הוספת מצלמה</Link>}
    >
      <div className="do-page-stack">
        {!runtime.runtimeMigrationApplied ? (
          <div className="do-notice warn" role="status">
            <AlertTriangle />
            <div><strong>שכבת המוצר החדשה מוכנה בקוד וממתינה למיגרציה</strong><small>אין ערכי מצלמה חלופיים או סטטוס חי מזויף. לאחר החלת המיגרציה, מקורות המצלמה, הקלטות ואנשים מוכרים ייקשרו ישירות לאתר.</small></div>
          </div>
        ) : null}

        {selectedSite && entitlement.status === "trial" ? (
          <div className="do-notice info" role="status">
            <ShieldCheck />
            <div><strong>תקופת הניסיון פעילה עד {formatObserverDate(entitlement.trialEndsAt, { hour: undefined, minute: undefined })}</strong><small>אפשר להגדיר ולבדוק חיבור מצלמות. ניטור חי, AI והתראות חיצוניות יופעלו רק לאחר מנוי פעיל וחיבור ספקים מאושרים.</small></div>
          </div>
        ) : null}

        {selectedSite && entitlement.status === "suspended" ? (
          <div className="do-notice warn" role="status">
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
                <h2>הכול שקט בבית</h2>
                <p>{siteCameras.length ? `${activeCameras} מתוך ${siteCameras.length} מצלמות מחוברות` : "עדיין לא חוברה מצלמה"}. {openSignals.length ? `${openSignals.length} אירועים ממתינים לבדיקה.` : "אין אירוע חדש."}</p>
                {isSynthetic ? <span className="do-badge info">סביבה סינתטית לבדיקות</span> : null}
              </div>
              <div className="do-hero-shield"><ShieldCheck /></div>
            </section>

            <section className="do-section">
              <div className="do-section-head"><div><h2>המצלמות שלי</h2><p>תמונה חיה מוצגת רק כאשר Gateway מאובטח מחובר.</p></div><Link className="do-link" href="/digital-observer/cameras">צפייה בכל המצלמות</Link></div>
              {siteCameras.length ? (
                <div className="do-camera-grid">
                  {siteCameras.slice(0, 4).map((camera, index) => (
                    <Link href={`/digital-observer/cameras?camera=${camera.id}`} key={camera.id}>
                      <ObserverCameraMedia name={camera.display_name ?? "מצלמה"} mode="home" scene={camera.preview_scene ?? sceneFor(index, "home")} status={camera.status ?? camera.health_status} sourceMode={camera.source_mode} />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="do-empty"><CameraOff /><strong>אין מצלמות מחוברות</strong><span>אשף החיבור ישמור רק פרטי מוכנות. סיסמאות וכתובות RTSP אינן נשמרות בדפדפן.</span><Link className="do-button primary" href="/digital-observer/cameras/add">הוספת מצלמה</Link></div>
              )}
            </section>

            <section className="do-grid cols-2">
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

            <section className="do-grid cols-2">
              <article className="do-panel">
                <div className="do-section-head"><div><h2>פעילות אחרונה</h2><p>אירועים לפי זמן ורמת דחיפות.</p></div><Link className="do-link" href="/digital-observer/alerts">מרכז האירועים</Link></div>
                {siteSignals.length ? <div className="do-row-list">{siteSignals.slice(0, 6).map((signal) => <Link className="do-row" href={`/digital-observer/alerts?event=${signal.id}`} key={signal.id}><Radar /><span className="do-row-main"><strong>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</strong><small>{signal.recommended_action ?? "בדיקה אנושית מומלצת"}</small></span><span className="do-row-meta"><b className={badgeTone(signal.severity)}>{observerStatusLabel(signal.severity)}</b><time>{formatObserverDate(signal.created_at, { year: undefined, month: undefined, day: undefined })}</time></span></Link>)}</div> : <div className="do-empty"><Sparkles /><strong>אין אירועים להצגה</strong><span>המערכת לא ממציאה אירועים. הם יופיעו לאחר חיבור מצלמה וכלל ניטור.</span></div>}
              </article>
              <article className="do-panel">
                <div className="do-section-head"><div><h2>אתרים</h2><p>ניהול מספר סניפים מתוך אותו חשבון.</p></div><Link className="do-link" href="/digital-observer/sites">ניהול אתרים</Link></div>
                <div className="do-row-list">
                  {runtime.sites.map((site) => {
                    const cameras = runtime.cameras.filter((camera) => camera.observer_site_id === site.id);
                    const open = runtime.signals.filter((signal) => signal.observer_site_id === site.id && ["needs_review", "reviewing", "escalated"].includes(String(signal.review_status))).length;
                    return <Link className="do-row" href={`/digital-observer/dashboard?site=${site.id}`} key={site.id}><UsersRound /><span className="do-row-main"><strong>{cleanSyntheticLabel(site.name, "אתר")}</strong><small>{site.address || observerStatusLabel(site.site_type)}</small></span><span className="do-row-meta"><b>{cameras.length} מצלמות</b><small>{open} אירועים פתוחים</small></span></Link>;
                  })}
                </div>
              </article>
            </section>

            <section className="do-section">
              <div className="do-section-head"><div><h2>מצלמות פעילות</h2><p>סטטוס אמיתי או מצב חיבור גלוי, ללא תווית LIVE מזויפת.</p></div><Link className="do-link" href="/digital-observer/cameras">כל המצלמות</Link></div>
              {siteCameras.length ? <div className="do-camera-grid">{siteCameras.slice(0, 6).map((camera, index) => <Link href={`/digital-observer/cameras?camera=${camera.id}`} key={camera.id}><ObserverCameraMedia name={camera.display_name ?? "מצלמה"} mode="business" scene={camera.preview_scene ?? sceneFor(index, "business")} status={camera.status ?? camera.health_status} sourceMode={camera.source_mode} /></Link>)}</div> : <div className="do-empty"><CameraOff /><strong>אין מקורות מצלמה באתר</strong><span>הוסף מקור IP, NVR/DVR, ONVIF, ספק ענן או Gateway. אין צורך לחשוף סיסמה ללקוח.</span><Link className="do-button primary" href="/digital-observer/cameras/add">הוספת מצלמה</Link></div>}
            </section>
          </>
        )}

        {selectedSite ? (
          <section className="do-grid cols-4">
            <Link className="do-panel" href="/digital-observer/cameras"><Camera /><h3>צפייה ומצלמות</h3><p>רשימת מקורות, בריאות וחיבור מאובטח.</p></Link>
            <Link className="do-panel" href="/digital-observer/rules"><Radar /><h3>מה חשוב לך?</h3><p>יצירת כלל ניטור מובנה עם שעות ונמענים.</p></Link>
            <Link className="do-panel" href="/digital-observer/billing"><ShieldCheck /><h3>{currentPackage?.name ?? "חבילה טרם נבחרה"}</h3><p>{currentSubscription ? observerStatusLabel(currentSubscription.subscription_status ?? currentSubscription.status) : "מוכן לבחירה"}</p></Link>
            <Link className="do-panel" href="/digital-observer/people"><UsersRound /><h3>אנשים והרשאות</h3><p>שיתוף מבוקר והסכמה נפרדת לזיהוי.</p></Link>
          </section>
        ) : null}
      </div>
    </ObserverAppShell>
  );
}
