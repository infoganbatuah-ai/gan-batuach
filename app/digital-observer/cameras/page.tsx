import Link from "next/link";
import { ArrowRight, Bell, Camera, CameraOff, CircleDot, Grid2X2, Image, Lightbulb, List, LockKeyhole, Maximize2, Mic, Plus, Search, ServerCog, Settings2, Share2, ShieldCheck, Siren, Video, Volume2, Wifi } from "lucide-react";
import { ObserverQuickAction } from "@/components/digital-observer/observer-action-forms";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { ObserverCameraMedia } from "@/components/digital-observer/observer-camera-media";
import { ObserverLivePlayer } from "@/components/digital-observer/observer-live-player";
import { ObserverCameraControls } from "@/components/digital-observer/observer-camera-controls";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { formatObserverDate, loadObserverRuntime, observerEventLabel, observerModeForSite, observerSignalMatchesCamera, observerStatusLabel } from "@/lib/domain/digital-observer/runtime";

type PageProps = { searchParams?: Promise<{ camera?: string; site?: string; q?: string; status?: string; location?: string }> };

function sceneFor(index: number, mode: "home" | "business") {
  const scenes = mode === "home" ? ["home-entry", "home-living", "home-nursery", "home-yard"] : ["business-entry", "business-store", "business-warehouse", "business-office", "business-parking", "business-loading"];
  return scenes[index % scenes.length];
}

