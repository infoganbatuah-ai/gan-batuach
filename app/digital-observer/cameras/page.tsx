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
import { digitalObserverCameraHasLiveStream, digitalObserverCameraIsAssigned, digitalObserverCameraOperationalState } from "@/lib/domain/digital-observer/camera-live-status";
import { observerEventNarrative } from "@/lib/domain/digital-observer/event-narrative";
import { formatObserverDate, loadObserverRuntime, observerEventLabel, observerModeForSite, observerSignalMatchesCamera, selectObserverSite } from "@/lib/domain/digital-observer/runtime";
import { observerCameraEmptyState } from "@/lib/ui/observer-camera-empty-state";

type PageProps = { searchParams?: Promise<{ camera?: string; site?: string; q?: string; status?: string; location?: string }> };

const statusLabels = {
  ONLINE: "זמינה לצפייה חיה",
  RECOVERING: "החיבור מתאושש",
  OFFLINE: "לא זמינה כרגע",
  SIMULATION: "הדמיה · ללא שידור חי",
} as const;

const connectionLabels = new Map([
  ["gateway", "Gateway"],
  ["vendor_cloud_api", "ממשק ספק ענן"],
  ["direct_secure", "חיבור ישיר מאובטח"],
  ["dvr_nvr", "מקליט"],
  ["physical_gateway", "Gateway פיזי"],
  ["enterprise_edge", "מתאם עסקי מקומי"],
  ["software_connector", "מחבר תוכנה"],
  ["local_connector", "מחבר מקומי"],
  ["hardware_gateway", "Gateway פיזי"],
  ["dvr", "מקליט"],
  ["nvr", "מקליט רשת"],
  ["edge_gateway", "Gateway מקומי"],
  ["rtsp", "RTSP"],
  ["onvif", "ONVIF"],
  ["cloud_provider", "ספק ענן"],
  ["demo", "הדמיה"],
]);

