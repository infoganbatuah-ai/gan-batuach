import Image from "next/image";
import Link from "next/link";
import { ObserverJournalRefresh } from "@/components/digital-observer/observer-journal-refresh";
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
import { ObserverCameraPresence } from "@/components/digital-observer/observer-camera-presence";
import { ObserverLivePlayer } from "@/components/digital-observer/observer-live-player";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import {
  digitalObserverCameraOperationalState,
  digitalObserverCameraStreamReference,
} from "@/lib/domain/digital-observer/camera-live-status";
import { observerEventNarrative } from "@/lib/domain/digital-observer/event-narrative";
import {
  formatObserverDate,
  loadObserverRuntime,
  observerCameraForSignal,
  observerClipForSignal,
  observerClipHasRequiredMedia,
  observerEventLabel,
  observerModeForSite,
  selectObserverSite,
  observerStatusLabel,
  type ObserverRow,
} from "@/lib/domain/digital-observer/runtime";

type PageProps = { searchParams?: Promise<{ site?: string }> };

const cameraStatusLabels = {
  ONLINE: "זמינה לצפייה חיה",
  RECOVERING: "החיבור מתאושש",
  OFFLINE: "אין שידור זמין",
  SIMULATION: "הדמיה בלבד",
} as const;

function dashboardCameraState(camera: ObserverRow, now: number) {
  // Runtime normalizes recovering rows. Recheck the original report against this render’s clock.
  const source = camera.metadata?.operational_health_state === "RECOVERING"
    ? { ...camera, status: camera.metadata.reported_status, health_status: camera.metadata.reported_health_status }
    : camera;
  const state = digitalObserverCameraOperationalState(source, { now });
  return state === "ONLINE" && !digitalObserverCameraStreamReference(source) ? "OFFLINE" : state;
}

function dashboardSnapshot(siteCameras: ObserverRow[], siteSignals: ObserverRow[], now = Date.now()) {
  const previews = siteCameras.flatMap((camera) => {
    const state = dashboardCameraState(camera, now);
    return state === "CHANNEL_EMPTY" ? [] : [{ camera, state }];
  });
  const realSources = previews.filter(({ state }) => state !== "SIMULATION");
  const demos = previews.filter(({ state }) => state === "SIMULATION");
  const liveCameras = realSources.filter(({ state }) => state === "ONLINE").length;
  const recovering = realSources.filter(({ state }) => state === "RECOVERING").length;
  return {
    previews: [...realSources, ...demos],
    assigned: realSources.length,
    liveCameras,
    recovering,
    offline: realSources.length - liveCameras - recovering,
    businessActivity: activityBuckets(siteSignals, now),
  };
}

function DashboardCameraCard({ camera, state, siteId }: {
  camera: ObserverRow;
  state: keyof typeof cameraStatusLabels;
  siteId: string;
}) {
  const name = camera.display_name || "מצלמה";
  const live = state === "ONLINE";
  const href = `/digital-observer/cameras?${new URLSearchParams({ site: siteId, camera: camera.id })}`;
  return <Link className="do-dashboard-camera-card" href={href} aria-label={`${name} · ${cameraStatusLabels[state]}`}>
    {live ? (
      <>
        <ObserverLivePlayer compact observerSiteId={siteId} cameraSourceId={camera.id} name={name} />
        <ObserverCameraPresence active />
      </>
    ) : (
      <div className="do-camera-media is-readiness" aria-hidden="true">
        <span className="do-camera-status readiness">{cameraStatusLabels[state]}</span>
        <span className="do-camera-name">{name}</span>
        <span className="do-camera-lock"><CameraOff /></span>
      </div>
    )}
    <span className="do-dashboard-camera-copy">
      <strong>{name}</strong>
      <small>{cameraStatusLabels[state]}</small>
    </span>
  </Link>;
}

