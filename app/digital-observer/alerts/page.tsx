import Link from "next/link";
import { AlertTriangle, ArrowRight, Bell, Camera, CheckCircle2, Clock3, Info, LockKeyhole, Maximize2, Pause, Radar, Search, ShieldAlert, ShieldCheck, UserCheck, Volume2 } from "lucide-react";
import { ObserverQuickAction } from "@/components/digital-observer/observer-action-forms";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { ObserverCameraMedia } from "@/components/digital-observer/observer-camera-media";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { formatObserverDate, loadObserverRuntime, observerCameraForSignal, observerEventLabel, observerModeForSite, observerSignalMatchesCamera, observerStatusLabel } from "@/lib/domain/digital-observer/runtime";

type PageProps = { searchParams?: Promise<{ event?: string; site?: string; severity?: string; q?: string; camera?: string; view?: string; preview?: string }> };
const severityClass = (value?: string) => ["critical", "urgent", "high"].includes(String(value)) ? "bad" : value === "medium" ? "warn" : "info";

export default async function DigitalObserverAlertsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/alerts");
  const runtime = await loadObserverRuntime(profile.id);
  const site = runtime.sites.find((item) => item.id === params?.site) ?? runtime.sites[0] ?? null;
  const mode = observerModeForSite(site);
  const allSignals = site ? runtime.signals.filter((item) => item.observer_site_id === site.id) : [];
  const siteCameras = site ? runtime.cameras.filter((item) => item.observer_site_id === site.id) : [];
  const query = params?.q?.trim().toLocaleLowerCase("he-IL") ?? "";
  const signals = allSignals.filter((item) => {
    if (params?.severity && item.severity !== params.severity) return false;
    if (params?.camera && !observerSignalMatchesCamera(item, params.camera)) return false;
    if (!query) return true;
    const linkedCamera = observerCameraForSignal(item, siteCameras);
    return [observerEventLabel(item.metadata?.event_type ?? item.signal_type), item.recommended_action, linkedCamera?.display_name].some((value) => String(value ?? "").toLocaleLowerCase("he-IL").includes(query));
  });
  const selected = params?.event ? allSignals.find((item) => item.id === params.event) ?? null : null;
  const camera = observerCameraForSignal(selected, runtime.cameras);
  const timeline = params?.view === "timeline";
  const notificationPreview = params?.preview === "notification";
  const timelineSelected = signals[0] ?? null;
  const timelineCamera = observerCameraForSignal(timelineSelected, siteCameras);
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/alerts" title={selected ? "פרטי אירוע" : timeline ? "אירועים" : "מרכז ההתראות"} statusLabel="ביקורת אנושית חובה" desktopSearch={{ action: "/digital-observer/alerts", placeholder: "חיפוש אירועים, מצלמות ומיקומים..." }}>
    <div className="do-page-stack do-alert-center">
      {!selected ? <>
        {timeline ? <section className="do-event-timeline-layout">
          <article className="do-panel do-event-timeline-panel">
            <div className="do-alert-filter-bar do-timeline-filter-bar"><Link className="do-button secondary" href="/digital-observer/alerts?view=timeline">הכול</Link><Link className="do-button secondary" href="/digital-observer/alerts?view=timeline&severity=high">סינון</Link><span><Clock3 /> היום</span><Link className="do-link" href="/digital-observer/alerts">מרכז ההתראות</Link></div>
            {signals.length ? <div className="do-event-timeline-list">{signals.slice(0, 5).map((signal) => {
              const linkedCamera = observerCameraForSignal(signal, siteCameras);
              return <Link href={`/digital-observer/alerts?event=${signal.id}&view=timeline`} key={signal.id}><time>{formatObserverDate(signal.created_at, { year: undefined, month: undefined, day: undefined })}</time><span className="do-event-timeline-node"><i /></span><span className={`do-event-timeline-icon ${severityClass(signal.severity)}`}><Radar /></span><span><strong>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</strong><small>{linkedCamera?.display_name || "ללא מצלמה משויכת"}</small></span>{linkedCamera?.source_mode === "demo" ? <span className={`do-event-timeline-preview do-demo-scene scene-${linkedCamera.preview_scene || "home-entry"}`}><small>הדמיה</small></span> : null}</Link>;
        })}</div> : <div className="do-empty"><CheckCircle2 /><strong>אין אירועים להצגה</strong><span>לא יוצגו פריטים סטטיים ללא רשומת אירוע.</span></div>}
          </article>
          <aside className="do-panel do-timeline-detail-panel">
            {timelineSelected ? <><span className={`do-badge ${severityClass(timelineSelected.severity)}`}>{observerStatusLabel(timelineSelected.severity)}</span><h2>פרטי אירוע</h2><dl><div><dt>זמן</dt><dd>{formatObserverDate(timelineSelected.created_at)}</dd></div><div><dt>סוג</dt><dd>{observerEventLabel(timelineSelected.metadata?.event_type ?? timelineSelected.signal_type)}</dd></div><div><dt>מצלמה</dt><dd>{timelineCamera?.display_name || "לא שויכה"}</dd></div></dl>{timelineCamera ? <ObserverCameraMedia name={timelineCamera.display_name} mode={mode} scene={timelineCamera.preview_scene} status={timelineCamera.status || timelineCamera.health_status} sourceMode={timelineCamera.source_mode} /> : null}<Link className="do-button primary full" href={`/digital-observer/alerts?event=${timelineSelected.id}`}>צפייה באירוע</Link></> : <div className="do-empty compact"><Radar /><strong>בחרו אירוע</strong></div>}
          </aside>
        </section> : <article className="do-panel do-alert-list-panel"><div className="do-section-head"><div><h2>מרכז ההתראות</h2><p>כל זיהוי מוצג כהערכה עם רמת ביטחון ומחייב החלטה אנושית.</p></div><span className="do-badge info">{signals.length} אירועים</span></div><section className="do-alert-severity-tabs"><Link className={params?.severity === "critical" ? "active critical" : "critical"} href="/digital-observer/alerts?severity=critical"><ShieldAlert /> קריטי <b>{allSignals.filter((item) => item.severity === "critical").length}</b></Link><Link className={params?.severity === "high" ? "active urgent" : "urgent"} href="/digital-observer/alerts?severity=high"><AlertTriangle /> דחוף <b>{allSignals.filter((item) => item.severity === "high").length}</b></Link><Link className={params?.severity === "medium" ? "active warning" : "warning"} href="/digital-observer/alerts?severity=medium"><Clock3 /> אזהרה <b>{allSignals.filter((item) => item.severity === "medium").length}</b></Link><Link className={params?.severity === "low" ? "active info" : "info"} href="/digital-observer/alerts?severity=low"><Info /> מידע <b>{allSignals.filter((item) => item.severity === "low").length}</b></Link></section><form action="/digital-observer/alerts" className="do-alert-filter-bar"><Link className={!params?.severity ? "do-button secondary active" : "do-button secondary"} href="/digital-observer/alerts">הכול</Link><label><Search /><input name="q" defaultValue={params?.q ?? ""} placeholder="חיפוש אירוע או מצלמה" aria-label="חיפוש אירוע או מצלמה" /></label><select name="camera" defaultValue={params?.camera ?? ""} aria-label="סינון לפי מצלמה"><option value="">כל המצלמות</option>{siteCameras.map((cameraItem) => <option value={cameraItem.id} key={cameraItem.id}>{cameraItem.display_name}</option>)}</select>{params?.severity ? <input type="hidden" name="severity" value={params.severity} /> : null}{site ? <input type="hidden" name="site" value={site.id} /> : null}<button className="do-button secondary" type="submit">סינון</button></form>{signals.length ? <div className="do-alert-list">{signals.map((signal) => {
          const linkedCamera = observerCameraForSignal(signal, siteCameras);
          return <Link className="do-alert-row" href={`/digital-observer/alerts?event=${signal.id}${params?.severity ? `&severity=${params.severity}` : ""}${params?.site ? `&site=${params.site}` : ""}`} key={signal.id}>{linkedCamera?.source_mode === "demo" ? <span className={`do-alert-preview do-demo-scene scene-${linkedCamera.preview_scene || (mode === "home" ? "home-entry" : "business-entry")}`}><small>הדמיה</small></span> : <span className={`do-alert-symbol ${severityClass(signal.severity)}`}><Radar /></span>}<span className="do-row-main"><strong>{observerEventLabel(signal.metadata?.event_type ?? signal.signal_type)}</strong><small>{linkedCamera?.display_name ? `${linkedCamera.display_name} · ` : ""}{signal.recommended_action || "מומלץ לבדוק"}</small></span><span className="do-row-meta"><b className={`do-badge ${severityClass(signal.severity)}`}>{observerStatusLabel(signal.severity)}</b><time>{formatObserverDate(signal.created_at)}</time></span><ArrowRight /></Link>;
        })}</div> : <div className="do-empty"><CheckCircle2 /><strong>אין אירועים להצגה</strong><span>לא מוצגים אירועים מדומים אם לא קיימת רשומה סינתטית או אמיתית באתר.</span></div>}<section className="do-alert-summary"><span><Bell /><b>{allSignals.length}</b> כל האירועים</span><span><AlertTriangle /><b>{allSignals.filter((item) => ["critical","urgent","high"].includes(item.severity)).length}</b> דחופים</span><span><Clock3 /><b>{allSignals.filter((item) => ["needs_review","reviewing"].includes(item.review_status)).length}</b> ממתינים לבדיקה</span><span><CheckCircle2 /><b>{allSignals.filter((item) => ["confirmed","resolved","dismissed"].includes(item.review_status)).length}</b> נבדקו</span></section></article>}
      </> : null}
      {selected && notificationPreview ? (
        <section className={`do-notification-preview-stage ${severityClass(selected.severity)}`} aria-label="תצוגה מקדימה של התראת מערכת לנייד">
          <header>
            <LockKeyhole />
            <time>{formatObserverDate(selected.created_at, { year: undefined, month: undefined, day: undefined })}</time>
            <span>{formatObserverDate(selected.created_at, { hour: undefined, minute: undefined })}</span>
            <small>תצוגה מקדימה בלבד · Push חי עדיין לא מחובר</small>
          </header>
          <div className="do-notification-preview-banner">
            <ShieldAlert />
            <span><strong>התראה {severityClass(selected.severity) === "bad" ? "דחופה" : "חדשה"}</strong><small>{observerEventLabel(selected.metadata?.event_type ?? selected.signal_type)} · {camera?.display_name || "ללא מצלמה משויכת"}</small></span>
            <time>{formatObserverDate(selected.created_at, { year: undefined, month: undefined, day: undefined })}</time>
          </div>
          <article>
            <div className="do-notification-preview-title"><i /><strong>התראה {severityClass(selected.severity) === "bad" ? "דחופה" : "חדשה"}</strong></div>
            {camera ? <ObserverCameraMedia name={camera.display_name} mode={mode} scene={camera.preview_scene} status={camera.status || camera.health_status} sourceMode={camera.source_mode} /> : <div className="do-event-placeholder"><Camera /><strong>אין תצוגת מצלמה לאירוע</strong></div>}
            <footer><span>{camera?.display_name || "ללא מצלמה"}</span><time>{formatObserverDate(selected.created_at, { year: undefined, month: undefined, day: undefined })}</time></footer>
          </article>
          <div className="do-notification-preview-actions"><Link href={`/digital-observer/alerts?event=${selected.id}`}>סגירה</Link><Link href={`/digital-observer/alerts?event=${selected.id}#event-evidence`}>צפייה באירוע</Link></div>
          <p>{camera?.source_mode === "demo" ? "האירוע והמדיה סינתטיים בסביבת ההדגמה. " : ""}התצוגה מדגימה כיצד תיראה התראה לאחר חיבור ספק Push מאושר.</p>
        </section>
      ) : null}
      {selected && !notificationPreview ? (
        <section className="do-event-detail-screen">
          <Link className="do-link do-camera-back" href={`/digital-observer/alerts${params?.severity ? `?severity=${params.severity}` : ""}`}><ArrowRight /> חזרה לרשימת ההתראות</Link>
          <section className={`do-mobile-event-stage ${severityClass(selected.severity)}`} aria-label="תצוגת התראה בתוך האפליקציה">
            <header><ShieldAlert /><div><time>{formatObserverDate(selected.created_at, { year: undefined, month: undefined, day: undefined })}</time><span>{formatObserverDate(selected.created_at, { hour: undefined, minute: undefined })}</span></div><small>בתוך האפליקציה</small></header>
            <div className="do-mobile-event-banner"><ShieldAlert /><span><strong>{observerEventLabel(selected.metadata?.event_type ?? selected.signal_type)}</strong><small>{camera?.display_name || "ללא מקור מצלמה משויך"}</small></span><b>{observerStatusLabel(selected.severity)}</b></div>
            <article>
              <div className="do-mobile-event-card-title"><i /><strong>התראה {severityClass(selected.severity) === "bad" ? "דחופה" : "חדשה"}</strong></div>
              {camera ? <ObserverCameraMedia name={camera.display_name} mode={mode} scene={camera.preview_scene} status={camera.status || camera.health_status} sourceMode={camera.source_mode} /> : <div className="do-event-placeholder"><Camera /><strong>אין תצוגת מצלמה לאירוע</strong></div>}
              <footer><span>{camera?.display_name || "ללא מצלמה"}</span><time>{formatObserverDate(selected.created_at, { year: undefined, month: undefined, day: undefined })}</time></footer>
            </article>
            <div className="do-mobile-event-stage-actions"><Link href={`/digital-observer/alerts${params?.severity ? `?severity=${params.severity}` : ""}`}>סגירה</Link><a href="#event-evidence">צפייה באירוע</a></div>
            <p>{camera?.source_mode === "demo" ? "אירוע סינתטי בסביבת הדגמה. " : ""}Push חי אינו מחובר; זו תצוגה בתוך האפליקציה בלבד.</p>
          </section>
          <div className={`do-mobile-urgent-alert ${severityClass(selected.severity)}`}><ShieldAlert /><span><strong>{observerEventLabel(selected.metadata?.event_type ?? selected.signal_type)}</strong><small>{camera?.display_name || "ללא מקור מצלמה משויך"} · {formatObserverDate(selected.created_at)}</small></span><b>{observerStatusLabel(selected.severity)}</b></div>
          <div className="do-event-detail-grid" id="event-evidence">
            <article className="do-panel do-event-evidence">
              <div className="do-section-head"><div><span className={`do-badge ${severityClass(selected.severity)}`}>{observerStatusLabel(selected.severity)}</span><h1>{observerEventLabel(selected.metadata?.event_type ?? selected.signal_type)}</h1><p>{formatObserverDate(selected.created_at)}</p></div></div>
              {camera ? <div className="do-event-media-stage">
                <ObserverCameraMedia large name={camera.display_name} mode={mode} scene={camera.preview_scene} status={camera.status || camera.health_status} sourceMode={camera.source_mode} />
                <span className="do-event-media-clock">{formatObserverDate(selected.created_at, { year: undefined, month: undefined, day: undefined })}</span>
                <button className="do-event-play" type="button" disabled title="ניגון יהיה זמין רק כאשר קיים מקטע וידאו מורשה" aria-label="ניגון אינו זמין ללא מקטע וידאו"><Pause /></button>
                <div className="do-event-media-controls" aria-label="פקדי מדיה במצב מוכנות">
                  <button type="button" disabled title="זמין לאחר חיבור מקטע וידאו" aria-label="עצירה אינה זמינה"><Pause /></button>
                  <button type="button" disabled title="זמין לאחר חיבור מקטע וידאו" aria-label="קול אינו זמין"><Volume2 /></button>
                  <span><i /><small>מקטע לא מחובר</small></span>
                  <button type="button" disabled title="זמין לאחר חיבור מקטע וידאו" aria-label="צילום אינו זמין"><Camera /></button>
                  <button type="button" disabled title="זמין לאחר חיבור מקטע וידאו" aria-label="מסך מלא אינו זמין"><Maximize2 /></button>
                </div>
              </div> : <div className="do-event-placeholder"><ShieldAlert /><strong>אין preview זמין לאירוע</strong><span>האירוע נשמר ללא תמונה או קטע וידאו. המערכת אינה מציגה מדיה חלופית כאילו היא מן האירוע.</span></div>}
              <div className="do-event-evidence-track" aria-label="ציר זמן הראיה">
                <div><strong>ציר זמן הראיה</strong><span>{camera?.source_mode === "demo" ? "תמונת הדמיה, ללא מקטע וידאו" : "חלון האירוע כפי שנקלט במקור"}</span></div>
                <div className="do-event-track-line"><span>לפני האירוע</span><i><b /></i><time>{formatObserverDate(selected.created_at, { year: undefined, month: undefined, day: undefined })}</time><span>אחרי האירוע</span></div>
              </div>
            </article>
            <aside className="do-panel do-event-review-panel">
              <span className={`do-badge ${severityClass(selected.severity)}`}>{observerStatusLabel(selected.severity)}</span>
              <h2>{observerEventLabel(selected.metadata?.event_type ?? selected.signal_type)}</h2>
              <p>{camera?.display_name || "ללא מקור מצלמה משויך"}</p>
              <div className="do-confidence"><span>רמת ביטחון בזיהוי</span><strong>{selected.confidence == null ? "לא נמסרה" : `${Math.round(Number(selected.confidence) * 100)}%`}</strong></div>
              <div className="do-notice info"><UserCheck /><span>{selected.recommended_action || "מומלץ לבצע בדיקה אנושית לפני פעולה."}</span></div>
            </aside>
            <div className="do-event-detail-actions do-button-row"><Link className="do-button secondary full" href={`/digital-observer/alerts?event=${selected.id}&preview=notification`}><Bell /> תצוגת התראה לנייד</Link><ObserverQuickAction endpoint="/api/digital-observer/events/review" body={{ signal_id: selected.id, review_status: "confirmed", note: "אושר בביקורת אנושית" }}><CheckCircle2 /> אישור אירוע</ObserverQuickAction><ObserverQuickAction endpoint="/api/digital-observer/events/review" body={{ signal_id: selected.id, review_status: "dismissed", note: "נדחה בביקורת אנושית" }}><ShieldCheck /> הכול בסדר, כיול האירוע</ObserverQuickAction><ObserverQuickAction endpoint="/api/digital-observer/events/review" body={{ signal_id: selected.id, review_status: "escalated", note: "הועבר להמשך בדיקה" }}><AlertTriangle /> העברה לבדיקה אנושית</ObserverQuickAction></div>
          </div>
        </section>
      ) : null}
    </div>
  </ObserverAppShell>;
}
