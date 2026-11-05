"use client";

import { useState } from "react";
import { aiEventTypeLabels, aiCameraEventTypes } from "@/lib/domain/ai-digital-observer";

type AiCameraEvent = Record<string, any>;
type Garden = { id: string; name: string };
type Camera = { id: string; name: string; garden_id?: string | null; kindergarten_id?: string | null };
type Availability = { events: boolean; gardens: boolean; cameras: boolean };
type EventSnapshot = { identity: string; generation: number; rows: AiCameraEvent[]; message: string | null; busy: string | null };

function eventIdentity(events: AiCameraEvent[], available: boolean) {
  return JSON.stringify([available, available ? events.map((event) => [
    event.id, event.title, event.event_type, event.severity, event.status,
    event.shadow_mode, Boolean(event.metadata?.shadow_mode), Boolean(event.metadata?.safety_framework),
    event.review_priority, event.safety_category, event.created_at, event.reviewed_at,
    event.started_at, event.confidence_score, event.description, event.recommended_action,
    event.evidence_notes, event.snapshot_url, event.review_outcome, event.review_notes,
    event.kindergarten_id, event.gardens?.name, event.camera_streams?.name
  ]) : []]);
}

function statusLabel(status?: string) {
  return ({ open: "פתוח", reviewing: "בבדיקה", confirmed: "אושר", dismissed: "נדחה", escalated: "הוסלם" } as Record<string, string>)[status ?? "open"] ?? status;
}

function reviewOutcomeLabel(outcome?: string | null) {
  return ({ false_positive: "False positive", valid_detection: "Valid detection", needs_more_data: "צריך עוד מידע" } as Record<string, string>)[outcome ?? ""] ?? null;
}

function severityTone(severity?: string) {
  if (["urgent", "critical", "high"].includes(severity ?? "")) return "bad";
  if (severity === "medium") return "warn";
  return "good";
}

function categoryLabel(category?: string | null) {
  return ({
    distress: "מצוקה",
    violence: "תנועה חריגה לבדיקה",
    supervision: "השגחה",
    crowding: "צפיפות",
    fall: "נפילה",
    emergency: "חירום",
    camera: "מצלמות",
    pickup: "איסוף",
    general: "כללי"
  } as Record<string, string>)[category ?? ""] ?? "כללי";
}

