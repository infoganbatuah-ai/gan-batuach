"use client";

import { useState } from "react";
import { aiEventTypeLabels, aiCameraEventTypes } from "@/lib/domain/ai-digital-observer";

type AiCameraEvent = Record<string, any>;
type Garden = { id: string; name: string };
type Camera = { id: string; name: string; garden_id?: string | null; kindergarten_id?: string | null };

function statusLabel(status?: string) {
  return ({ open: "פתוח", reviewing: "בבדיקה", confirmed: "אושר", dismissed: "נדחה", escalated: "הוסלם" } as Record<string, string>)[status ?? "open"] ?? status;
}

function severityTone(severity?: string) {
  if (["urgent", "critical", "high"].includes(severity ?? "")) return "bad";
  if (severity === "medium") return "warn";
  return "good";
}

export function AiCameraEventsReview({ events, gardens = [], cameras = [], role = "garden", adminMode = false }: { events: AiCameraEvent[]; gardens?: Garden[]; cameras?: Camera[]; role?: "admin" | "garden" | "inspector"; adminMode?: boolean }) {
  const [rows, setRows] = useState(events);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedGardenId, setSelectedGardenId] = useState(gardens[0]?.id ?? "");

  async function action(event: AiCameraEvent, actionName: "review" | "confirm" | "dismiss" | "escalate") {
    setBusy(event.id);
    const review_notes = actionName === "confirm" || actionName === "dismiss" || actionName === "escalate" ? window.prompt("הערת review") ?? "" : undefined;
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
      setRows((current) => [body.data.event, ...current]);
      setMessage("אירוע mock נוצר ונשלח ל-review");
    }
  }

  return (
    <div className="stack">
      {message ? <div className="status-banner">{message}</div> : null}
      <section className="grid cols-3">
        <article className="metric-card"><strong>{rows.filter((event) => event.status === "open").length}</strong><span>פתוחים ל-review</span></article>
        <article className="metric-card"><strong>{rows.filter((event) => ["urgent", "critical", "high"].includes(event.severity)).length}</strong><span>חומרה גבוהה</span></article>
        <article className="metric-card"><strong>{role === "admin" ? "כל הגנים" : role === "inspector" ? "גנים משויכים" : "הגן שלך"}</strong><span>תחום הרשאה</span></article>
      </section>
      {adminMode ? (
        <form className="form-card compact-form" action={createMock}>
          <div>
            <p className="eyebrow">Mock only</p>
            <h2>יצירת אירוע בדיקה</h2>
            <p>לא מעבד וידאו אמיתי. מיועד לבדיקת workflow, הרשאות והתראות בלבד.</p>
          </div>
          <div className="form-grid two">
            <label>גן<select name="kindergarten_id" required value={selectedGardenId} onChange={(event) => setSelectedGardenId(event.target.value)}>{gardens.map((garden) => <option key={garden.id} value={garden.id}>{garden.name}</option>)}</select></label>
            <label>מצלמה<select name="camera_id"><option value="">ללא מצלמה ספציפית</option>{cameras.filter((camera) => !selectedGardenId || camera.garden_id === selectedGardenId || camera.kindergarten_id === selectedGardenId).map((camera) => <option key={camera.id} value={camera.id}>{camera.name}</option>)}</select></label>
            <label>סוג אירוע<select name="event_type">{aiCameraEventTypes.map((type) => <option value={type} key={type}>{aiEventTypeLabels[type]}</option>)}</select></label>
            <label>חומרה<select name="severity"><option value="medium">בינוני</option><option value="high">גבוה</option><option value="urgent">דחוף</option><option value="critical">קריטי</option></select></label>
            <label>Confidence<input name="confidence_score" type="number" min="0" max="1" step="0.01" defaultValue="0.72" /></label>
          </div>
          <label>תיאור<textarea name="description" placeholder="נדרש review אנושי לפני הסלמה" /></label>
          <button className="primary-action">יצירת אירוע mock</button>
        </form>
      ) : null}
      <section className="dashboard-section">
        {rows.length === 0 ? <div className="empty-state"><strong>אין אירועי תצפיתן לבדיקה</strong><span>כאשר worker mock או עתידי ייצור אירועים, הם יופיעו כאן.</span></div> : (
          <div className="procedure-list">
            {rows.map((event) => (
              <article className="card procedure-card" key={event.id}>
                <div>
                  {event.snapshot_url ? <img className="snapshot-image" src={event.snapshot_url} alt="תמונת אירוע לבדיקה" /> : <div className="snapshot-placeholder">review</div>}
                  <span className={`pill ${severityTone(event.severity)}`}>{event.severity}</span>
                  <h3>{event.title ?? aiEventTypeLabels[event.event_type as keyof typeof aiEventTypeLabels] ?? event.event_type}</h3>
                  <p>{event.description ?? "אירוע תצפיתן דורש review אנושי."}</p>
                  <small>{event.gardens?.name ?? event.kindergarten_id} · {event.camera_streams?.name ?? "מצלמה"} · {event.started_at ? new Date(event.started_at).toLocaleString("he-IL") : ""}</small>
                  {typeof event.confidence_score === "number" ? <small>רמת ביטחון: {Math.round(event.confidence_score * 100)}% · נדרשת בדיקה אנושית</small> : <small>נדרשת בדיקה אנושית לפני הסלמה</small>}
                </div>
                <div className="procedure-meta">
                  <span className="pill">{statusLabel(event.status)}</span>
                  <button className="button secondary" disabled={busy === event.id} onClick={() => action(event, "review")}>סימון בבדיקה</button>
                  <button className="button secondary" disabled={busy === event.id} onClick={() => action(event, "confirm")}>אישור לאחר review</button>
                  <button className="button secondary" disabled={busy === event.id} onClick={() => action(event, "dismiss")}>דחייה</button>
                  <button className="button secondary" disabled={busy === event.id} onClick={() => action(event, "escalate")}>הסלמה</button>
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
