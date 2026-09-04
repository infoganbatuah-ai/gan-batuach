import Link from "next/link";
import { ArrowRight, Bell, Camera, CameraOff, CircleDot, Grid2X2, Image as ImageIcon, List, LockKeyhole, Maximize2, Mic, Plus, Search, ServerCog, Settings2, Share2, ShieldCheck, Video, Volume2, Wifi } from "lucide-react";
import { ObserverCameraInlineRename, ObserverCameraNameForm, ObserverQuickAction } from "@/components/digital-observer/observer-action-forms";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { ObserverCameraMedia } from "@/components/digital-observer/observer-camera-media";
import { ObserverCameraPresence } from "@/components/digital-observer/observer-camera-presence";
import { ObserverLivePlayer } from "@/components/digital-observer/observer-live-player";
import { ObserverCameraControls } from "@/components/digital-observer/observer-camera-controls";
import { GuardDiagnosticsPanel } from "@/components/digital-observer/guard-diagnostics-panel";
import { ObserverConversationPanel } from "@/components/digital-observer/observer-intelligence-experience";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { digitalObserverCameraHasLiveGateway } from "@/lib/domain/digital-observer/camera-live-status";
import { observerEventNarrative } from "@/lib/domain/digital-observer/event-narrative";
import { formatObserverDate, loadObserverRuntime, observerEventLabel, observerModeForSite, observerSignalMatchesCamera, observerStatusLabel, selectObserverSite } from "@/lib/domain/digital-observer/runtime";

type PageProps = { searchParams?: Promise<{ camera?: string; site?: string; q?: string; status?: string; location?: string }> };

function sceneFor(index: number, mode: "home" | "business") {
  const scenes = mode === "home" ? ["home-entry", "home-living", "home-nursery", "home-yard"] : ["business-entry", "business-store", "business-warehouse", "business-office", "business-parking", "business-loading"];
  return scenes[index % scenes.length];
}

function monitoringTargetLabel(value: unknown) {
  const labels: Record<string, string> = {
    person: "אנשים",
    children: "ילדים",
    animal: "בעלי חיים",
    known_faces: "אנשים מוכרים",
    entry_exit: "כניסה ויציאה",
    after_hours: "תנועה מחוץ לשעות",
    camera_obstruction: "תקינות וכיסוי מצלמה"
  };
  return labels[String(value)] ?? null;
}

