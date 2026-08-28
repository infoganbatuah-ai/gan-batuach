import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Building2,
  Camera,
  CameraOff,
  CheckCircle2,
  LayoutGrid,
  List,
  MapPin,
  Moon,
  Plus,
  Radar,
  ShieldCheck
} from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { ObserverCameraMedia } from "@/components/digital-observer/observer-camera-media";
import { ObserverCameraPresence } from "@/components/digital-observer/observer-camera-presence";
import { ObserverLivePlayer } from "@/components/digital-observer/observer-live-player";
import { ObserverRuntimePulse } from "@/components/digital-observer/observer-runtime-pulse";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { digitalObserverCameraHasLiveGateway } from "@/lib/domain/digital-observer/camera-live-status";
import { observerEventNarrative } from "@/lib/domain/digital-observer/event-narrative";
import {
  formatObserverDate,
  loadObserverRuntime,
  observerCameraForSignal,
  observerClipForSignal,
  observerClipHasRequiredMedia,
  observerEventLabel,
  observerModeForSite,
  observerStatusLabel
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
    reviewCount: 0,
    label: new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }).format(new Date(start + index * bucketHours * 60 * 60 * 1000))
  }));
  for (const signal of signals) {
    const timestamp = new Date(signal.created_at).getTime();
    const index = Math.floor((timestamp - start) / (bucketHours * 60 * 60 * 1000));
    if (Number.isFinite(timestamp) && index >= 0 && index < bucketCount) {
      buckets[index].count += 1;
      if (["needs_review", "reviewing", "escalated"].includes(String(signal.review_status))) buckets[index].reviewCount += 1;
    }
  }
  const maximum = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return buckets.map((bucket) => ({
    ...bucket,
    percent: Math.max(bucket.count ? 12 : 3, Math.round((bucket.count / maximum) * 100)),
    reviewPercent: Math.max(bucket.reviewCount ? 12 : 3, Math.round((bucket.reviewCount / maximum) * 100))
  }));
}

function chartPoints(values: number[]) {
  const width = 520;
  const height = 112;
  return values.map((value, index) => `${Math.round((index / Math.max(1, values.length - 1)) * width)},${height - Math.round((value / 100) * height)}`).join(" ");
}