function CameraUnavailablePreview({ state, name, large = false }: {
  state: "RECOVERING" | "OFFLINE";
  name?: string;
  large?: boolean;
}) {
  return <div className={`do-camera-media is-readiness${large ? " large" : ""}`}>
    <span className="do-camera-status readiness">{statusLabels[state]}</span>
    {name ? <span className="do-camera-name">{name}</span> : null}
    <span className="do-camera-lock"><CameraOff aria-hidden="true" />
      <small>{state === "RECOVERING" ? "ממתינים לדיווח תקין מהמקור" : "צפייה חיה אינה זמינה"}</small>
    </span>
  </div>;
}

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
  const assigned = runtime.cameras.filter(digitalObserverCameraIsAssigned);
  const requestedCamera = assigned.find((camera) => camera.id === params?.camera);
  const site = selectObserverSite(runtime.sites, assigned, params?.site ?? requestedCamera?.observer_site_id);
  const mode = observerModeForSite(site);
  const siteCameras = assigned.filter((camera) => site && camera.observer_site_id === site.id);
  const freshness = { now: runtime.cameraHealthReadAt };
  const realCameras = siteCameras.flatMap((camera) => {
    const state = digitalObserverCameraOperationalState(camera, freshness);
    if (state === "SIMULATION" || state === "CHANNEL_EMPTY") return [];
    const canPlay = digitalObserverCameraHasLiveStream(camera, freshness);
    return [{ camera, canPlay, state: state === "ONLINE" && !canPlay ? "OFFLINE" as const : state }];
  });
  const query = params?.q?.trim().toLocaleLowerCase("he-IL") ?? "";
  const locations = [...new Set(realCameras.map(({ camera }) => String(camera.location_label || "").trim()).filter(Boolean))].slice(0, 8);
  const filteredCameras = realCameras.filter(({ camera, canPlay, state }) => {
    const matchesQuery = !query || `${camera.display_name ?? ""} ${camera.location_label ?? ""}`.toLocaleLowerCase("he-IL").includes(query);
    const status = String(camera.metadata?.reported_status ?? camera.status ?? camera.health_status ?? "readiness");
    const matchesStatus = !params?.status || params.status === "all"
      || (params.status === "active" ? canPlay
        : params.status === "offline" ? !canPlay
        : params.status === "readiness" ? state === "RECOVERING"
        : status === params.status);
    const matchesLocation = !params?.location || params.location === "all" || camera.location_label === params.location;
    return matchesQuery && matchesStatus && matchesLocation;
  });
  const selected = params?.camera ? siteCameras.find((item) => item.id === params.camera) : undefined;
  const selectedEntry = realCameras.find(({ camera }) => camera === selected);
  const selectedIsDemo = selected?.source_mode === "demo";
  const selectedState = selectedIsDemo ? "SIMULATION" : selectedEntry?.state ?? "OFFLINE";
  const selectedHasLiveGateway = selectedEntry?.canPlay ?? false;
  const connectionType = connectionLabels.get(String(selected?.connector_type ?? "").toLowerCase());
  const connectionMethod = connectionLabels.get(String(selected?.connection?.connection_method ?? "").toLowerCase()) ?? connectionType;
  const healthCheckAt = selected?.last_health_check_at;
  const lastHealthCheck = typeof healthCheckAt === "string" && Number.isFinite(Date.parse(healthCheckAt))
    ? new Date(healthCheckAt).toISOString() : null;
  const cameraSignals = selected ? runtime.signals.filter((signal) => observerSignalMatchesCamera(signal, selected.id)).slice(0, 4) : [];
  const latestCameraSignal = cameraSignals[0] ?? null;
  const latestCameraNarrative = latestCameraSignal ? observerEventNarrative(latestCameraSignal) : null;
  const monitoringTargets = selected && Array.isArray(selected.monitoring_targets)
    ? selected.monitoring_targets.map(monitoringTargetLabel).filter((value): value is string => Boolean(value)).slice(0, 4)
    : [];
  const cameraRule = selected ? runtime.watchRequests.find((rule) => rule.camera_source_id === selected.id) ?? null : null;
  const recentSiteSignals = site ? runtime.signals.filter((signal) => signal.observer_site_id === site.id).slice(0, 5) : [];
  const connectedCount = realCameras.filter(({ canPlay }) => canPlay).length;
  const offlineCount = realCameras.length - connectedCount;
  const recoveringCount = realCameras.filter(({ state }) => state === "RECOVERING").length;
  function cameraListHref(filters: { camera?: string; status?: string; q?: string; location?: string } = {}) {
    const entries = new URLSearchParams();
    if (site) entries.set("site", site.id);
    for (const [key, value] of Object.entries(filters)) {
      if (value) entries.set(key, value);
    }
    const suffix = entries.toString();
    return suffix ? `/digital-observer/cameras?${suffix}` : "/digital-observer/cameras";
  }
  const currentFilters = { status: params?.status, q: params?.q, location: params?.location };
  const camerasHref = cameraListHref();
  const backHref = cameraListHref(currentFilters);
  const emptyState = observerCameraEmptyState({
    cameraCount: realCameras.length,
    offlineCount,
    status: params?.status,
  });
  const addHref = site ? `/digital-observer/cameras/add?site=${encodeURIComponent(site.id)}` : "/digital-observer/onboarding";
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/cameras" title="מצלמות" statusLabel={`${connectedCount} זמינות לצפייה חיה`} mobileBackHref={selected ? backHref : undefined} actions={<Link className="do-button primary" href={addHref}><Plus /> הוספת מצלמות</Link>}>
    <div className={`do-page-stack do-camera-workspace do-camera-workspace-${mode}`}>
      {!runtime.runtimeMigrationApplied ? <div className="do-notice warn"><ServerCog /><span>טבלת מקורות המצלמה החדשה עדיין אינה זמינה בסביבה. אין אפשרות ליצור חיבור עד החלת המיגרציה.</span></div> : null}
      {!selected ? <section className="do-camera-browser">
        <div className="do-camera-browser-head">
          <div>
            <h1>{params?.status === "offline" ? "מצלמות ללא שידור זמין" : mode === "home" ? "המצלמות שלי" : site?.name || "מצלמות העסק"}</h1>
            <p>{realCameras.length} משויכות · {connectedCount} זמינות לצפייה חיה · {offlineCount} ללא שידור זמין</p>
          </div>
          {mode === "home" ? <div className="do-view-switch" aria-label="בחירת תצוגה"><button type="button" className="active" aria-label="תצוגת רשת" title="תצוגת רשת"><Grid2X2 /></button><button type="button" disabled aria-label="תצוגת רשימה אינה זמינה" title="תצוגת רשימה תתווסף לאחר חיבור Gateway"><List /></button></div> : null}
        </div>
        <form className="do-camera-filter-strip" method="get" action="/digital-observer/cameras">
          {site ? <input type="hidden" name="site" value={site.id} /> : null}
          <label><Search /><input name="q" aria-label="חיפוש מצלמה או מיקום" defaultValue={params?.q || ""} placeholder="חיפוש מצלמה או מיקום" /></label>
          <select name="status" defaultValue={params?.status || "all"} aria-label="סינון לפי מצב"><option value="all">כל המצבים</option><option value="active">זמינות לצפייה חיה</option><option value="offline">ללא שידור זמין</option><option value="readiness">מתאוששות</option><option value="disabled">מושבתות</option></select>
          <select name="location" defaultValue={params?.location || "all"} aria-label="סינון לפי מיקום"><option value="all">כל המיקומים</option>{locations.map((location) => <option value={location} key={location}>{location}</option>)}</select>
          <button className="do-button secondary" type="submit">סינון</button>
          {mode === "business" ? <div className="do-view-switch do-business-view-switch" aria-label="בחירת פריסה"><button type="button" className="active" aria-label="תצוגת רשת" title="תצוגת רשת"><Grid2X2 /></button><button type="button" disabled aria-label="תצוגת רשימה אינה זמינה" title="תצוגת רשימה תתווסף לאחר חיבור Gateway"><List /></button></div> : null}
        </form>
        {filteredCameras.length ? <div className={mode === "business" ? "do-business-camera-layout" : undefined}>
          {mode === "business" ? <aside className="do-camera-filter-panel do-panel">
            <strong>סינון חכם</strong><span>מצב מצלמה</span>
            <nav>
              <Link className={!params?.status || params.status === "all" ? "active" : ""} href={cameraListHref({ ...currentFilters, status: undefined })}>הכול <b>{realCameras.length}</b></Link>
              <Link className={params?.status === "active" ? "active" : ""} href={cameraListHref({ ...currentFilters, status: "active" })}>זמינות <b>{connectedCount}</b></Link>
              <Link className={params?.status === "offline" ? "active" : ""} href={cameraListHref({ ...currentFilters, status: "offline" })}>ללא שידור <b>{offlineCount}</b></Link>
              <Link className={params?.status === "readiness" ? "active" : ""} href={cameraListHref({ ...currentFilters, status: "readiness" })}>מתאוששות <b>{recoveringCount}</b></Link>
            </nav>
            {locations.length ? <><span>מיקום</span><nav>{locations.map((location) =>
              <Link className={params?.location === location ? "active" : ""} href={cameraListHref({ ...currentFilters, location })} key={location}>{location}</Link>
            )}</nav></> : null}
            <Link className="do-button secondary full" href={camerasHref}>ניקוי סינונים</Link>
          </aside> : null}
          <div className={`do-camera-live-grid ${mode}`}>{filteredCameras.map(({ camera, canPlay, state }) => {
            const cameraHref = cameraListHref({ ...currentFilters, camera: camera.id });
            const name = camera.display_name || "מצלמה";
            return <article className="do-camera-live-tile" key={camera.id}>
              <Link className="do-camera-live-open" href={cameraHref} aria-label={`פתיחת ${name} · ${statusLabels[state]}`}>
                {canPlay && site ? <ObserverLivePlayer compact observerSiteId={site.id} cameraSourceId={camera.id} name={name} />
                  : <CameraUnavailablePreview name={name} state={state === "RECOVERING" ? "RECOVERING" : "OFFLINE"} />}
              </Link>
              <span className="do-camera-tile-meta">
                <span className="do-camera-tile-title">
                  <Link href={cameraHref}>{name}</Link>
                  <ObserverCameraInlineRename camera={{ id: camera.id, display_name: camera.display_name, location_label: camera.location_label }} />
                </span>
                <small>{statusLabels[state]}{camera.location_label ? ` · ${camera.location_label}` : ""}</small>
              </span>
            </article>;
          })}</div>
          {mode === "business" ? <aside className="do-camera-activity-panel do-panel"><div><strong>פעילות שנקלטה</strong><small>אירועים קיימים בלבד</small></div>{recentSiteSignals.length ? <nav>{recentSiteSignals.map((signal) => <Link href={`/digital-observer/alerts?event=${signal.id}`} key={signal.id}><CircleDot /><span><b>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</b><small>{signal.recommended_action || "ממתין לבדיקה"}</small></span></Link>)}</nav> : <div className="do-empty compact"><ShieldCheck /><strong>אין פעילות</strong><span>לא מוצגים אירועים מזויפים.</span></div>}<Link className="do-link" href="/digital-observer/alerts">צפייה בכל האירועים</Link></aside> : null}
        </div> : <div className="do-empty"><CameraOff /><strong>{emptyState.title}</strong><span>{emptyState.description}</span>{emptyState.action === "add_camera" ? <Link className="do-button primary" href={addHref}>הוספת מצלמות</Link> : emptyState.action === "clear_filters" ? <Link className="do-button secondary" href={camerasHref}>ניקוי סינון</Link> : null}</div>}
        <div className="do-camera-control-dock" aria-label="בקרות צפייה"><button type="button" className="active" aria-label="רשת מצלמות"><Grid2X2 /></button><button type="button" disabled title="שמע יתאפשר רק לאחר חיבור מאושר"><Mic /></button><button type="button" disabled title="צילום תמונה יתאפשר רק ממקור וידאו מחובר"><ImageIcon /></button><button type="button" disabled title="עוצמת שמע אינה זמינה במצב מוכנות"><Volume2 /></button><span>{connectedCount ? `${connectedCount} מקורות זמינים` : "מצב מוכנות · אין שידור חי"}</span></div>
      </section> : null}
      {selected ? <section className="do-camera-detail-view">
        <Link className="do-link do-camera-back" href={backHref}><ArrowRight /> חזרה למצלמות</Link>
        <div className="do-camera-detail-grid">
        <article className="do-panel do-camera-player-panel">
          <div className="do-camera-detail-head"><div><h1>{selected.display_name || "מצלמה"}</h1><span className={selectedHasLiveGateway ? "do-status-dot good" : "do-status-dot warn"}>{statusLabels[selectedState]}</span></div><button type="button" disabled title="מסך מלא יתאפשר כשנגן וידאו מאובטח יחובר"><Maximize2 /></button></div>
          {selectedHasLiveGateway && site ? <ObserverLivePlayer large observerSiteId={site.id} cameraSourceId={selected.id} name={selected.display_name || "מצלמה"} /> : selectedIsDemo ? <ObserverCameraMedia large name={selected.display_name} mode={mode} scene={selected.preview_scene || sceneFor(siteCameras.indexOf(selected), mode)} status={selected.status || selected.health_status} sourceMode={selected.source_mode} />
            : <CameraUnavailablePreview large state={selectedState === "RECOVERING" ? "RECOVERING" : "OFFLINE"} />}
          {!selectedHasLiveGateway ? <ObserverCameraPresence active={false} /> : null}
          {selectedHasLiveGateway && site ? <ObserverCameraControls observerSiteId={site.id} cameraSourceId={selected.id} name={selected.display_name || "מצלמה"} capabilities={selected.capabilities ?? {}} /> : <div className="do-camera-live-controls" aria-label="פעולות צפייה חיה"><button type="button" disabled><Volume2 /><strong>שמע</strong><small>תצפיתן כבוי</small></button><button type="button" disabled><Camera /><strong>צילום</strong><small>ממתין לחיבור</small></button><button type="button" disabled><Mic /><strong>דבר</strong><small>תצפיתן כבוי</small></button><button type="button" disabled><Video /><strong>הקלטה</strong><small>אירועים בלבד</small></button></div>}
          {site && !selectedIsDemo ? <GuardDiagnosticsPanel key={`${site.id}:${selected.id}`} observerSiteId={site.id} cameraSourceId={selected.id} /> : null}
          <div className="do-camera-quick-actions" aria-label="פעולות מהירות">
            <Link href="/digital-observer/alerts"><Bell /><span><strong>התראות</strong><small>פתיחת מרכז ההתראות</small></span></Link>
            <Link href="/digital-observer/settings"><Share2 /><span><strong>שיתוף גישה</strong><small>ניהול הרשאות ושיתוף</small></span></Link>
          </div>
          <div className="do-camera-readiness-strip"><CircleDot /><span><strong>{selectedHasLiveGateway ? "צפייה חיה מאובטחת" : "צפייה מאובטחת במצב מוכנות"}</strong><small>{selectedHasLiveGateway ? "הווידאו מתקבל דרך מתאם מאומת והרשאת צפייה קצרת־חיים." : "וידאו חי, שמע והקלטה ייפתחו רק לאחר חיבור מקור מאומת."}</small></span><Wifi /></div>
        </article>
        <aside className="do-camera-detail-side"><article className="do-panel do-form-section"><div className="do-section-head"><div><h2>פרטי המצלמה</h2><p>השם והחלל משמשים כהקשר לתצפיתן.</p></div><Settings2 /></div><ObserverCameraNameForm camera={{
          id: selected.id,
          display_name: selected.display_name,
          location_label: selected.location_label,
          metadata: {
            zone_type: selected.metadata?.zone_type,
            ai_suggested_name: selected.metadata?.ai_suggested_name,
            crossing_line: selected.metadata?.crossing_line && {
              axis: selected.metadata.crossing_line.axis,
              position: selected.metadata.crossing_line.position,
              inside: selected.metadata.crossing_line.inside,
            },
          },
        }} />
        <div className="do-summary-list">
          {connectionType ? <div><span>סוג מערכת</span><strong>{connectionType}</strong></div> : null}
          {connectionMethod ? <div><span>דרך חיבור</span><strong>{connectionMethod}</strong></div> : null}
          <div><span>מצב</span><strong>{selectedIsDemo ? "הדמיה" : statusLabels[selectedState]}</strong></div>
          {lastHealthCheck ? <div><span>בדיקה אחרונה</span><strong><time dateTime={lastHealthCheck}>{formatObserverDate(lastHealthCheck)}</time></strong></div> : null}
          <div><span>מיקום</span><strong>{selected.location_label || "טרם הוגדר"}</strong></div>
        </div><div className="do-notice info"><LockKeyhole /><span>כתובת המקור, שם המשתמש, הסיסמה ו-secret reference אינם נשלחים לדפדפן.</span></div><div className="do-button-row"><ObserverQuickAction endpoint="/api/digital-observer/cameras" body={{ action: "test_readiness", id: selected.id }}><ShieldCheck /> בדיקת מוכנות</ObserverQuickAction><ObserverQuickAction endpoint="/api/digital-observer/cameras" body={{ action: "disable", id: selected.id }} confirmText="להשבית את מקור המצלמה?"><CameraOff /> השבתה</ObserverQuickAction></div></article>
        {selected.connector_type === "demo" && selected.source_mode === "demo" ? <article className="do-panel do-form-section"><div className="do-section-head"><div><h2>מקור הדמיה</h2><p>הפעולה מסירה רק מצלמה סינתטית ואת נתוני הדמו המשויכים אליה.</p></div><CameraOff /></div><ObserverQuickAction endpoint="/api/digital-observer/cameras" body={{ action: "remove_demo_bundle", id: selected.id }} confirmText="להסיר את מצלמת ההדמיה ואת נתוני הדמו המשויכים אליה?"><CameraOff /> הסרת דמו</ObserverQuickAction></article> : null}
        <article className="do-panel do-camera-recent-events"><div className="do-section-head"><div><h2>אירועים אחרונים</h2><p>רק אירועים שנקלטו בפועל במקור זה.</p></div></div>{cameraSignals.length ? <div className="do-row-list">{cameraSignals.map((signal) => <Link className="do-row" href={`/digital-observer/alerts?event=${signal.id}`} key={signal.id}><CircleDot /><span className="do-row-main"><strong>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</strong><small>{signal.recommended_action || "ממתין לבדיקה"}</small></span><time>{formatObserverDate(signal.created_at, { year: undefined, month: undefined, day: undefined })}</time></Link>)}</div> : <div className="do-empty compact"><ShieldCheck /><strong>אין אירועים להצגה</strong><span>לא מוצגת פעילות מדומה.</span></div>}</article>
        <article className="do-panel do-camera-context-panel"><div className="do-section-head"><div><h2>סביבת המצלמה</h2><p>הקשר שקובע אילו תובנות יוצגו עבור המקור הזה.</p></div><CircleDot /></div><dl><div><dt>תיאור החלל</dt><dd>{selected.location_label || "טרם הוגדר תיאור חלל"}</dd></div><div><dt>דגשים</dt><dd>{monitoringTargets.length ? monitoringTargets.join(" · ") : "טרם נבחרו דגשי ניטור"}</dd></div><div><dt>אירוע אחרון</dt><dd>{latestCameraNarrative ? <Link href={`/digital-observer/alerts?event=${latestCameraSignal?.id}`}>{latestCameraNarrative.label} · {formatObserverDate(latestCameraSignal?.created_at)}</Link> : "לא נקלט אירוע מאומת"}</dd></div><div><dt>תובנה אחרונה</dt><dd>{latestCameraNarrative ? latestCameraNarrative.summary : selectedIsDemo ? "מקור הדמיה בלבד; אין שידור חי או תובנות ממצלמה אמיתית." : selectedHasLiveGateway ? "המקור זמין לצפייה חיה. תובנות יופיעו לאחר אירוע מאומת." : "התצפיתן כבוי עד שהשידור החי יחזור."}</dd></div></dl></article></aside>
        </div>
        {site ? <ObserverConversationPanel siteId={site.id} cameraSourceId={selected.id} cameraName={selected.display_name || "המצלמה"} ruleSummary={cameraRule ? { title: cameraRule.title, description: cameraRule.description, active: Boolean(cameraRule.active) } : null} initialPrompt={cameraSignals.length ? `מצאתי ${cameraSignals.length} אירועים אחרונים מהמצלמה הזאת. אפשר לשאול מה קרה או לבקש ממני לשים לב למשהו מעכשיו.` : selectedIsDemo ? "זהו מקור הדמיה בלבד, ללא שידור חי. אפשר לעיין במידע שמור בלי להניח שהמצלמה מחוברת." : selectedHasLiveGateway ? "המצלמה מחוברת. אפשר לשאול מה קרה בה או להגדיר דבר שחשוב שאבדוק." : "המצלמה אינה זמינה כרגע. אפשר לעיין במידע שכבר נשמר או לבקש שאבדוק דבר מסוים כשהחיבור יחזור."} /> : null}
      </section> : null}
      {!selected ? <section className="do-camera-connection-note"><LockKeyhole /><div><strong>Digital‑First: משתמשים קודם בציוד שכבר מותקן</strong><span>האשף בודק ספק ענן, חיבור ישיר, ONVIF/RTSP ומחבר תוכנה לפני המלצה על Gateway פיזי. פרטי גישה אינם נשמרים בדפדפן.</span></div><Link className="do-link" href={addHref}>פתיחת אשף החיבור</Link></section> : null}
    </div>
  </ObserverAppShell>;
}