function badgeTone(status?: string | null) {
  if (["connected", "healthy", "online", "active", "resolved"].includes(String(status))) return "do-badge good";
  if (["degraded", "testing", "needs_review", "reviewing"].includes(String(status))) return "do-badge warn";
  if (["offline", "failed", "blocked", "critical"].includes(String(status))) return "do-badge bad";
  return "do-badge info";
}

function activityBuckets(signals: ObserverRow[], now: number) {
  const bucketHours = 4;
  const bucketCount = 6;
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

function siteAddressLabel(site: ObserverRow | null) {
  if (!site) return "כתובת טרם הוגדרה";
  const base = site.formatted_address || site.address || [site.street, site.building_number, site.city].filter(Boolean).join(" ");
  const level = site.floor_kind === "ground" ? "קומת קרקע" : Number.isInteger(site.floor_number) ? `קומה ${site.floor_number}` : "";
  return [base, site.apartment_number ? `דירה ${site.apartment_number}` : "", level].filter(Boolean).join(" · ") || "כתובת טרם הושלמה";
}

export default async function DigitalObserverDashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/dashboard");
  const runtime = await loadObserverRuntime(profile.id);
  const selectedSite = selectObserverSite(runtime.sites, runtime.cameras, params?.site);
  const mode = observerModeForSite(selectedSite);
  const siteCameras = selectedSite ? runtime.cameras.filter((camera) => camera.observer_site_id === selectedSite.id) : [];
  const siteSignals = selectedSite ? runtime.signals.filter((signal) => signal.observer_site_id === selectedSite.id) : [];
  const openSignals = siteSignals.filter((signal) => ["needs_review", "reviewing", "escalated"].includes(String(signal.review_status)));
  const reviewableOpenSignals = openSignals.filter((signal) => Boolean(observerCameraForSignal(signal, siteCameras)) && (signal.metadata?.validated_event === true || signal.metadata?.recording_required === false || observerClipHasRequiredMedia(observerClipForSignal(signal, runtime.clips))));
  const urgentSignals = reviewableOpenSignals.filter((signal) => ["critical", "urgent", "high"].includes(String(signal.severity)));
  const { previews, assigned, liveCameras, recovering, offline, businessActivity } = dashboardSnapshot(siteCameras, siteSignals);
  const cameraSummary = `${assigned} משויכות · ${liveCameras} זמינות לצפייה חיה · ${recovering} מתאוששות · ${offline} ללא שידור זמין`;
  const allSourcesLive = assigned > 0 && liveCameras === assigned;
  const siteQuery = new URLSearchParams(selectedSite ? { site: selectedSite.id } : {});
  const camerasHref = `/digital-observer/cameras?${siteQuery}`;
  const addCameraHref = `/digital-observer/cameras/add?${siteQuery}`;
  const businessActivityTotal = businessActivity.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <ObserverAppShell
      profile={profile}
      mode={mode}
      activeHref="/digital-observer/dashboard"
      title={mode === "home" ? "תצפיתן דיגיטלי" : "סקירת העסק"}
      statusLabel={selectedSite ? `${liveCameras} זמינות לצפייה חיה` : undefined}
    >
      <div className={`do-page-stack do-dashboard do-dashboard-${mode}`}>
        <ObserverJournalRefresh latestId={siteSignals[0]?.id} severity={siteSignals[0]?.severity} />
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
                  <h2>{urgentSignals.length ? "יש אירוע דחוף שמחכה לבדיקה" : assigned ? <><span className="do-home-calm-desktop">לא התקבלו אירועים דחופים</span><span className="do-home-calm-mobile">מצב האירועים</span></> : "מוכנים לחבר את הבית"}</h2>
                  <p>{assigned ? cameraSummary : "חברו מצלמה ראשונה כדי להתחיל."}{urgentSignals.length ? ` · ${urgentSignals.length} אירועים דחופים לבדיקה` : ""}</p>
                </div>
              </div>

              <div className="do-home-cameras-head">
                <h2>מצלמות</h2>
                <div className="do-section-actions do-home-camera-view-actions">
                  <Link className="do-link" href={camerasHref}>כל המצלמות</Link>
                  <span className="do-home-camera-view-toggle" aria-label="אפשרויות תצוגה">
                    <Link href={`${camerasHref}&view=grid`} aria-label="תצוגת גריד"><LayoutGrid /></Link>
                    <Link href={`${camerasHref}&view=list`} aria-label="תצוגת רשימה"><List /></Link>
                  </span>
                  <Link className="do-icon-button accent do-home-camera-add" href={addCameraHref} aria-label="הוספת מצלמה"><Plus /></Link>
                </div>
              </div>
              {previews.length ? (
                <div className="do-camera-grid">
                  {previews.slice(0, 4).map(({ camera, state }) =>
                    <DashboardCameraCard key={camera.id} camera={camera} state={state} siteId={selectedSite.id} />
                  )}
                  {previews.length < 4 ? <Link className="do-camera-add-slot" href={addCameraHref}><Plus /><span>הוספת מצלמה</span><small>מקור חדש</small></Link> : null}
                </div>
              ) : (
                <Link className="do-camera-add-empty" href={addCameraHref}><Plus /><strong>הוספת מצלמה ראשונה</strong><span>נשתמש קודם במערכת שכבר מותקנת ונבחר את דרך החיבור הבטוחה ביותר.</span></Link>
              )}
              <div className="do-home-address" aria-label="כתובת האתר"><MapPin /><span><strong>כתובת האתר</strong><small>{siteAddressLabel(selectedSite)}</small></span></div>
            </section>

            <section className="do-home-dashboard-lower">
              <article className="do-panel do-home-events-panel">
                <div className="do-section-head"><div><h2>אירועים ממתינים לבדיקה</h2><p>אירועים משויכים למצלמה; קליפ מצורף רק כאשר נדרשה הקלטה.</p></div><Link className="do-link" href="/digital-observer/alerts">הצג הכל</Link></div>
                {reviewableOpenSignals.length ? <div className="do-home-event-cards">{reviewableOpenSignals.slice(0, 4).map((signal) => {
                  const clip = observerClipForSignal(signal, runtime.clips);
                  const camera = observerCameraForSignal(signal, siteCameras);
                  const narrative = observerEventNarrative(signal);
                  return <Link className="do-home-event-card" href={`/digital-observer/alerts?event=${signal.id}`} key={signal.id}>{observerClipHasRequiredMedia(clip) ? <img src={`/api/digital-observer/event-clips/${clip?.id}/media?kind=thumbnail`} alt={`תמונה מאירוע: ${narrative.label}`} /> : <Camera aria-label={signal.metadata?.recording_required === false ? "ללא הקלטה לפי המדיניות" : "מדיה טרם זמינה"} />}<span><b className={badgeTone(signal.severity)}>{observerStatusLabel(signal.severity)}</b><strong>{narrative.label}</strong><p>{narrative.summary}</p><small>{camera?.display_name || "מצלמה"} · {formatObserverDate(signal.created_at)}</small></span></Link>;
                })}</div> : <div className="do-empty compact"><CheckCircle2 /><strong>אין אירועים תקינים שממתינים לבדיקה</strong><span>אירועים מאומתים יוצגו גם כשאין צורך לשמור קליפ.</span></div>}
              </article>
              <article className="do-panel do-home-status-panel">
                <div className="do-section-head"><div><h2>מצב הבית</h2><p>סיכום שנגזר מהנתונים המחוברים.</p></div></div>
                <div className="do-row-list">
                  <div className="do-row">
                    <Camera />
                    <span className="do-row-main"><strong>מקורות מצלמה</strong><small>{assigned ? cameraSummary : "טרם שויכו מקורות"}</small></span>
                    <span className={allSourcesLive ? "do-status-dot good" : "do-status-dot warn"}>
                      {allSourcesLive ? "זמינים לצפייה" : assigned ? "זמינות חלקית או חסרה" : "ממתין להגדרה"}
                    </span>
                  </div>
                  <div className="do-row"><Bell /><span className="do-row-main"><strong>התראות פתוחות</strong><small>{reviewableOpenSignals.length ? `${reviewableOpenSignals.length} לבדיקה` : "אין"}</small></span><span className={reviewableOpenSignals.length ? "do-status-dot warn" : "do-status-dot good"}>{reviewableOpenSignals.length ? "דורש תשומת לב" : "שקט"}</span></div>
                  <div className="do-row"><Moon /><span className="do-row-main"><strong>שעות שקטות</strong><small>{runtime.schedules.find((item) => item.observer_site_id === selectedSite.id)?.schedule_mode ? observerStatusLabel(runtime.schedules.find((item) => item.observer_site_id === selectedSite.id)?.schedule_mode) : "טרם הוגדרו"}</small></span><Link className="do-link" href="/digital-observer/settings">עריכה</Link></div>
                </div>
              </article>
            </section>
          </>
        ) : (
          <>
            <section className="do-business-summary" aria-label="מדדי סקירת העסק">
              <article className={`do-metric do-business-status-metric ${allSourcesLive ? "good" : "alert"}`}>
                <span className="do-business-status-icon">{allSourcesLive ? <Camera /> : <CameraOff />}</span>
                <strong>{allSourcesLive ? "כל המקורות זמינים לצפייה" : assigned ? "זמינות המקורות דורשת בדיקה" : "טרם שויכו מקורות"}</strong>
                <span>סטטוס מקורות המצלמה</span>
              </article>
              <article className="do-metric"><Camera /><strong>{liveCameras}</strong><span>זמינות לצפייה חיה מתוך {assigned} משויכות</span></article>
              <article className="do-metric"><Building2 /><strong>{runtime.sites.length}</strong><span>אתרים בחשבון</span></article>
              <article className="do-metric alert"><Bell /><strong>{reviewableOpenSignals.length}</strong><span>אירועים פתוחים</span></article>
              <article className="do-metric"><Moon /><strong>{selectedSite.monitoring_enabled ? "מוגדר" : "לא מוגדר"}</strong><span>הגדרת ניטור מחוץ לשעות</span></article>
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
                {reviewableOpenSignals.length ? <div className="do-row-list">{reviewableOpenSignals.slice(0, 6).map((signal) => <Link className="do-row" href={`/digital-observer/alerts?event=${signal.id}`} key={signal.id}><Radar /><span className="do-row-main"><strong>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</strong><small>{signal.recommended_action ?? "בדיקה אנושית מומלצת"}</small></span><span className="do-row-meta"><b className={badgeTone(signal.severity)}>{observerStatusLabel(signal.severity)}</b><time>{formatObserverDate(signal.created_at, { year: undefined, month: undefined, day: undefined })}</time></span></Link>)}</div> : <div className="do-empty compact"><CheckCircle2 /><strong>אין אירועים פתוחים</strong><span>אירועים שיוגדרו לבדיקה יופיעו כאן.</span></div>}
              </article>
            </section>

            <section className="do-section do-business-camera-strip">
              <div className="do-section-head">
                <div><h2>מצלמות ומקורות</h2><p>{cameraSummary}</p></div>
                <Link className="do-link" href={camerasHref}>כל המצלמות <ArrowLeft /></Link>
              </div>
              {previews.length ? (
                <div className="do-camera-grid">
                  {previews.slice(0, 5).map(({ camera, state }) =>
                    <DashboardCameraCard key={camera.id} camera={camera} state={state} siteId={selectedSite.id} />
                  )}
                </div>
              ) : (
                <div className="do-empty"><CameraOff /><strong>אין מקורות מצלמה באתר</strong><span>הוסף מקור IP, NVR/DVR, ONVIF, ספק ענן או Gateway.</span><Link className="do-button primary" href={addCameraHref}>הוספת מצלמה</Link></div>
              )}
            </section>
          </>
        )}

      </div>
    </ObserverAppShell>
  );
}