export default async function DigitalObserverCamerasPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/cameras");
  const runtime = await loadObserverRuntime(profile.id);
  const site = runtime.sites.find((item) => item.id === params?.site) ?? runtime.sites[0] ?? null;
  const mode = observerModeForSite(site);
  const cameras = site ? runtime.cameras.filter((item) => item.observer_site_id === site.id) : [];
  const query = params?.q?.trim().toLocaleLowerCase("he-IL") ?? "";
  const locations = [...new Set(cameras.map((camera) => String(camera.location_label || "").trim()).filter(Boolean))].slice(0, 8);
  const filteredCameras = cameras.filter((camera) => {
    const matchesQuery = !query || `${camera.display_name ?? ""} ${camera.location_label ?? ""}`.toLocaleLowerCase("he-IL").includes(query);
    const status = String(camera.status || camera.health_status || "readiness");
    const matchesStatus = !params?.status || params.status === "all" || (params.status === "active" ? ["connected", "healthy", "online"].includes(status) : status === params.status);
    const matchesLocation = !params?.location || params.location === "all" || camera.location_label === params.location;
    return matchesQuery && matchesStatus && matchesLocation;
  });
  const selected = params?.camera ? cameras.find((item) => item.id === params.camera) ?? null : null;
  const selectedHasLiveGateway = Boolean(site && selected?.metadata?.gateway_stream_id);
  const cameraSignals = selected ? runtime.signals.filter((signal) => observerSignalMatchesCamera(signal, selected.id)).slice(0, 4) : [];
  const recentSiteSignals = site ? runtime.signals.filter((signal) => signal.observer_site_id === site.id).slice(0, 5) : [];
  const connectedCount = cameras.filter((camera) => ["connected", "healthy", "online"].includes(String(camera.status || camera.health_status))).length;
  const camerasHref = `/digital-observer/cameras${site ? `?site=${site.id}` : ""}`;
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/cameras" title={mode === "home" ? "צפייה חיה" : "מצלמות"} statusLabel={`${connectedCount}/${cameras.length} מקורות זמינים`} mobileBackHref={selected ? camerasHref : undefined} actions={<Link className="do-button primary" href={site ? `/digital-observer/cameras/add?site=${site.id}` : "/digital-observer/onboarding"}><Plus /> הוספת מצלמה</Link>}>
    <div className={`do-page-stack do-camera-workspace do-camera-workspace-${mode}`}>
      {!runtime.runtimeMigrationApplied ? <div className="do-notice warn"><ServerCog /><span>טבלת מקורות המצלמה החדשה עדיין אינה זמינה בסביבה. אין אפשרות ליצור חיבור עד החלת המיגרציה.</span></div> : null}
      {!selected ? <section className="do-camera-browser">
        <div className="do-camera-browser-head">
          <div><h1>{mode === "home" ? "המצלמות שלי" : site?.name || "מצלמות העסק"}</h1><p>{mode === "home" ? "כל מקורות הבית במקום אחד, עם מעבר מהיר לפרטים ולמצב החיבור." : "תמונת מצב מרוכזת לפי אתר, מיקום ובריאות החיבור."}</p></div>
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
          return <Link className="do-camera-live-tile" href={`/digital-observer/cameras?site=${site?.id}&camera=${camera.id}`} key={camera.id}><ObserverCameraMedia name={camera.display_name || "מצלמה"} mode={mode} scene={camera.preview_scene || sceneFor(originalIndex, mode)} status={camera.status || camera.health_status} sourceMode={camera.source_mode} /><span className="do-camera-tile-meta"><strong>{camera.display_name || "מצלמה"}</strong><small>{camera.location_label || observerStatusLabel(camera.connector_type)}</small></span></Link>;
        })}</div>
          {mode === "business" ? <aside className="do-camera-activity-panel do-panel"><div><strong>פעילות שנקלטה</strong><small>אירועים קיימים בלבד</small></div>{recentSiteSignals.length ? <nav>{recentSiteSignals.map((signal) => <Link href={`/digital-observer/alerts?event=${signal.id}`} key={signal.id}><CircleDot /><span><b>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</b><small>{signal.recommended_action || "ממתין לבדיקה"}</small></span></Link>)}</nav> : <div className="do-empty compact"><ShieldCheck /><strong>אין פעילות</strong><span>לא מוצגים אירועים מזויפים.</span></div>}<Link className="do-link" href="/digital-observer/alerts">צפייה בכל האירועים</Link></aside> : null}
        </div> : <div className="do-empty"><CameraOff /><strong>{cameras.length ? "לא נמצאו מצלמות בסינון" : "אין מצלמות מחוברות"}</strong><span>{cameras.length ? "שנו את החיפוש או הסינון." : "הוסיפו מקור הדמיה או מקור שממתין ל-Gateway. אין צורך להזין סודות בדפדפן."}</span>{!cameras.length ? <Link className="do-button primary" href={site ? `/digital-observer/cameras/add?site=${site.id}` : "/digital-observer/onboarding"}>הוספת מצלמה</Link> : null}</div>}
        <div className="do-camera-control-dock" aria-label="בקרות צפייה"><button type="button" className="active" aria-label="רשת מצלמות"><Grid2X2 /></button><button type="button" disabled title="שמע יתאפשר רק לאחר חיבור מאושר"><Mic /></button><button type="button" disabled title="צילום תמונה יתאפשר רק ממקור וידאו מחובר"><Image /></button><button type="button" disabled title="עוצמת שמע אינה זמינה במצב מוכנות"><Volume2 /></button><span>{connectedCount ? `${connectedCount} מקורות זמינים` : "מצב מוכנות · אין שידור חי"}</span></div>
      </section> : null}
      {selected ? <section className="do-camera-detail-view">
        <Link className="do-link do-camera-back" href={camerasHref}><ArrowRight /> חזרה למצלמות</Link>
        <div className="do-camera-detail-grid">
        <article className="do-panel do-camera-player-panel">
          <div className="do-camera-detail-head"><div><h1>{selected.display_name || "מצלמה"}</h1><span className="do-status-dot good">{observerStatusLabel(selected.status || selected.health_status)}</span></div><button type="button" disabled title="מסך מלא יתאפשר כשנגן וידאו מאובטח יחובר"><Maximize2 /></button></div>
          {selectedHasLiveGateway && site ? <ObserverLivePlayer large observerSiteId={site.id} cameraSourceId={selected.id} name={selected.display_name || "מצלמה"} /> : <ObserverCameraMedia large name={selected.display_name} mode={mode} scene={selected.preview_scene || sceneFor(cameras.indexOf(selected), mode)} status={selected.status || selected.health_status} sourceMode={selected.source_mode} />}
          {selectedHasLiveGateway ? <ObserverCameraControls cameraSourceId={selected.id} name={selected.display_name || "מצלמה"} talkSupported={Boolean(selected.metadata?.talk_supported)} /> : <div className="do-camera-live-controls" aria-label="פעולות צפייה חיה"><button type="button" disabled><Volume2 /><strong>שמע</strong><small>ממתין לחיבור</small></button><button type="button" disabled><Camera /><strong>צילום</strong><small>ממתין לחיבור</small></button><button type="button" disabled><Mic /><strong>דבר</strong><small>לא נתמך</small></button><button type="button" disabled><Video /><strong>הקלטה</strong><small>ממתין לחיבור</small></button></div>}
          <div className="do-camera-quick-actions" aria-label="פעולות מהירות">
            <button type="button" disabled title="חיבור לבית חכם עדיין אינו פעיל"><Lightbulb /><span><strong>אור חכם</strong><small>מוכן להגדרה</small></span></button>
            <button type="button" disabled title="הפעלת אזעקה חיה אינה זמינה בשלב ההכנה"><Siren /><span><strong>אזעקה</strong><small>לא פעיל בפיילוט</small></span></button>
            <Link href="/digital-observer/alerts"><Bell /><span><strong>התראות</strong><small>פתיחת מרכז ההתראות</small></span></Link>
            <Link href="/digital-observer/settings"><Share2 /><span><strong>שיתוף גישה</strong><small>ניהול הרשאות ושיתוף</small></span></Link>
          </div>
          <div className="do-camera-readiness-strip"><CircleDot /><span><strong>{selectedHasLiveGateway ? "צפייה חיה מאובטחת" : "צפייה מאובטחת במצב מוכנות"}</strong><small>{selectedHasLiveGateway ? "הווידאו מועבר דרך Gateway מאומת וטוקן קצר־חיים." : "וידאו חי, שמע והקלטה ייפתחו רק לאחר Gateway וטוקן קצר."}</small></span><Wifi /></div>
        </article>
        <aside className="do-camera-detail-side"><article className="do-panel do-form-section"><div className="do-section-head"><div><h2>פרטי המצלמה</h2><p>המקור מוגן ואינו חושף פרטי גישה.</p></div><Settings2 /></div><div className="do-summary-list"><div><span>סוג חיבור</span><strong>{observerStatusLabel(selected.connector_type)}</strong></div><div><span>מצב</span><strong>{observerStatusLabel(selected.status)}</strong></div><div><span>בריאות</span><strong>{observerStatusLabel(selected.health_status)}</strong></div><div><span>בדיקה אחרונה</span><strong>{formatObserverDate(selected.last_health_check_at)}</strong></div><div><span>מיקום</span><strong>{selected.location_label || "טרם הוגדר"}</strong></div><div><span>וידאו חי</span><strong>{selectedHasLiveGateway ? "מחובר דרך Gateway" : "לא פעיל"}</strong></div></div><div className="do-notice info"><LockKeyhole /><span>כתובת המקור, שם המשתמש, הסיסמה ו-secret reference אינם נשלחים לדפדפן.</span></div><div className="do-button-row"><ObserverQuickAction endpoint="/api/digital-observer/cameras" body={{ action: "test_readiness", id: selected.id }}><ShieldCheck /> בדיקת מוכנות</ObserverQuickAction><ObserverQuickAction endpoint="/api/digital-observer/cameras" body={{ action: "disable", id: selected.id }} confirmText="להשבית את מקור המצלמה?"><CameraOff /> השבתה</ObserverQuickAction></div></article>
        <article className="do-panel do-camera-recent-events"><div className="do-section-head"><div><h2>אירועים אחרונים</h2><p>רק אירועים שנקלטו בפועל במקור זה.</p></div></div>{cameraSignals.length ? <div className="do-row-list">{cameraSignals.map((signal) => <Link className="do-row" href={`/digital-observer/alerts?event=${signal.id}`} key={signal.id}><CircleDot /><span className="do-row-main"><strong>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</strong><small>{signal.recommended_action || "ממתין לבדיקה"}</small></span><time>{formatObserverDate(signal.created_at, { year: undefined, month: undefined, day: undefined })}</time></Link>)}</div> : <div className="do-empty compact"><ShieldCheck /><strong>אין אירועים להצגה</strong><span>לא מוצגת פעילות מדומה.</span></div>}</article></aside>
        </div>
      </section> : null}
      {!selected ? <section className="do-camera-connection-note"><LockKeyhole /><div><strong>חיבור מאובטח וגמיש</strong><span>IP/ONVIF, NVR/DVR, ספק ענן ו-Edge Gateway נבחרים באשף. פרטי גישה אינם נשמרים בדפדפן.</span></div><Link className="do-link" href={site ? `/digital-observer/cameras/add?site=${site.id}` : "/digital-observer/onboarding"}>פתיחת אשף החיבור</Link></section> : null}
    </div>
  </ObserverAppShell>;
}
