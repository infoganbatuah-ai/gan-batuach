import Link from "next/link";
import { AlertTriangle, ArrowDownToLine, ArrowRight, Bell, Camera, CheckCircle2, Clock3, Info, LockKeyhole, Radar, Search, ShieldAlert, ShieldCheck, UserCheck } from "lucide-react";
import { ObserverQuickAction } from "@/components/digital-observer/observer-action-forms";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { observerEventNarrative } from "@/lib/domain/digital-observer/event-narrative";
import { ObserverEventAssessment } from "@/components/digital-observer/observer-event-assessment";
import { observerEventMediaReason, observerEventMediaState } from "@/lib/domain/digital-observer/event-evidence";
import { observerDashboardSignalMatchesCategory } from "@/lib/domain/digital-observer/dashboard-summary";
import { formatObserverDate, loadObserverEventReviews, loadObserverRuntime, observerCameraForSignal, observerClipForSignal, observerClipHasRequiredMedia, observerEventLabel, observerModeForSite, observerSignalHasRequiredEvidence, observerSignalMatchesCamera, observerStatusLabel, selectObserverSite } from "@/lib/domain/digital-observer/runtime";

type PageProps = { searchParams?: Promise<{ event?: string; site?: string; severity?: string; q?: string; camera?: string; view?: string; preview?: string; category?: string }> };
const severityClass = (value?: string) => ["critical", "urgent", "high"].includes(String(value)) ? "bad" : value === "medium" ? "warn" : "info";