function siteAddressLabel(site: Record<string, any> | null) {
  if (!site) return "כתובת טרם הוגדרה";
  const base = site.formatted_address || site.address || [site.street, site.building_number, site.city].filter(Boolean).join(" ");
  const level = site.floor_kind === "ground" ? "קומת קרקע" : Number.isInteger(site.floor_number) ? `קומה ${site.floor_number}` : "";
  return [base, site.apartment_number ? `דירה ${site.apartment_number}` : "", level].filter(Boolean).join(" · ") || "כתובת טרם הושלמה";
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
  const reviewableOpenSignals = openSignals.filter((signal) => observerClipHasRequiredMedia(observerClipForSignal(signal, runtime.clips)) && Boolean(observerCameraForSignal(signal, siteCameras)));
  const urgentSignals = openSignals.filter((signal) => ["critical", "urgent", "high"].includes(String(signal.severity)));
  const liveCameras = siteCameras.filter((camera) => camera.source_mode === "live" && ["connected", "online", "active"].includes(String(camera.status))).length;
  const readyCameras = siteCameras.filter((camera) => ["connected", "healthy", "online", "active", "ready_to_test", "testing"].includes(String(camera.status)) || camera.health_status === "healthy").length;
  const businessActivity = activityBuckets(siteSignals);
  const businessActivityTotal = businessActivity.reduce((sum, bucket) => sum + bucket.count, 0);
  const latestSignalAt = siteSignals[0]?.created_at ?? null;
  const latestLearningAt = selectedSite ? runtime.baselines.filter((baseline) => baseline.observer_site_id === selectedSite.id).map((baseline) => baseline.updated_at).filter(Boolean).sort().at(-1) ?? null : null;

  return (
    <ObserverAppShell
      profile={profile}
      mode={mode}
      activeHref="/digital-observer/dashboard"
      title={mode === "home" ? "תצפיתן דיגיטלי" : "סקירת העסק"}
      statusLabel={selectedSite?.monitoring_enabled ? "מצב ניטור פעיל" : "מצב הכנה בטוח"}
    >
      <div className={`do-page-stack do-dashboard do-dashboard-${mode}`}>
        {!runtime.runtimeMigrationApplied ? (
          <div className="do-notice warn" role="status">
            <AlertTriangle />
            <div><strong>שכבת המוצר החדשה מוכנה בקוד וממתינה למיגרציה</strong><small>אין ערכי מצלמה חלופיים או סטטוס חי מזויף. לאחר החלת המיגרציה, מקורות המצלמה, הקלטות ואנשים מוכרים ייקשרו ישירות לאתר.</small></div>
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
            <section className="do-home-dashboard-frame">
              <div className="do-home-hero">
                <Image className="do-home-hero-illustration" src="/assets/digital-observer/account-home-v1.png" alt="" width={700} height={700} priority />
                <div className="do-hero-shield"><ShieldCheck /></div>
                <div>
                  <h2>{urgentSignals.length ? "יש אירוע דחוף שמחכה לבדיקה" : siteCameras.length ? <><span className="do-home-calm-desktop">הכול שקט בבית</span><span className="do-home-calm-mobile">הכול שקט</span></> : "מוכנים לחבר את הבית"}</h2>
                  <p>{siteCameras.length ? `הבית שלך מוגן לפי ${siteCameras.length} מקורות שהוגדרו.` : "חברו מצלמה ראשונה כדי להתחיל."} {urgentSignals.length ? `${urgentSignals.length} אירועים דחופים ממתינים לבדיקה.` : "אין אירועים דחופים."}</p>
                  <ObserverRuntimePulse observerSiteId={selectedSite.id} initial={{ checked_at: new Date().toISOString(), camera_count: siteCameras.length, connected_camera_count: liveCameras, open_event_count: openSignals.length, last_event_at: latestSignalAt, last_learning_at: latestLearningAt }} compact />
                </div>
              </div>

              <div className="do-home-cameras-head"><h2>מצלמות</h2><div className="do-section-actions do-home-camera-view-actions"><Link className="do-link" href="/digital-observer/cameras">צפייה חיה</Link><span className="do-home-camera-view-toggle" aria-label="אפשרויות תצוגה"><Link href="/digital-observer/cameras?view=grid" aria-label="תצוגת גריד"><LayoutGrid /></Link><Link href="/digital-observer/cameras?view=list" aria-label="תצוגת רשימה"><List /></Link></span><Link className="do-icon-button accent do-home-camera-add" href={`/digital-observer/cameras/add?site=${selectedSite.id}`} aria-label="הוספת מצלמה"><Plus /></Link></div></div>
              {siteCameras.length ? (
                <div className="do-camera-grid">
                  {siteCameras.slice(0, 4).map((camera, index) => {
                    const hasLiveGateway = digitalObserverCameraHasLiveGateway(camera);
                    return (
                      <Link className="do-dashboard-camera-card" href={`/digital-observer/cameras?camera=${camera.id}`} key={camera.id}>
                        {hasLiveGateway ? <ObserverLivePlayer compact observerSiteId={selectedSite.id} cameraSourceId={camera.id} name={camera.display_name ?? "מצלמה"} /> : <ObserverCameraMedia name={camera.display_name ?? "מצלמה"} mode="home" scene={camera.preview_scene ?? sceneFor(index, "home")} status={camera.status ?? camera.health_status} sourceMode={camera.source_mode} />}
                        <ObserverCameraPresence active={hasLiveGateway} />
                        <span className="do-dashboard-camera-copy"><strong>{camera.display_name ?? "מצלמה"}</strong><small>{hasLiveGateway ? "שידור חי דרך Gateway" : ["offline", "failed", "error"].includes(String(camera.status ?? camera.health_status)) ? "Offline · אין שידור מה-DVR" : camera.source_mode === "demo" ? "תרחיש הדגמה" : "מוכן לחיבור"}</small></span>
                      </Link>
                    );
                  })}
                  {siteCameras.length < 4 ? <Link className="do-camera-add-slot" href={`/digital-observer/cameras/add?site=${selectedSite.id}`}><Plus /><span>הוספת מצלמה</span><small>מקור חדש</small></Link> : null}
                </div>
              ) : (
                <Link className="do-camera-add-empty" href={`/digital-observer/cameras/add?site=${selectedSite.id}`}><Plus /><strong>הוספת מצלמה ראשונה</strong><span>החיבור נשמר באופן מאובטח ואינו מופעל כחי לפני Gateway.</span></Link>
              )}
              <div className="do-home-address" aria-label="כתובת האתר"><MapPin /><span><strong>כתובת האתר</strong><small>{siteAddressLabel(selectedSite)}</small></span></div>
            </section>

            <section className="do-home-dashboard-lower">
              <article className="do-panel do-home-events-panel">
                <div className="do-section-head"><div><h2>אירועים ממתינים לבדיקה</h2><p>כל כרטיס כולל מקור מצלמה, תמונה וקטע וידאו מאומתים.</p></div><Link className="do-link" href="/digital-observer/alerts">הצג הכל</Link></div>
                {reviewableOpenSignals.length ? <div className="do-home-event-cards">{reviewableOpenSignals.slice(0, 4).map((signal) => {
                  const clip = observerClipForSignal(signal, runtime.clips);
                  const camera = observerCameraForSignal(signal, siteCameras);
                  const narrative = observerEventNarrative(signal);
                  return <Link className="do-home-event-card" href={`/digital-observer/alerts?event=${signal.id}`} key={signal.id}><img src={`/api/digital-observer/event-clips/${clip?.id}/media?kind=thumbnail`} alt={`תמונה מאירוע: ${narrative.label}`} /><span><b className={badgeTone(signal.severity)}>{observerStatusLabel(signal.severity)}</b><strong>{narrative.label}</strong><p>{narrative.summary}</p><small>{camera?.display_name || "מצלמה"} · {formatObserverDate(signal.created_at)}</small></span></Link>;
                })}</div> : <div className="do-empty compact"><CheckCircle2 /><strong>אין אירועים תקינים שממתינים לבדיקה</strong><span>אירוע יוצג כאן רק לאחר שנקלטו מקור מצלמה, תמונה וקטע וידאו.</span></div>}
              </article>
              <article className="do-panel do-home-status-panel">
                <div className="do-section-head"><div><h2>מצב הבית</h2><p>סיכום שנגזר מהנתונים המחוברים.</p></div></div>
                <div className="do-row-list">
                  <div className="do-row"><Camera /><span className="do-row-main"><strong>מקורות מצלמה</strong><small>{siteCameras.length ? `${readyCameras} מתוך ${siteCameras.length} מוכנים לבדיקה · ${liveCameras} חיים` : "טרם חוברו"}</small></span><span className={readyCameras === siteCameras.length && siteCameras.length ? "do-status-dot good" : "do-status-dot warn"}>{siteCameras.length ? observerStatusLabel(readyCameras === siteCameras.length ? "ready_to_test" : "degraded") : "מוכן להגדרה"}</span></div>
                  <div className="do-row"><Bell /><span className="do-row-main"><strong>התראות פתוחות</strong><small>{openSignals.length ? `${openSignals.length} לבדיקה` : "אין"}</small></span><span className={openSignals.length ? "do-status-dot warn" : "do-status-dot good"}>{openSignals.length ? "דורש תשומת לב" : "שקט"}</span></div>
                  <div className="do-row"><Moon /><span className="do-row-main"><strong>שעות שקטות</strong><small>{runtime.schedules.find((item) => item.observer_site_id === selectedSite.id)?.schedule_mode ? observerStatusLabel(runtime.schedules.find((item) => item.observer_site_id === selectedSite.id)?.schedule_mode) : "טרם הוגדרו"}</small></span><Link className="do-link" href="/digital-observer/settings">עריכה</Link></div>
                </div>
              </article>
            </section>
          </>
        ) : (
          <>
            <section className="do-business-summary" aria-label="מדדי סקירת העסק">
              <article className={`do-metric do-business-status-metric ${siteCameras.length && readyCameras === siteCameras.length ? "good" : "alert"}`}><span className="do-business-status-icon"><ShieldCheck /></span><strong>{siteCameras.length && readyCameras === siteCameras.length ? "הכול תקין" : "דורש בדיקה"}</strong><span>סטטוס מקורות המצלמה</span></article>
              <article className="do-metric"><Camera /><strong>{readyCameras}</strong><span>מקורות מוכנים מתוך {siteCameras.length}</span></article>
              <article className="do-metric"><Building2 /><strong>{runtime.sites.length}</strong><span>אתרים בחשבון</span></article>
              <article className="do-metric alert"><Bell /><strong>{openSignals.length}</strong><span>אירועים פתוחים</span></article>
              <article className="do-metric"><Moon /><strong>{selectedSite.monitoring_enabled ? "פעיל" : "הכנה"}</strong><span>ניטור מחוץ לשעות</span></article>
            </section>

            <section className="do-business-dashboard-core">
              <article className="do-panel do-activity-panel">
                <div className="do-section-head"><div><h2>פעילות ב-24 השעות האחרונות</h2><p><span className="do-legend-dot teal" /> תנועה <span className="do-legend-dot red" /> אירועים לבדיקה</p></div><Link className="do-link" href="/digital-observer/alerts">מרכז האירועים</Link></div>
                {businessActivityTotal ? <div className="do-activity-chart" aria-label="פעילות ב-24 השעות האחרונות">
                  <div className="do-activity-chart-head"><span><Activity /> פעילות שנקלטה</span><strong>{businessActivityTotal} אירועים</strong></div>
                  <svg className="do-activity-lines" viewBox="0 0 520 130" role="img" aria-label="גרף פעילות לפי נתוני האירועים">
                    <polyline className="activity" points={chartPoints(businessActivity.map((bucket) => bucket.percent))} />
                    <polyline className="review" points={chartPoints(businessActivity.map((bucket) => bucket.reviewPercent))} />
                  </svg>
                  <div className="do-activity-labels">{businessActivity.map((bucket) => <small key={bucket.label}>{bucket.label}</small>)}</div>
                </div> : <div className="do-activity-empty"><Activity /><strong>אין פעילות שנקלטה ב-24 השעות האחרונות</strong><span>הגרף יופיע רק כאשר ייקלטו אירועים עם חותמת זמן בטווח הנוכחי.</span></div>}
              </article>
              <article className="do-panel do-open-events-panel">
                <div className="do-section-head"><div><h2>אירועים פתוחים</h2><p>אירועים שממתינים לבדיקה אנושית.</p></div><Link className="do-link" href="/digital-observer/alerts">צפו בכל האירועים</Link></div>
                {openSignals.length ? <div className="do-row-list">{openSignals.slice(0, 6).map((signal) => <Link className="do-row" href={`/digital-observer/alerts?event=${signal.id}`} key={signal.id}><Radar /><span className="do-row-main"><strong>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</strong><small>{signal.recommended_action ?? "בדיקה אנושית מומלצת"}</small></span><span className="do-row-meta"><b className={badgeTone(signal.severity)}>{observerStatusLabel(signal.severity)}</b><time>{formatObserverDate(signal.created_at, { year: undefined, month: undefined, day: undefined })}</time></span></Link>)}</div> : <div className="do-empty compact"><CheckCircle2 /><strong>אין אירועים פתוחים</strong><span>אירועים שיוגדרו לבדיקה יופיעו כאן.</span></div>}
              </article>
            </section>

            <section className="do-section do-business-camera-strip">
              <div className="do-section-head"><div><h2>מצלמות ומקורות</h2><p>{liveCameras ? `${liveCameras} מקורות חיים מאושרים` : "המקורות מוצגים במצב הדגמה/מוכנות; אין שידור חי פעיל."}</p></div><Link className="do-link" href="/digital-observer/cameras">הצג הכל <ArrowLeft /></Link></div>
              {siteCameras.length ? <div className="do-camera-grid">{siteCameras.slice(0, 5).map((camera, index) => {
                const hasLiveGateway = digitalObserverCameraHasLiveGateway(camera);
                return <Link className="do-dashboard-camera-card" href={`/digital-observer/cameras?camera=${camera.id}`} key={camera.id}>{hasLiveGateway ? <ObserverLivePlayer compact observerSiteId={selectedSite.id} cameraSourceId={camera.id} name={camera.display_name ?? "מצלמה"} /> : <ObserverCameraMedia name={camera.display_name ?? "מצלמה"} mode="business" scene={camera.preview_scene ?? sceneFor(index, "business")} status={camera.status ?? camera.health_status} sourceMode={camera.source_mode} />}<ObserverCameraPresence active={hasLiveGateway} /><span className="do-dashboard-camera-copy"><strong>{camera.display_name ?? "מצלמה"}</strong><small>{hasLiveGateway ? "שידור חי דרך Gateway" : ["offline", "failed", "error"].includes(String(camera.status ?? camera.health_status)) ? "Offline · אין שידור מה-DVR" : camera.source_mode === "demo" ? "תרחיש הדגמה" : "מוכן לחיבור"}</small></span></Link>;
              })}</div> : <div className="do-empty"><CameraOff /><strong>אין מקורות מצלמה באתר</strong><span>הוסף מקור IP, NVR/DVR, ONVIF, ספק ענן או Gateway.</span><Link className="do-button primary" href="/digital-observer/cameras/add">הוספת מצלמה</Link></div>}
            </section>
          </>
        )}

      </div>
    </ObserverAppShell>
  );
}