export default async function DigitalObserverCamerasPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/cameras");
  const runtime = await loadObserverRuntime(profile.id);
  const site = selectObserverSite(runtime.sites, runtime.cameras, params?.site);
  const mode = observerModeForSite(site);
  const cameras = site ? runtime.cameras.filter((item) => item.observer_site_id === site.id) : [];
  const defaultVisibleCameras = cameras.filter(digitalObserverCameraHasLiveGateway);
  const offlineCameras = cameras.filter((camera) => !digitalObserverCameraHasLiveGateway(camera));
  const cameraPool = params?.status ? cameras : defaultVisibleCameras;
  const query = params?.q?.trim().toLocaleLowerCase("he-IL") ?? "";
  const locations = [...new Set(cameras.map((camera) => String(camera.location_label || "").trim()).filter(Boolean))].slice(0, 8);
  const filteredCameras = cameraPool.filter((camera) => {
    const matchesQuery = !query || `${camera.display_name ?? ""} ${camera.location_label ?? ""}`.toLocaleLowerCase("he-IL").includes(query);
    const status = String(camera.status || camera.health_status || "readiness");
    const matchesStatus = !params?.status
      || params.status === "all"
      || (params.status === "active" ? digitalObserverCameraHasLiveGateway(camera) : params.status === "offline" ? !digitalObserverCameraHasLiveGateway(camera) : status === params.status);
    const matchesLocation = !params?.location || params.location === "all" || camera.location_label === params.location;
    return matchesQuery && matchesStatus && matchesLocation;
  });
  const selected = params?.camera ? cameras.find((item) => item.id === params.camera) ?? null : null;
  const selectedHasLiveGateway = Boolean(site && selected && digitalObserverCameraHasLiveGateway(selected));
  const cameraSignals = selected ? runtime.signals.filter((signal) => observerSignalMatchesCamera(signal, selected.id)).slice(0, 4) : [];
  const latestCameraSignal = cameraSignals[0] ?? null;
  const latestCameraNarrative = latestCameraSignal ? observerEventNarrative(latestCameraSignal) : null;
  const monitoringTargets = selected && Array.isArray(selected.monitoring_targets)
    ? selected.monitoring_targets.map(monitoringTargetLabel).filter((value): value is string => Boolean(value)).slice(0, 4)
    : [];
  const cameraRule = selected ? runtime.watchRequests.find((rule) => rule.camera_source_id === selected.id) ?? null : null;
  const recentSiteSignals = site ? runtime.signals.filter((signal) => signal.observer_site_id === site.id).slice(0, 5) : [];
  const connectedCount = defaultVisibleCameras.length;
  const camerasHref = `/digital-observer/cameras${site ? `?site=${site.id}` : ""}`;
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/cameras" title={mode === "home" ? "צפייה חיה" : "מצלמות"} statusLabel={`${connectedCount} מצלמות פעילות`} mobileBackHref={selected ? camerasHref : undefined} actions={<Link className="do-button primary" href={site ? `/digital-observer/cameras/add?site=${site.id}` : "/digital-observer/onboarding"}><Plus /> הוספת מצלמות</Link>}>
    <div className={`do-page-stack do-camera-workspace do-camera-workspace-${mode}`}>
      {!runtime.runtimeMigrationApplied ? <div className="do-notice warn"><ServerCog /><span>טבלת מקורות המצלמה החדשה עדיין אינה זמינה בסביבה. אין אפשרות ליצור חיבור עד החלת המיגרציה.</span></div> : null}
      {!selected ? <section className="do-camera-browser">
        <div className="do-camera-browser-head">
          <div><h1>{params?.status === "offline" ? "מצלמות שאינן מחוברות" : mode === "home" ? "המצלמות שלי" : site?.name || "מצלמות העסק"}</h1><p>{params?.status === "offline" ? "מקורות אלה נשמרים אך אינם צורכים נגן או משאבי תצפיתן עד שחוזר וידאו חי." : mode === "home" ? "רק מצלמות עם וידאו חי מוצגות כאן. מקורות מנותקים נשמרים בנפרד." : "תמונת מצב מרוכזת לפי אתר, מיקום ובריאות החיבור."}</p></div>
          {mode === "home" && offlineCameras.length ? <Link className="do-button secondary" href={params?.status === "offline" ? camerasHref : `${camerasHref}${camerasHref.includes("?") ? "&" : "?"}status=offline`}>{params?.status === "offline" ? <><Camera /> חזרה לפעילות</> : <><CameraOff /> מנותקות ({offlineCameras.length})</>}</Link> : null}
          {mode === "home" ? <div className="do-view-switch" aria-label="בחירת תצוגה"><button type="button" className="active" aria-label="תצוגת רשת" title="תצוגת רשת"><Grid2X2 /></button><button type="button" disabled aria-label="תצוגת רשימה אינה זמינה" title="תצוגת רשימה תתווסף לאחר חיבור Gateway"><List /></button></div> : null}
        </div>
        {mode === "business" ? <form className="do-camera-filter-strip" method="get">
          {site ? <input type="hidden" name="site" value={site.id} /> : null}
          <label><Search /><input name="q" defaultValue={params?.q || ""} placeholder="חיפוש מצלמה או מיקום" /></label>
          <select name="status" defaultValue={params?.status || "all"} aria-label="סינון לפי מצב"><option value="all">כל המצבים</option><option value="active">זמינות</option><option value="readiness">ממתינות לחיבור</option><option value="disabled">מושבתות</option></select>
          <select name="location" defaultValue={params?.location || "all"} aria-label="סינון לפי מיקום"><option value="all">כל המיקומים</option>{locations.map((location) => <option value={location} key={location}>{location}</option>)}</select>
          <button className="do-button secondary" type="submit">סינון</button>
          <div className="do-view-switch do-business-view-switch" aria-label="בחירת פריסה"><button type="button" className="active" aria-label="תצוגת רשת" title="תצוגת רשת"><Grid2X2 /></button><button type="button" disabled aria-label="תצוגת רשימה אינה זמינה" title="תצוגת רשימה תתווסף לאחר חיבור Gateway"><List /></button></div>
        </form> : null}
        {filteredCameras.length ? <div className={mode === "business" ? "do-business-camera-layout" : undefined}>
          {mode === "business" ? <aside className="do-camera-filter-panel do-panel"><strong>סינון חכם</strong><span>מצב מצלמה</span><nav><Link className={!params?.status || params.status === "all" ? "active" : ""} href={`/digital-observer/cameras?site=${site?.id ?? ""}`}>הכול <b>{cameras.length}</b></Link><Link className={params?.status === "active" ? "active" : ""} href={`/digital-observer/cameras?site=${site?.id ?? ""}&status=active`}>מוכנות <b>{connectedCount}</b></Link><Link className={params?.status === "readiness" ? "active" : ""} href={`/digital-observer/cameras?site=${site?.id ?? ""}&status=readiness`}>ממתינות <b>{Math.max(0, cameras.length - connectedCount)}</b></Link></nav>{locations.length ? <><span>מיקום</span><nav>{locations.map((location) => <Link className={params?.q === location ? "active" : ""} href={`/digital-observer/cameras?site=${site?.id ?? ""}&q=${encodeURIComponent(location)}`} key={location}>{location}</Link>)}</nav></> : null}<Link className="do-button secondary full" href={`/digital-observer/cameras?site=${site?.id ?? ""}`}>ניקוי סינונים</Link></aside> : null}
          <div className={`do-camera-live-grid ${mode}`}>{filteredCameras.map((camera) => {
          const originalIndex = Math.max(0, cameras.findIndex((item) => item.id === camera.id));
          const hasLiveGateway = Boolean(site && digitalObserverCameraHasLiveGateway(camera));
          const cameraHref = `/digital-observer/cameras?site=${site?.id}&camera=${camera.id}`;
          return <article className="do-camera-live-tile" key={camera.id}><Link className="do-camera-live-open" href={cameraHref} aria-label={`פתיחת ${camera.display_name || "מצלמה"}`}>{hasLiveGateway ? <ObserverLivePlayer compact observerSiteId={site!.id} cameraSourceId={camera.id} name={camera.display_name || "מצלמה"} /> : <><ObserverCameraMedia name={camera.display_name || "מצלמה"} mode={mode} scene={camera.preview_scene || sceneFor(originalIndex, mode)} status={camera.status || camera.health_status} sourceMode={camera.source_mode} /><ObserverCameraPresence active={false} /></>}</Link><span className="do-camera-tile-meta"><span className="do-camera-tile-title"><Link href={cameraHref}>{camera.display_name || "מצלמה"}</Link><ObserverCameraInlineRename camera={camera} /></span><small>{hasLiveGateway ? "שידור חי דרך Gateway" : ["offline", "failed", "error"].includes(String(camera.status || camera.health_status)) ? "Offline · אין שידור מה-DVR" : camera.location_label || observerStatusLabel(camera.connector_type)}</small></span></article>;
        })}</div>
          {mode === "business" ? <aside className="do-camera-activity-panel do-panel"><div><strong>פעילות שנקלטה</strong><small>אירועים קיימים בלבד</small></div>{recentSiteSignals.length ? <nav>{recentSiteSignals.map((signal) => <Link href={`/digital-observer/alerts?event=${signal.id}`} key={signal.id}><CircleDot /><span><b>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</b><small>{signal.recommended_action || "ממתין לבדיקה"}</small></span></Link>)}</nav> : <div className="do-empty compact"><ShieldCheck /><strong>אין פעילות</strong><span>לא מוצגים אירועים מזויפים.</span></div>}<Link className="do-link" href="/digital-observer/alerts">צפייה בכל האירועים</Link></aside> : null}
        </div> : <div className="do-empty"><CameraOff /><strong>{params?.status === "offline" ? "אין מצלמות מנותקות" : cameras.length ? "אין כרגע מצלמה עם וידאו חי" : "אין מצלמות מחוברות"}</strong><span>{params?.status === "offline" ? "כל המקורות הרשומים משדרים כרגע." : cameras.length ? "המקורות נשמרו ויחזרו לכאן אוטומטית כשהשידור יתחדש." : "הוסיפו מקליט או מקור מצלמות. פרטי החיבור נשמרים רק ב-Gateway המקומי."}</span>{!cameras.length ? <Link className="do-button primary" href={site ? `/digital-observer/cameras/add?site=${site.id}` : "/digital-observer/onboarding"}>הוספת מצלמות</Link> : offlineCameras.length && params?.status !== "offline" ? <Link className="do-button secondary" href={`${camerasHref}${camerasHref.includes("?") ? "&" : "?"}status=offline`}>פתיחת מצלמות מנותקות</Link> : null}</div>}
        <div className="do-camera-control-dock" aria-label="בקרות צפייה"><button type="button" className="active" aria-label="רשת מצלמות"><Grid2X2 /></button><button type="button" disabled title="שמע יתאפשר רק לאחר חיבור מאושר"><Mic /></button><button type="button" disabled title="צילום תמונה יתאפשר רק ממקור וידאו מחובר"><ImageIcon /></button><button type="button" disabled title="עוצמת שמע אינה זמינה במצב מוכנות"><Volume2 /></button><span>{connectedCount ? `${connectedCount} מקורות זמינים` : "מצב מוכנות · אין שידור חי"}</span></div>
      </section> : null}
      {selected ? <section className="do-camera-detail-view">
        <Link className="do-link do-camera-back" href={camerasHref}><ArrowRight /> חזרה למצלמות</Link>
        <div className="do-camera-detail-grid">
        <article className="do-panel do-camera-player-panel">
          <div className="do-camera-detail-head"><div><h1>{selected.display_name || "מצלמה"}</h1><span className={selectedHasLiveGateway ? "do-status-dot good" : "do-status-dot warn"}>{observerStatusLabel(selected.status || selected.health_status)}</span></div><button type="button" disabled title="מסך מלא יתאפשר כשנגן וידאו מאובטח יחובר"><Maximize2 /></button></div>
          {selectedHasLiveGateway && site ? <ObserverLivePlayer large observerSiteId={site.id} cameraSourceId={selected.id} name={selected.display_name || "מצלמה"} /> : <ObserverCameraMedia large name={selected.display_name} mode={mode} scene={selected.preview_scene || sceneFor(cameras.indexOf(selected), mode)} status={selected.status || selected.health_status} sourceMode={selected.source_mode} />}
          {!selectedHasLiveGateway ? <ObserverCameraPresence active={false} /> : null}
          {selectedHasLiveGateway && site ? <ObserverCameraControls observerSiteId={site.id} cameraSourceId={selected.id} name={selected.display_name || "מצלמה"} capabilities={selected.capabilities ?? {}} /> : <div className="do-camera-live-controls" aria-label="פעולות צפייה חיה"><button type="button" disabled><Volume2 /><strong>שמע</strong><small>תצפיתן כבוי</small></button><button type="button" disabled><Camera /><strong>צילום</strong><small>ממתין לחיבור</small></button><button type="button" disabled><Mic /><strong>דבר</strong><small>תצפיתן כבוי</small></button><button type="button" disabled><Video /><strong>הקלטה</strong><small>אירועים בלבד</small></button></div>}
          {site && selected.connector_type !== "demo" ? <GuardDiagnosticsPanel key={`${site.id}:${selected.id}`} observerSiteId={site.id} cameraSourceId={selected.id} /> : null}
          <div className="do-camera-quick-actions" aria-label="פעולות מהירות">
            <Link href="/digital-observer/alerts"><Bell /><span><strong>התראות</strong><small>פתיחת מרכז ההתראות</small></span></Link>
            <Link href="/digital-observer/settings"><Share2 /><span><strong>שיתוף גישה</strong><small>ניהול הרשאות ושיתוף</small></span></Link>
          </div>
          <div className="do-camera-readiness-strip"><CircleDot /><span><strong>{selectedHasLiveGateway ? "צפייה חיה מאובטחת" : "צפייה מאובטחת במצב מוכנות"}</strong><small>{selectedHasLiveGateway ? "הווידאו מועבר דרך Gateway מאומת וטוקן קצר־חיים." : "וידאו חי, שמע והקלטה ייפתחו רק לאחר Gateway וטוקן קצר."}</small></span><Wifi /></div>
        </article>
        <aside className="do-camera-detail-side"><article className="do-panel do-form-section"><div className="do-section-head"><div><h2>פרטי המצלמה</h2><p>השם והחלל משמשים כהקשר לתצפיתן.</p></div><Settings2 /></div><ObserverCameraNameForm camera={selected} /><div className="do-summary-list"><div><span>סוג חיבור</span><strong>{observerStatusLabel(selected.connector_type)}</strong></div><div><span>מצב</span><strong>{observerStatusLabel(selected.status)}</strong></div><div><span>בריאות</span><strong>{observerStatusLabel(selected.health_status)}</strong></div><div><span>בדיקה אחרונה</span><strong>{formatObserverDate(selected.last_health_check_at)}</strong></div><div><span>מיקום</span><strong>{selected.location_label || "טרם הוגדר"}</strong></div><div><span>וידאו חי</span><strong>{selectedHasLiveGateway ? "מחובר דרך Gateway" : "לא פעיל"}</strong></div></div><div className="do-notice info"><LockKeyhole /><span>כתובת המקור, שם המשתמש, הסיסמה ו-secret reference אינם נשלחים לדפדפן.</span></div><div className="do-button-row"><ObserverQuickAction endpoint="/api/digital-observer/cameras" body={{ action: "test_readiness", id: selected.id }}><ShieldCheck /> בדיקת מוכנות</ObserverQuickAction><ObserverQuickAction endpoint="/api/digital-observer/cameras" body={{ action: "disable", id: selected.id }} confirmText="להשבית את מקור המצלמה?"><CameraOff /> השבתה</ObserverQuickAction></div></article>
        {selected.connector_type === "demo" && selected.source_mode === "demo" ? <article className="do-panel do-form-section"><div className="do-section-head"><div><h2>מקור הדמיה</h2><p>הפעולה מסירה רק מצלמה סינתטית ואת נתוני הדמו המשויכים אליה.</p></div><CameraOff /></div><ObserverQuickAction endpoint="/api/digital-observer/cameras" body={{ action: "remove_demo_bundle", id: selected.id }} confirmText="להסיר את מצלמת ההדמיה ואת נתוני הדמו המשויכים אליה?"><CameraOff /> הסרת דמו</ObserverQuickAction></article> : null}
        <article className="do-panel do-camera-recent-events"><div className="do-section-head"><div><h2>אירועים אחרונים</h2><p>רק אירועים שנקלטו בפועל במקור זה.</p></div></div>{cameraSignals.length ? <div className="do-row-list">{cameraSignals.map((signal) => <Link className="do-row" href={`/digital-observer/alerts?event=${signal.id}`} key={signal.id}><CircleDot /><span className="do-row-main"><strong>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</strong><small>{signal.recommended_action || "ממתין לבדיקה"}</small></span><time>{formatObserverDate(signal.created_at, { year: undefined, month: undefined, day: undefined })}</time></Link>)}</div> : <div className="do-empty compact"><ShieldCheck /><strong>אין אירועים להצגה</strong><span>לא מוצגת פעילות מדומה.</span></div>}</article>
        <article className="do-panel do-camera-context-panel"><div className="do-section-head"><div><h2>סביבת המצלמה</h2><p>הקשר שקובע אילו תובנות יוצגו עבור המקור הזה.</p></div><CircleDot /></div><dl><div><dt>תיאור החלל</dt><dd>{selected.location_label || "טרם הוגדר תיאור חלל"}</dd></div><div><dt>דגשים</dt><dd>{monitoringTargets.length ? monitoringTargets.join(" · ") : "טרם נבחרו דגשי ניטור"}</dd></div><div><dt>אירוע אחרון</dt><dd>{latestCameraNarrative ? <Link href={`/digital-observer/alerts?event=${latestCameraSignal?.id}`}>{latestCameraNarrative.label} · {formatObserverDate(latestCameraSignal?.created_at)}</Link> : "לא נקלט אירוע מאומת"}</dd></div><div><dt>תובנה אחרונה</dt><dd>{latestCameraNarrative ? latestCameraNarrative.summary : selectedHasLiveGateway ? "השידור החי פעיל; תובנות יופיעו רק לאחר אירוע מאומת." : "התצפיתן כבוי עד שהשידור החי יחזור."}</dd></div></dl></article></aside>
        </div>
        {site ? <ObserverConversationPanel siteId={site.id} cameraSourceId={selected.id} cameraName={selected.display_name || "המצלמה"} ruleSummary={cameraRule ? { title: cameraRule.title, description: cameraRule.description, active: Boolean(cameraRule.active) } : null} initialPrompt={cameraSignals.length ? `מצאתי ${cameraSignals.length} אירועים אחרונים מהמצלמה הזאת. אפשר לשאול מה קרה או לבקש ממני לשים לב למשהו מעכשיו.` : selectedHasLiveGateway ? "המצלמה מחוברת. אפשר לשאול מה קרה בה או להגדיר דבר שחשוב שאבדוק." : "המצלמה אינה זמינה כרגע. אפשר לעיין במידע שכבר נשמר או לבקש שאבדוק דבר מסוים כשהחיבור יחזור."} /> : null}
      </section> : null}
      {!selected ? <section className="do-camera-connection-note"><LockKeyhole /><div><strong>חיבור מאובטח וגמיש</strong><span>IP/ONVIF, NVR/DVR, ספק ענן ו-Edge Gateway נבחרים באשף. פרטי גישה אינם נשמרים בדפדפן.</span></div><Link className="do-link" href={site ? `/digital-observer/cameras/add?site=${site.id}` : "/digital-observer/onboarding"}>פתיחת אשף החיבור</Link></section> : null}
    </div>
  </ObserverAppShell>;
}
