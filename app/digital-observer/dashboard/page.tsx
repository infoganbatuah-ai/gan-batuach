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
  CarFront,
  CheckCircle2,
  DoorOpen,
  Fingerprint,
  Lightbulb,
  LayoutGrid,
  List,
  MapPin,
  Moon,
  Plus,
  Radar,
  ShieldCheck,
  Warehouse,
  Waves
} from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { ObserverBiometricSetupAction } from "@/components/digital-observer/observer-action-forms";
import { ObserverCameraMedia } from "@/components/digital-observer/observer-camera-media";
import { ObserverCameraPresence } from "@/components/digital-observer/observer-camera-presence";
import { ObserverLivePlayer } from "@/components/digital-observer/observer-live-player";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { digitalObserverCameraHasLiveGateway } from "@/lib/domain/digital-observer/camera-live-status";
import { observerEventNarrative } from "@/lib/domain/digital-observer/event-narrative";
import { buildObserverDailySummary, buildObserverDashboardSummaries } from "@/lib/domain/digital-observer/dashboard-summary";
import {
  formatObserverDate,
  loadObserverRuntime,
  observerCameraForSignal,
  observerClipForSignal,
  observerClipHasRequiredMedia,
  observerEventLabel,
  observerModeForSite,
  selectObserverSite,
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
  const selectedSite = selectObserverSite(runtime.sites, runtime.cameras, params?.site);
  const mode = observerModeForSite(selectedSite);
  const siteCameras = selectedSite ? runtime.cameras.filter((camera) => camera.observer_site_id === selectedSite.id) : [];
  const activeSiteCameras = siteCameras.filter(digitalObserverCameraHasLiveGateway);
  const disconnectedSiteCameras = siteCameras.filter((camera) => !digitalObserverCameraHasLiveGateway(camera));
  const siteSignals = selectedSite ? runtime.signals.filter((signal) => signal.observer_site_id === selectedSite.id) : [];
  const openSignals = siteSignals.filter((signal) => ["needs_review", "reviewing", "escalated"].includes(String(signal.review_status)));
  const reviewableOpenSignals = openSignals.filter((signal) => observerClipHasRequiredMedia(observerClipForSignal(signal, runtime.clips)) && Boolean(observerCameraForSignal(signal, siteCameras)));
  const urgentSignals = openSignals.filter((signal) => ["critical", "urgent", "high"].includes(String(signal.severity)));
  const liveCameras = activeSiteCameras.length;
  const readyCameras = activeSiteCameras.length;
  const businessActivity = activityBuckets(siteSignals);
  const businessActivityTotal = businessActivity.reduce((sum, bucket) => sum + bucket.count, 0);
  const latestSignalAt = siteSignals[0]?.created_at ?? null;
  const latestLearningAt = selectedSite ? runtime.baselines.filter((baseline) => baseline.observer_site_id === selectedSite.id).map((baseline) => baseline.updated_at).filter(Boolean).sort().at(-1) ?? null : null;
  const approvedKnownPeople = selectedSite ? runtime.knownPeople.filter((person) => person.observer_site_id === selectedSite.id && person.consent_status === "approved") : [];
  const biometricSetupEnabled = selectedSite?.metadata?.biometric_setup_consent === true;
  const biometricMatchingReady = siteCameras.some((camera) => camera.metadata?.edge_policy?.biometric_matching_enabled === true && camera.metadata?.edge_capability_contract?.capabilities?.biometric_matching === true);
  const dashboardSummaries = buildObserverDashboardSummaries(activeSiteCameras, siteSignals);
  const dailySummary = buildObserverDailySummary(siteSignals);

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
                  <h2>{urgentSignals.length ? "יש אירוע דחוף שמחכה לבדיקה" : activeSiteCameras.length ? <><span className="do-home-calm-desktop">הכול שקט בבית</span><span className="do-home-calm-mobile">הכול שקט</span></> : "אין כרגע מצלמה שמשדרת"}</h2>
                  <p>{activeSiteCameras.length ? `${activeSiteCameras.length} מצלמות משדרות ומזינות את התצפיתן.` : siteCameras.length ? "המקורות נשמרו, אך לא התקבל מהם וידאו חי." : "חברו מקליט או מצלמות כדי להתחיל."} {urgentSignals.length ? `${urgentSignals.length} אירועים דחופים ממתינים לבדיקה.` : "אין אירועים דחופים."}</p>
                </div>
              </div>

              {dashboardSummaries.length ? <div className="do-home-context-summary" aria-label="סיכום פעילות לפי המצלמות המחוברות">{dashboardSummaries.map((summary) => <Link href={`/digital-observer/alerts?category=${summary.key}`} key={summary.key}>{summary.key === "parking" ? <CarFront /> : summary.key === "entry_exit" ? <DoorOpen /> : summary.key === "warehouse" ? <Warehouse /> : summary.key === "pool" ? <Waves /> : summary.key === "anomalies" ? <AlertTriangle /> : <Lightbulb />}<span><strong>{summary.count}</strong><small>{summary.label}</small></span></Link>)}</div> : null}

              <div className="do-home-cameras-head"><h2>מצלמות פעילות</h2><div className="do-section-actions do-home-camera-view-actions">{disconnectedSiteCameras.length ? <Link className="do-link" href={`/digital-observer/cameras?site=${selectedSite.id}&status=offline`}><CameraOff /> מנותקות ({disconnectedSiteCameras.length})</Link> : null}<Link className="do-link" href="/digital-observer/cameras">צפייה חיה</Link><span className="do-home-camera-view-toggle" aria-label="אפשרויות תצוגה"><Link href="/digital-observer/cameras?view=grid" aria-label="תצוגת גריד"><LayoutGrid /></Link><Link href="/digital-observer/cameras?view=list" aria-label="תצוגת רשימה"><List /></Link></span><Link className="do-icon-button accent do-home-camera-add" href={`/digital-observer/cameras/add?site=${selectedSite.id}`} aria-label="הוספת מצלמות"><Plus /></Link></div></div>
              {activeSiteCameras.length ? (
                <div className="do-camera-grid">
                  {activeSiteCameras.slice(0, 4).map((camera, index) => {
                    const hasLiveGateway = digitalObserverCameraHasLiveGateway(camera);
                    return (
                      <Link className="do-dashboard-camera-card" href={`/digital-observer/cameras?camera=${camera.id}`} key={camera.id}>
                        {hasLiveGateway ? <ObserverLivePlayer compact observerSiteId={selectedSite.id} cameraSourceId={camera.id} name={camera.display_name ?? "מצלמה"} /> : <ObserverCameraMedia name={camera.display_name ?? "מצלמה"} mode="home" scene={camera.preview_scene ?? sceneFor(index, "home")} status={camera.status ?? camera.health_status} sourceMode={camera.source_mode} />}
                        {!hasLiveGateway ? <ObserverCameraPresence active={false} /> : null}
                        <span className="do-dashboard-camera-copy"><strong>{camera.display_name ?? "מצלמה"}</strong><small>{hasLiveGateway ? "שידור חי דרך Gateway" : ["offline", "failed", "error"].includes(String(camera.status ?? camera.health_status)) ? "Offline · אין שידור מה-DVR" : camera.source_mode === "demo" ? "תרחיש הדגמה" : "מוכן לחיבור"}</small></span>
                      </Link>
                    );
                  })}
                  {activeSiteCameras.length < 4 ? <Link className="do-camera-add-slot" href={`/digital-observer/cameras/add?site=${selectedSite.id}`}><Plus /><span>הוספת מצלמות</span><small>מקור חדש</small></Link> : null}
                </div>
              ) : (
                <div className="do-camera-add-empty"><CameraOff /><strong>{siteCameras.length ? "אין מצלמות שמשדרות כרגע" : "הוספת מצלמות"}</strong><span>{siteCameras.length ? "המקורות נשמרו ויופיעו כאן אוטומטית כשווידאו חי יחזור." : "חיבור מקליט אחד יגלה את כל הערוצים הזמינים."}</span><Link className="do-button primary" href={siteCameras.length ? `/digital-observer/cameras?site=${selectedSite.id}&status=offline` : `/digital-observer/cameras/add?site=${selectedSite.id}`}>{siteCameras.length ? "פתיחת מצלמות מנותקות" : "הוספת מקור"}</Link></div>
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
                  <div className="do-row"><Camera /><span className="do-row-main"><strong>מצלמות פעילות</strong><small>{siteCameras.length ? `${liveCameras} משדרות · ${disconnectedSiteCameras.length} מנותקות` : "טרם חוברו"}</small></span><span className={liveCameras ? "do-status-dot good" : "do-status-dot warn"}>{liveCameras ? "וידאו זמין" : "אין שידור"}</span></div>
                  <div className="do-row"><Bell /><span className="do-row-main"><strong>התראות פתוחות</strong><small>{openSignals.length ? `${openSignals.length} לבדיקה` : "אין"}</small></span><span className={openSignals.length ? "do-status-dot warn" : "do-status-dot good"}>{openSignals.length ? "דורש תשומת לב" : "שקט"}</span></div>
                  <div className="do-row"><Lightbulb /><span className="do-row-main"><strong>סיכום היום</strong><small>{dailySummary.text}</small></span><Link className="do-link" href="/digital-observer/rules">פירוט</Link></div>
                  <div className="do-row"><Fingerprint /><span className="do-row-main"><strong>זיהוי אנשים בהסכמה</strong><small>{biometricMatchingReady && biometricSetupEnabled ? `${approvedKnownPeople.length} פרופילים מאושרים זמינים להתאמה מקומית` : biometricSetupEnabled ? approvedKnownPeople.length ? `${approvedKnownPeople.length} הסכמות נשמרו; מודל ההתאמה עדיין לא אומת` : "ההכנה פעילה; יש להוסיף כל אדם בהסכמתו" : "כבוי עד הסכמה מפורשת באתר ולכל אדם"}</small></span>{biometricSetupEnabled ? <Link className="do-link" href="/digital-observer/people#add-known-person">ניהול אנשים</Link> : <ObserverBiometricSetupAction siteId={selectedSite.id} enabled={false} />}</div>
                  <div className="do-row"><Moon /><span className="do-row-main"><strong>שעות שקטות</strong><small>{runtime.schedules.find((item) => item.observer_site_id === selectedSite.id)?.schedule_mode ? observerStatusLabel(runtime.schedules.find((item) => item.observer_site_id === selectedSite.id)?.schedule_mode) : "טרם הוגדרו"}</small></span><Link className="do-link" href="/digital-observer/settings">עריכה</Link></div>
                </div>
              </article>
            </section>
          </>
        ) : (
          <>
            <section className="do-business-summary" aria-label="מדדי סקירת העסק">
              <article className={`do-metric do-business-status-metric ${activeSiteCameras.length ? "good" : "alert"}`}><span className="do-business-status-icon"><ShieldCheck /></span><strong>{activeSiteCameras.length ? "השידור פעיל" : "אין שידור"}</strong><span>סטטוס מקורות המצלמה</span></article>
              <article className="do-metric"><Camera /><strong>{activeSiteCameras.length}</strong><span>מצלמות פעילות</span></article>
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
              {activeSiteCameras.length ? <div className="do-camera-grid">{activeSiteCameras.slice(0, 5).map((camera, index) => {
                const hasLiveGateway = digitalObserverCameraHasLiveGateway(camera);
                return <Link className="do-dashboard-camera-card" href={`/digital-observer/cameras?camera=${camera.id}`} key={camera.id}>{hasLiveGateway ? <ObserverLivePlayer compact observerSiteId={selectedSite.id} cameraSourceId={camera.id} name={camera.display_name ?? "מצלמה"} /> : <><ObserverCameraMedia name={camera.display_name ?? "מצלמה"} mode="business" scene={camera.preview_scene ?? sceneFor(index, "business")} status={camera.status ?? camera.health_status} sourceMode={camera.source_mode} /><ObserverCameraPresence active={false} /></>}<span className="do-dashboard-camera-copy"><strong>{camera.display_name ?? "מצלמה"}</strong><small>{hasLiveGateway ? "שידור חי דרך Gateway" : ["offline", "failed", "error"].includes(String(camera.status ?? camera.health_status)) ? "Offline · אין שידור מה-DVR" : camera.source_mode === "demo" ? "תרחיש הדגמה" : "מוכן לחיבור"}</small></span></Link>;
              })}</div> : <div className="do-empty"><CameraOff /><strong>{siteCameras.length ? "אין מקורות שמשדרים כרגע" : "אין מקורות מצלמה באתר"}</strong><span>{siteCameras.length ? "המקורות המנותקים נשמרו ויחזרו אוטומטית לאחר חזרת הווידאו." : "הוסף מקור IP, NVR/DVR, ONVIF או ספק ענן."}</span><Link className="do-button primary" href={siteCameras.length ? `/digital-observer/cameras?site=${selectedSite.id}&status=offline` : "/digital-observer/cameras/add"}>{siteCameras.length ? "מצלמות מנותקות" : "הוספת מצלמות"}</Link></div>}
            </section>
          </>
        )}

      </div>
    </ObserverAppShell>
  );
}