export default async function DigitalObserverAlertsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/alerts");
  const runtime = await loadObserverRuntime(profile.id);
  const site = selectObserverSite(runtime.sites, runtime.cameras, params?.site);
  const mode = observerModeForSite(site);
  const alertsHref = (filters: Record<string, string> = {}) => `/digital-observer/alerts?${new URLSearchParams({ ...(site ? { site: site.id } : {}), ...filters })}`;
  const allSignals = site ? runtime.signals.filter((item) => item.observer_site_id === site.id) : [];
  const siteCameras = site ? runtime.cameras.filter((item) => item.observer_site_id === site.id) : [];
  const query = params?.q?.trim().toLocaleLowerCase("he-IL") ?? "";
  const displayableSignals = allSignals.filter((item) => observerSignalHasRequiredEvidence(item, siteCameras, runtime.clips));
  const archivedSignals = allSignals.filter((item) => {
    const linkedCamera = observerCameraForSignal(item, siteCameras);
    const clip = observerClipForSignal(item, runtime.clips);
    return linkedCamera && clip?.camera_source_id === linkedCamera.id && observerEventMediaState(clip) === "expired";
  });
  const technicalFaults = allSignals.filter((item) => !displayableSignals.includes(item) && !archivedSignals.includes(item));
  const signals = allSignals.filter((item) => displayableSignals.includes(item) || archivedSignals.includes(item)).filter((item) => {
    if (params?.severity && item.severity !== params.severity) return false;
    if (params?.camera && !observerSignalMatchesCamera(item, params.camera)) return false;
    if (params?.category && !observerDashboardSignalMatchesCategory(item, params.category, siteCameras)) return false;
    if (!query) return true;
    const linkedCamera = observerCameraForSignal(item, siteCameras);
    const narrative = observerEventNarrative(item);
    return [narrative.label, narrative.summary, narrative.reason, linkedCamera?.display_name].some((value) => String(value ?? "").toLocaleLowerCase("he-IL").includes(query));
  });
  const selected = params?.event ? allSignals.find((item) => item.id === params.event) ?? null : null;
  const camera = observerCameraForSignal(selected, runtime.cameras);
  const selectedClip = observerClipForSignal(selected, runtime.clips);
  const selectedHasMedia = Boolean(selected && observerSignalHasRequiredEvidence(selected, siteCameras, runtime.clips));
  const selectedMediaState = !camera || (selectedClip && selectedClip.camera_source_id !== camera.id) ? "missing_source" : observerEventMediaState(selectedClip);
  const selectedClipMetadata = selectedClip?.metadata && typeof selectedClip.metadata === "object" ? selectedClip.metadata : {};
  const selectedNarrative = observerEventNarrative(selected);
  const reviewHistory = selected ? await loadObserverEventReviews(selected) : { data: [], available: true };
  const timeline = params?.view === "timeline";
  const notificationPreview = params?.preview === "notification";
  const timelineSelected = signals[0] ?? null;
  const timelineCamera = observerCameraForSignal(timelineSelected, siteCameras);
  const timelineClip = observerClipForSignal(timelineSelected, runtime.clips);
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/alerts" title={selected ? "פרטי אירוע" : timeline ? "אירועים" : "מרכז ההתראות"} statusLabel="ביקורת אנושית חובה" desktopSearch={{ action: "/digital-observer/alerts", placeholder: "חיפוש אירועים, מצלמות ומיקומים..." }}>
    <div className="do-page-stack do-alert-center">
      {!selected ? <>
        {timeline ? <section className="do-event-timeline-layout">
          <article className="do-panel do-event-timeline-panel">
            <div className="do-alert-filter-bar do-timeline-filter-bar"><Link className="do-button secondary" href={alertsHref({"view":"timeline"})}>הכול</Link><Link className="do-button secondary" href={alertsHref({"view":"timeline","severity":"high"})}>סינון</Link><span><Clock3 /> יומן אירועים</span><Link className="do-link" href={alertsHref({})}>מרכז ההתראות</Link></div>
            {signals.length ? <div className="do-event-timeline-list">{signals.map((signal) => {
              const linkedCamera = observerCameraForSignal(signal, siteCameras);
              const linkedClip = observerClipForSignal(signal, runtime.clips);
              const narrative = observerEventNarrative(signal);
              return <Link href={alertsHref({ event: signal.id, view: "timeline" })} key={signal.id}><time>{formatObserverDate(linkedClip?.captured_at ?? signal.created_at)}</time><span className="do-event-timeline-node"><i /></span><span className={`do-event-timeline-icon ${severityClass(signal.severity)}`}><Radar /></span><span><strong>{narrative.label}</strong><small>{linkedCamera?.display_name || "ללא מצלמה משויכת"}</small></span>{observerClipHasRequiredMedia(linkedClip) ? <img className="do-alert-preview do-event-thumbnail" src={`/api/digital-observer/event-clips/${linkedClip?.id}/media?kind=thumbnail`} alt="תמונה מתוך האירוע" loading="lazy" /> : null}</Link>;
        })}</div> : <div className="do-empty"><CheckCircle2 /><strong>אין אירועים להצגה</strong><span>לא יוצגו אירועים בלי מקור מצלמה, תמונה וקטע וידאו.</span></div>}
          </article>
          <aside className="do-panel do-timeline-detail-panel">
            {timelineSelected ? <><span className={`do-badge ${severityClass(timelineSelected.severity)}`}>{observerStatusLabel(timelineSelected.severity)}</span><h2>פרטי אירוע</h2><dl><div><dt>זמן</dt><dd>{formatObserverDate(timelineClip?.captured_at ?? timelineSelected.created_at)}</dd></div><div><dt>סוג</dt><dd>{observerEventLabel(timelineSelected.metadata?.event_type ?? timelineSelected.signal_type)}</dd></div><div><dt>מצלמה</dt><dd>{timelineCamera?.display_name || "לא שויכה"}</dd></div></dl>{observerClipHasRequiredMedia(timelineClip) ? <img className="do-event-thumbnail" src={`/api/digital-observer/event-clips/${timelineClip?.id}/media?kind=thumbnail`} alt="תמונה מתוך האירוע" /> : <p>{observerEventMediaReason(observerEventMediaState(timelineClip))}</p>}<p>{observerEventNarrative(timelineSelected).summary}</p><Link className="do-button primary full" href={alertsHref({ event: timelineSelected.id })}>צפייה באירוע</Link></> : <div className="do-empty compact"><Radar /><strong>בחרו אירוע</strong></div>}
          </aside>
        </section> : <article className="do-panel do-alert-list-panel"><div className="do-section-head"><div><h2>מרכז ההתראות</h2><p>כל זיהוי מוצג כהערכה עם רמת ביטחון ומחייב החלטה אנושית.</p></div><span className="do-badge info">{signals.length} אירועים</span></div><section className="do-alert-severity-tabs"><Link className={params?.severity === "critical" ? "active critical" : "critical"} href={alertsHref({"severity":"critical"})}><ShieldAlert /> קריטי <b>{displayableSignals.filter((item) => item.severity === "critical").length}</b></Link><Link className={params?.severity === "high" ? "active urgent" : "urgent"} href={alertsHref({"severity":"high"})}><AlertTriangle /> דחוף <b>{displayableSignals.filter((item) => item.severity === "high").length}</b></Link><Link className={params?.severity === "medium" ? "active warning" : "warning"} href={alertsHref({"severity":"medium"})}><Clock3 /> אזהרה <b>{displayableSignals.filter((item) => item.severity === "medium").length}</b></Link><Link className={params?.severity === "low" ? "active info" : "info"} href={alertsHref({"severity":"low"})}><Info /> מידע <b>{displayableSignals.filter((item) => item.severity === "low").length}</b></Link></section><form action="/digital-observer/alerts" className="do-alert-filter-bar"><Link className={!params?.severity ? "do-button secondary active" : "do-button secondary"} href={alertsHref({})}>הכול</Link><label><Search /><input name="q" defaultValue={params?.q ?? ""} placeholder="חיפוש אירוע או מצלמה" aria-label="חיפוש אירוע או מצלמה" /></label><select name="camera" defaultValue={params?.camera ?? ""} aria-label="סינון לפי מצלמה"><option value="">כל המצלמות</option>{siteCameras.map((cameraItem) => <option value={cameraItem.id} key={cameraItem.id}>{cameraItem.display_name}</option>)}</select>{params?.severity ? <input type="hidden" name="severity" value={params.severity} /> : null}{site ? <input type="hidden" name="site" value={site.id} /> : null}<button className="do-button secondary" type="submit">סינון</button></form>{signals.length ? <div className="do-alert-list">{signals.map((signal) => {
          const linkedCamera = observerCameraForSignal(signal, siteCameras);
              const linkedClip = observerClipForSignal(signal, runtime.clips);
              const narrative = observerEventNarrative(signal);
          return <Link className="do-alert-row" href={alertsHref({ event: signal.id, ...(params?.severity ? { severity: params.severity } : {}) })} key={signal.id}>{observerClipHasRequiredMedia(linkedClip) ? <img className="do-alert-preview do-event-thumbnail" src={`/api/digital-observer/event-clips/${linkedClip?.id}/media?kind=thumbnail`} alt="תמונה מתוך האירוע" loading="lazy" /> : <span className={`do-alert-symbol ${severityClass(signal.severity)}`}><Clock3 /></span>}<span className="do-row-main"><strong>{narrative.label}</strong><small>{linkedCamera?.display_name ? `${linkedCamera.display_name} · ` : ""}{narrative.summary}{observerEventMediaState(linkedClip) === "expired" ? " · המדיה פגה; התיאור נשמר" : ""}</small></span><span className="do-row-meta"><b className={`do-badge ${severityClass(signal.severity)}`}>{observerStatusLabel(signal.severity)}</b><time>{formatObserverDate(linkedClip?.captured_at ?? signal.created_at)}</time></span><ArrowRight /></Link>;
        })}</div> : <div className="do-empty"><CheckCircle2 /><strong>אין אירועים להצגה</strong><span>אירוע לבדיקה חייב מקור מצלמה, תמונה וקטע וידאו נגיש.</span></div>}{technicalFaults.length ? <section className="do-event-technical-faults"><strong>תקלות טכניות במדיה</strong><span>{technicalFaults.length} אירועים אינם זמינים לאישור.</span><ul>{technicalFaults.map((fault) => <li key={fault.id}><Link href={alertsHref({ event: fault.id })}>{formatObserverDate(fault.created_at)} · {observerCameraForSignal(fault, siteCameras) ? observerEventMediaReason(observerEventMediaState(observerClipForSignal(fault, runtime.clips))) : observerEventMediaReason("missing_source")}</Link></li>)}</ul></section> : null}<section className="do-alert-summary"><span><Bell /><b>{displayableSignals.length}</b> אירועים תקינים</span><span><AlertTriangle /><b>{displayableSignals.filter((item) => ["critical","urgent","high"].includes(item.severity)).length}</b> דחופים</span><span><Clock3 /><b>{displayableSignals.filter((item) => ["needs_review","reviewing"].includes(item.review_status)).length}</b> ממתינים לבדיקה</span><span><CheckCircle2 /><b>{displayableSignals.filter((item) => ["confirmed","resolved","dismissed"].includes(item.review_status)).length}</b> נבדקו</span></section></article>}
      </> : null}
      {selected && notificationPreview ? (
        <section className={`do-notification-preview-stage ${severityClass(selected.severity)}`} aria-label="תצוגה מקדימה של התראת מערכת לנייד">
          <header>
            <LockKeyhole />
            <time>{formatObserverDate(selectedClip?.captured_at ?? selected.created_at, { year: undefined, month: undefined, day: undefined })}</time>
            <span>{formatObserverDate(selectedClip?.captured_at ?? selected.created_at, { hour: undefined, minute: undefined })}</span>
            <small>תצוגה מקדימה בלבד · Push חי עדיין לא מחובר</small>
          </header>
          <div className="do-notification-preview-banner">
            <ShieldAlert />
            <span><strong>התראה {severityClass(selected.severity) === "bad" ? "דחופה" : "חדשה"}</strong><small>{observerEventLabel(selected.metadata?.event_type ?? selected.signal_type)} · {camera?.display_name || "ללא מצלמה משויכת"}</small></span>
            <time>{formatObserverDate(selectedClip?.captured_at ?? selected.created_at, { year: undefined, month: undefined, day: undefined })}</time>
          </div>
          <article>
            <div className="do-notification-preview-title"><i /><strong>התראה {severityClass(selected.severity) === "bad" ? "דחופה" : "חדשה"}</strong></div>
            {camera && selectedHasMedia ? <img className="do-event-thumbnail" src={`/api/digital-observer/event-clips/${selectedClip?.id}/media?kind=thumbnail`} alt="" /> : <div className="do-event-placeholder"><Camera /><strong>אין תצוגת מצלמה לאירוע</strong></div>}
            <footer><span>{camera?.display_name || "ללא מצלמה"}</span><time>{formatObserverDate(selectedClip?.captured_at ?? selected.created_at, { year: undefined, month: undefined, day: undefined })}</time></footer>
          </article>
          <div className="do-notification-preview-actions"><Link href={alertsHref({ event: selected.id })}>סגירה</Link><Link href={`${alertsHref({ event: selected.id })}#event-evidence`}>צפייה באירוע</Link></div>
          <p>{camera?.source_mode === "demo" ? "האירוע והמדיה סינתטיים בסביבת ההדגמה. " : ""}התצוגה מדגימה כיצד תיראה התראה לאחר חיבור ספק Push מאושר.</p>
        </section>
      ) : null}
      {selected && !notificationPreview ? (
        <section className="do-event-detail-screen">
          <Link className="do-link do-camera-back" href={alertsHref(params?.severity ? { severity: params.severity } : {})}><ArrowRight /> חזרה לרשימת ההתראות</Link>
          <section className={`do-mobile-event-stage ${severityClass(selected.severity)}`} aria-label="תצוגת התראה בתוך האפליקציה">
            <header><ShieldAlert /><div><time>{formatObserverDate(selectedClip?.captured_at ?? selected.created_at, { year: undefined, month: undefined, day: undefined })}</time><span>{formatObserverDate(selectedClip?.captured_at ?? selected.created_at, { hour: undefined, minute: undefined })}</span></div><small>בתוך האפליקציה</small></header>
            <div className="do-mobile-event-banner"><ShieldAlert /><span><strong>{observerEventLabel(selected.metadata?.event_type ?? selected.signal_type)}</strong><small>{camera?.display_name || "ללא מקור מצלמה משויך"}</small></span><b>{observerStatusLabel(selected.severity)}</b></div>
            <article>
              <div className="do-mobile-event-card-title"><i /><strong>התראה {severityClass(selected.severity) === "bad" ? "דחופה" : "חדשה"}</strong></div>
              {camera && selectedHasMedia ? <img className="do-event-thumbnail" src={`/api/digital-observer/event-clips/${selectedClip?.id}/media?kind=thumbnail`} alt="" /> : <div className="do-event-placeholder"><Camera /><strong>אין תצוגת מצלמה לאירוע</strong></div>}
              <footer><span>{camera?.display_name || "ללא מצלמה"}</span><time>{formatObserverDate(selectedClip?.captured_at ?? selected.created_at, { year: undefined, month: undefined, day: undefined })}</time></footer>
            </article>
            <div className="do-mobile-event-stage-actions"><Link href={alertsHref(params?.severity ? { severity: params.severity } : {})}>סגירה</Link><a href="#event-evidence">צפייה באירוע</a></div>
            <p>{camera?.source_mode === "demo" ? "אירוע סינתטי בסביבת הדגמה. " : ""}Push חי אינו מחובר; זו תצוגה בתוך האפליקציה בלבד.</p>
          </section>
          <div className={`do-mobile-urgent-alert ${severityClass(selected.severity)}`}><ShieldAlert /><span><strong>{observerEventLabel(selected.metadata?.event_type ?? selected.signal_type)}</strong><small>{camera?.display_name || "ללא מקור מצלמה משויך"} · {formatObserverDate(selectedClip?.captured_at ?? selected.created_at)}</small></span><b>{observerStatusLabel(selected.severity)}</b></div>
          <div className="do-event-detail-grid" id="event-evidence">
            <article className="do-panel do-event-evidence">
              <div className="do-section-head"><div><span className={`do-badge ${severityClass(selected.severity)}`}>{observerStatusLabel(selected.severity)}</span><h1>{selectedNarrative.label}</h1><p>{selectedNarrative.summary}</p><p>{formatObserverDate(selectedClip?.captured_at ?? selected.created_at)}</p></div></div>
              {camera && selectedHasMedia ? <div className="do-event-media-stage">
                <video className="do-event-video" controls preload="metadata" poster={`/api/digital-observer/event-clips/${selectedClip?.id}/media?kind=thumbnail`}>
                  <source src={`/api/digital-observer/event-clips/${selectedClip?.id}/media?kind=clip`} type="video/mp4" />
                </video>
                <span className="do-event-media-clock">{formatObserverDate(selectedClip?.captured_at ?? selected.created_at, { year: undefined, month: undefined, day: undefined })}</span>
              </div> : <div className="do-event-placeholder"><ShieldAlert /><strong>{selectedMediaState === "expired" ? "תיאור האירוע נשמר" : "תקלה טכנית במדיית האירוע"}</strong><span>{observerEventMediaReason(selectedMediaState)}</span></div>}
              <div className="do-event-evidence-track" aria-label="ציר זמן הראיה">
                <div><strong>ציר זמן הראיה</strong><span>{selectedHasMedia ? `${selectedClip?.window_seconds_before ?? selectedClipMetadata.window_seconds_before ?? 0} שניות לפני · ${selectedClip?.window_seconds_after ?? selectedClipMetadata.window_seconds_after ?? 0} שניות אחרי` : observerEventMediaReason(selectedMediaState)}</span></div>
                <div className="do-event-track-line"><span>לפני האירוע</span><i><b /></i><time>{formatObserverDate(selectedClip?.captured_at ?? selected.created_at, { year: undefined, month: undefined, day: undefined })}</time><span>אחרי האירוע</span></div>
              </div>
            </article>
            <aside className="do-panel do-event-review-panel">
              <span className={`do-badge ${severityClass(selected.severity)}`}>{observerStatusLabel(selected.severity)}</span>
              <h2>{selectedNarrative.label}</h2>
              <p>{selectedNarrative.summary}</p>
              <p>{camera?.display_name || "ללא מקור מצלמה משויך"}</p>
              <ObserverEventAssessment event={selected} mediaState={selectedMediaState} />
              <section aria-label="היסטוריית ביקורת" className="do-event-review-history">
                <h3>ביקורות אחרונות</h3>
                {!reviewHistory.available ? <p role="alert">לא ניתן לטעון את היסטוריית הביקורת כרגע.</p>
                  : reviewHistory.data.length ? <dl className="do-event-assessment">{reviewHistory.data.map((review) => <div key={review.id}>
                    <dt>{observerStatusLabel(review.review_status)} · <time dateTime={review.created_at}>{formatObserverDate(review.created_at)}</time></dt>
                    <dd>{review.review_note || "לא נוספה הערה"}</dd>
                  </div>)}</dl> : <p>טרם נשמרה ביקורת לאירוע זה.</p>}
              </section>
              <div className="do-notice info"><UserCheck /><span>{selectedNarrative.action}</span></div>
            </aside>
            <div className="do-event-detail-actions do-button-row"><Link className="do-button secondary full" href={alertsHref({ event: selected.id, preview: "notification" })}><Bell /> תצוגת התראה לנייד</Link>{selectedHasMedia && selectedClip?.downloadable === true ? <a className="do-button secondary full" href={`/api/digital-observer/event-clips/${selectedClip?.id}/media?kind=clip&download=1`}><ArrowDownToLine /> הורדת וידאו</a> : null}{selectedHasMedia ? <ObserverQuickAction endpoint="/api/digital-observer/events/review" body={{ signal_id: selected.id, review_status: "confirmed", note: "אושר בביקורת אנושית" }}><CheckCircle2 /> אישור אירוע</ObserverQuickAction> : null}{selectedHasMedia ? <ObserverQuickAction endpoint="/api/digital-observer/events/review" body={{ signal_id: selected.id, review_status: "dismissed", note: "נדחה בביקורת אנושית" }}><ShieldCheck /> הכול בסדר, כיול האירוע</ObserverQuickAction> : null}<ObserverQuickAction endpoint="/api/digital-observer/events/review" body={{ signal_id: selected.id, review_status: "escalated", note: selectedHasMedia ? "הועבר להמשך בדיקה" : observerEventMediaReason(selectedMediaState) }}><AlertTriangle /> {selectedHasMedia || selectedMediaState === "expired" ? "העברה לבדיקה אנושית" : "סימון תקלה טכנית"}</ObserverQuickAction></div>
          </div>
        </section>
      ) : null}
    </div>
  </ObserverAppShell>;
}