export function AiCameraEventsReview({ events, gardens = [], cameras = [], role = "garden", adminMode = false, availability }: { events: AiCameraEvent[]; gardens?: Garden[]; cameras?: Camera[]; role?: "admin" | "garden" | "inspector"; adminMode?: boolean; availability?: Availability }) {
  const qualified = availability !== undefined;
  const eventsAvailable = availability?.events ?? true;
  const gardensAvailable = availability?.gardens ?? true;
  const camerasAvailable = availability?.cameras ?? true;
  const identity = qualified ? eventIdentity(events, eventsAvailable) : "legacy";
  const choiceIdentity = qualified ? JSON.stringify([
    gardensAvailable, camerasAvailable,
    gardensAvailable ? gardens.map((garden) => [garden.id, garden.name]) : [],
    camerasAvailable ? cameras.map((camera) => [camera.id, camera.name, camera.garden_id, camera.kindergarten_id]) : []
  ]) : "legacy";
  const [snapshot, setSnapshot] = useState<EventSnapshot>(() => ({ identity, generation: 0, rows: eventsAvailable ? events : [], message: null, busy: null }));
  const [gardenSnapshot, setGardenSnapshot] = useState(() => ({ identity: choiceIdentity, generation: 0, id: gardensAvailable ? gardens[0]?.id ?? "" : "" }));
  const currentSnapshot = snapshot.identity === identity ? snapshot : { identity, generation: snapshot.generation + 1, rows: eventsAvailable ? events : [], message: null, busy: null };
  const currentGarden = gardenSnapshot.identity === choiceIdentity ? gardenSnapshot : {
    identity: choiceIdentity,
    generation: gardenSnapshot.generation + 1,
    id: gardensAvailable ? (gardens.some((garden) => garden.id === gardenSnapshot.id) ? gardenSnapshot.id : gardens[0]?.id ?? "") : ""
  };
  // Reconcile during render so a refreshed failure never exposes one frame of
  // stale actionable rows. Independent event and choice identities preserve
  // optimistic state on unrelated rerenders. Async replies are fenced below.
  if (snapshot.identity !== identity) setSnapshot(currentSnapshot);
  if (gardenSnapshot.identity !== choiceIdentity) setGardenSnapshot(currentGarden);
  const { rows, message, busy } = currentSnapshot;
  const selectedGardenId = currentGarden.id;
  const mockAvailable = !qualified || (gardensAvailable && camerasAvailable && gardens.length > 0);
  function setRows(update: (current: AiCameraEvent[]) => AiCameraEvent[]) {
    setSnapshot((current) => current.identity === identity && current.generation === currentSnapshot.generation ? { ...current, rows: update(current.rows) } : current);
  }
  function setMessage(value: string | null) {
    setSnapshot((current) => current.identity === identity && current.generation === currentSnapshot.generation ? { ...current, message: value } : current);
  }
  function setBusy(value: string | null) {
    setSnapshot((current) => current.identity === identity && current.generation === currentSnapshot.generation ? { ...current, busy: value } : current);
  }
  function setSelectedGardenId(value: string) {
    setGardenSnapshot((current) => current.identity === choiceIdentity && current.generation === currentGarden.generation ? { ...current, id: value } : current);
  }

  async function action(event: AiCameraEvent, actionName: "review" | "confirm" | "dismiss" | "escalate" | "false_positive" | "valid_detection" | "needs_more_data") {
    if (!eventsAvailable) return;
    setBusy(event.id);
    const review_notes = actionName !== "review" ? window.prompt("הערת review") ?? "" : undefined;
    const response = await fetch(`/api/ai-camera-events/${event.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionName, review_notes })
    });
    const body = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setMessage(body.error || "עדכון האירוע נכשל");
      return;
    }
    setRows((current) => current.map((row) => row.id === event.id ? { ...row, ...(body.data?.event ?? {}) } : row));
    setMessage("סטטוס האירוע עודכן");
  }

  async function createMock(formData: FormData) {
    if (!mockAvailable) {
      setMessage("יצירת אירוע אינה זמינה ללא אפשרויות גן ומצלמה תקינות");
      return;
    }
    setMessage(null);
    const response = await fetch("/api/ai-camera-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kindergarten_id: String(formData.get("kindergarten_id") || ""),
        camera_id: String(formData.get("camera_id") || "") || undefined,
        event_type: String(formData.get("event_type") || "fall_suspected"),
        severity: String(formData.get("severity") || "high"),
        confidence_score: Number(formData.get("confidence_score") || 0.72),
        description: String(formData.get("description") || "")
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setMessage(body.error || "יצירת אירוע mock נכשלה");
    else {
      if (eventsAvailable) setRows((current) => [body.data.event, ...current]);
      setMessage("אירוע mock נוצר ונשלח ל-review");
    }
  }
  const safetyRows = rows.filter((event) => event.metadata?.safety_framework || event.safety_category || ["distress_suspected", "violence_indicator", "aggressive_behavior_indicator", "prolonged_crying_indicator", "child_left_alone_indicator", "staff_absence_indicator", "unusual_crowding", "fall_suspected", "emergency_behavior_indicator"].includes(event.event_type));
  const priorityRows = safetyRows.filter((event) => Number(event.review_priority ?? 4) <= 2 && ["open", "reviewing"].includes(event.status ?? "open"));
  const escalatedRows = safetyRows.filter((event) => event.status === "escalated");
  const confirmedRows = safetyRows.filter((event) => event.status === "confirmed");
  const resolvedRows = safetyRows.filter((event) => event.reviewed_at && event.created_at);
  const averageResolutionHours = resolvedRows.length
    ? resolvedRows.reduce((sum, event) => sum + Math.max(0, new Date(event.reviewed_at).getTime() - new Date(event.created_at).getTime()) / 36e5, 0) / resolvedRows.length
    : 0;
  const byCategory = safetyRows.reduce<Record<string, number>>((acc, event) => {
    const key = event.safety_category ?? "general";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="stack">
      {message ? <div className="status-banner">{message}</div> : null}
      <section className="grid cols-3">
        <article className="metric-card"><strong>{eventsAvailable ? rows.filter((event) => event.status === "open").length : "לא זמין"}</strong><span>פתוחים ל-review</span></article>
        <article className="metric-card"><strong>{eventsAvailable ? rows.filter((event) => ["urgent", "critical", "high"].includes(event.severity)).length : "לא זמין"}</strong><span>חומרה גבוהה</span></article>
        <article className="metric-card"><strong>{eventsAvailable ? rows.filter((event) => event.shadow_mode || event.metadata?.shadow_mode).length : "לא זמין"}</strong><span>Shadow detections</span></article>
        <article className="metric-card"><strong>{role === "admin" ? "כל הגנים" : role === "inspector" ? "גנים משויכים" : "הגן שלך"}</strong><span>תחום הרשאה</span></article>
      </section>
      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><strong>{eventsAvailable ? safetyRows.length : "לא זמין"}</strong><span>Safety indicators</span></article>
        <article className="metric-card"><strong>{eventsAvailable ? priorityRows.length : "לא זמין"}</strong><span>Priority review</span></article>
        <article className="metric-card"><strong>{eventsAvailable ? escalatedRows.length : "לא זמין"}</strong><span>Escalations</span></article>
        <article className="metric-card"><strong>{!eventsAvailable ? "לא זמין" : resolvedRows.length ? `${averageResolutionHours.toFixed(1)}h` : qualified ? "לא נמדד" : "0.0h"}</strong><span>Avg resolution</span></article>
      </section>
      <section className="card action-panel">
        <div className="section-heading"><h2>Safety review framework</h2><p>אינדיקציות בלבד. אין האשמה, אין מסקנה משמעתית ואין הודעת הורים לפני workflow מאושר.</p></div>
        <div className="tag-cloud">{!eventsAvailable ? <span>נתוני האירועים אינם זמינים</span> : Object.entries(byCategory).length === 0 ? <span>אין safety indicators כרגע</span> : Object.entries(byCategory).map(([category, count]) => <span key={category}>{categoryLabel(category)}: {count}</span>)}</div>
        {eventsAvailable ? <div className="tag-cloud"><span>אושרו לאחר בדיקה: {confirmedRows.length}</span><span>נדחו: {safetyRows.filter((event) => event.status === "dismissed").length}</span><span>פתוחים לבדיקה: {safetyRows.filter((event) => ["open", "reviewing"].includes(event.status ?? "open")).length}</span></div> : null}
      </section>
      {adminMode ? (
        <form key={choiceIdentity} className="form-card compact-form" action={createMock}>
          <div>
            <p className="eyebrow">Mock only</p>
            <h2>יצירת אירוע בדיקה</h2>
            <p>לא מעבד וידאו אמיתי. מיועד לבדיקת workflow, הרשאות והתראות בלבד.</p>
          </div>
          <div className="form-grid two">
            <label>גן<select name="kindergarten_id" required disabled={!mockAvailable} value={selectedGardenId} onChange={(event) => setSelectedGardenId(event.target.value)}>{gardensAvailable ? gardens.map((garden) => <option key={garden.id} value={garden.id}>{garden.name}</option>) : null}</select></label>
            <label>מצלמה<select name="camera_id" disabled={!mockAvailable}><option value="">ללא מצלמה ספציפית</option>{camerasAvailable ? cameras.filter((camera) => !selectedGardenId || camera.garden_id === selectedGardenId || camera.kindergarten_id === selectedGardenId).map((camera) => <option key={camera.id} value={camera.id}>{camera.name}</option>) : null}</select></label>
            <label>סוג אירוע<select name="event_type" disabled={!mockAvailable}>{aiCameraEventTypes.map((type) => <option value={type} key={type}>{aiEventTypeLabels[type]}</option>)}</select></label>
            <label>חומרה<select name="severity" disabled={!mockAvailable}><option value="medium">בינוני</option><option value="high">גבוה</option><option value="urgent">דחוף</option><option value="critical">קריטי</option></select></label>
            <label>Confidence<input name="confidence_score" type="number" min="0" max="1" step="0.01" defaultValue="0.72" disabled={!mockAvailable} /></label>
          </div>
          <label>תיאור<textarea name="description" placeholder="נדרש review אנושי לפני הסלמה" disabled={!mockAvailable} /></label>
          <button className="primary-action" disabled={!mockAvailable}>יצירת אירוע mock</button>
        </form>
      ) : null}
      <section className="dashboard-section">
        {!eventsAvailable ? <div className="empty-state"><strong>נתוני האירועים אינם זמינים</strong></div> : rows.length === 0 ? <div className="empty-state"><strong>אין אירועי תצפיתן לבדיקה</strong><span>כאשר worker mock או עתידי ייצור אירועים, הם יופיעו כאן.</span></div> : (
          <div className="procedure-list">
            {rows.map((event) => (
              <article className="card procedure-card" key={event.id}>
                <div>
                  {event.snapshot_url ? <img className="snapshot-image" src={event.snapshot_url} alt="תמונת אירוע לבדיקה" /> : <div className="snapshot-placeholder">אין תמונת ראיה לאירוע זה</div>}
                  <span className={`pill ${severityTone(event.severity)}`}>{event.severity}</span>
                  {event.safety_category ? <span className="pill warn">{categoryLabel(event.safety_category)}</span> : null}
                  {event.review_priority ? <span className="pill">Priority {event.review_priority}</span> : null}
                  {event.shadow_mode || event.metadata?.shadow_mode ? <span className="pill warn">זיהוי ניסיוני - דורש בדיקת אדם</span> : null}
                  <h3>{event.title ?? aiEventTypeLabels[event.event_type as keyof typeof aiEventTypeLabels] ?? event.event_type}</h3>
                  <p>{event.description ?? "אירוע תצפיתן דורש review אנושי."}</p>
                  {event.recommended_action ? <p><strong>המלצה:</strong> {event.recommended_action}</p> : null}
                  {event.evidence_notes ? <p><strong>Evidence notes:</strong> {event.evidence_notes}</p> : null}
                  <small>{event.gardens?.name ?? event.kindergarten_id} · {event.camera_streams?.name ?? "מצלמה"} · {event.started_at ? new Date(event.started_at).toLocaleString("he-IL") : ""}</small>
                  {typeof event.confidence_score === "number" ? <small>רמת ביטחון: {Math.round(event.confidence_score * 100)}% · נדרשת בדיקה אנושית</small> : <small>נדרשת בדיקה אנושית לפני הסלמה</small>}
                </div>
                <div className="procedure-meta">
                  <span className="pill">{statusLabel(event.status)}</span>
                  {reviewOutcomeLabel(event.review_outcome) ? <span className="pill good">{reviewOutcomeLabel(event.review_outcome)}</span> : null}
                  <button className="button secondary" disabled={busy === event.id} onClick={() => action(event, "review")}>סימון בבדיקה</button>
                  <button className="button secondary" disabled={busy === event.id} onClick={() => action(event, "confirm")}>אישור לאחר review</button>
                  <button className="button secondary" disabled={busy === event.id} onClick={() => action(event, "dismiss")}>דחייה</button>
                  <button className="button secondary" disabled={busy === event.id} onClick={() => action(event, "escalate")}>הסלמה</button>
                  <button className="button secondary" disabled={busy === event.id} onClick={() => action(event, "false_positive")}>False positive</button>
                  <button className="button secondary" disabled={busy === event.id} onClick={() => action(event, "valid_detection")}>Valid detection</button>
                  <button className="button secondary" disabled={busy === event.id} onClick={() => action(event, "needs_more_data")}>צריך עוד מידע</button>
                  {event.review_notes ? <small>{event.review_notes}</small> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
