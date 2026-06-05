"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, Ear, ShieldCheck } from "lucide-react";

type AudioEvent = Record<string, any>;
type Option = { id: string; name: string; garden_id?: string | null };

const eventLabels: Record<string, string> = {
  prolonged_crying_indicator: "אינדיקציה לבכי ממושך",
  distress_sound_indicator: "אינדיקציה לקול מצוקה",
  scream_indicator: "אינדיקציה לצעקה",
  repeated_distress_indicator: "אינדיקציה למצוקה חוזרת",
  unusual_noise_indicator: "רעש חריג",
  crowd_noise_spike: "עליית רעש קבוצתית",
  argument_indicator: "אינדיקציה לוויכוח",
  impact_sound_indicator: "קול חבטה / פגיעה",
  emergency_sound_indicator: "אינדיקציית חירום"
};

function tone(status?: string) {
  if (["confirmed", "escalated"].includes(status ?? "")) return "pill bad";
  if (["dismissed", "false_positive"].includes(status ?? "")) return "pill good";
  return "pill warn";
}

export function AudioObserverEventsPanel({
  role,
  events,
  cameras,
  gardens = [],
  fixedKindergartenId
}: {
  role: "admin" | "garden";
  events: AudioEvent[];
  cameras: Option[];
  gardens?: Option[];
  fixedKindergartenId?: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [selectedGardenId, setSelectedGardenId] = useState(fixedKindergartenId ?? gardens[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const stats = useMemo(() => {
    const review = events.filter((event) => ["pending_review", "reviewing"].includes(event.review_status)).length;
    const high = events.filter((event) => ["high", "urgent", "critical"].includes(event.severity)).length;
    const falsePositive = events.filter((event) => event.review_status === "false_positive").length;
    const reviewed = events.filter((event) => event.reviewed_at).length;
    return { review, high, falsePositive, reviewed };
  }, [events]);
  const byType = events.reduce<Record<string, number>>((acc, event) => {
    acc[event.event_type] = (acc[event.event_type] ?? 0) + 1;
    return acc;
  }, {});

  async function post(payload: Record<string, unknown>) {
    setMessage(null);
    const response = await fetch("/api/audio-observer-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? "הפעולה נכשלה");
      return;
    }
    setMessage("נשמר. נדרש review אנושי.");
    router.refresh();
  }

  function createMock(formData: FormData) {
    startTransition(() => void post({
      action: "create_mock",
      kindergarten_id: fixedKindergartenId ?? (formData.get("kindergarten_id") || null),
      camera_id: formData.get("camera_id") || null,
      event_type: formData.get("event_type"),
      severity: formData.get("severity"),
      confidence: formData.get("confidence"),
      notes: formData.get("notes")
    }));
  }

  function review(id: string, review_status: string) {
    startTransition(() => void post({ action: "review", id, review_status, notes: "Review אנושי. אין מסקנה אוטומטית." }));
  }

  return (
    <div className="stack">
      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><Ear /><strong>{events.length}</strong><span>אירועי שמע</span></article>
        <article className="metric-card"><AlertTriangle /><strong>{stats.review}</strong><span>דורש review</span></article>
        <article className="metric-card"><Activity /><strong>{stats.high}</strong><span>חומרה גבוהה</span></article>
        <article className="metric-card"><ShieldCheck /><strong>{stats.falsePositive}</strong><span>false positives</span></article>
      </section>

      {message ? <div className={message.includes("נכשלה") ? "notice warning" : "notice success"}>{message}</div> : null}

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>יצירת אירוע שמע mock</h2><p>אין speech-to-text, אין זיהוי קולי ואין שמירת raw audio.</p></div>
          <form action={createMock} className="form-grid compact-form">
            {role === "admin" ? (
              <label className="form-field"><span>גן</span><select name="kindergarten_id" value={selectedGardenId} onChange={(event) => setSelectedGardenId(event.target.value)}><option value="">ללא גן</option>{gardens.map((garden) => <option key={garden.id} value={garden.id}>{garden.name}</option>)}</select></label>
            ) : <input type="hidden" name="kindergarten_id" value={fixedKindergartenId ?? ""} />}
            <label className="form-field"><span>מצלמה / מקור שמע</span><select name="camera_id"><option value="">ללא מצלמה ספציפית</option>{cameras.filter((camera) => !selectedGardenId || camera.garden_id === selectedGardenId).map((camera) => <option key={camera.id} value={camera.id}>{camera.name}</option>)}</select></label>
            <label className="form-field"><span>סוג אירוע</span><select name="event_type" defaultValue="distress_sound_indicator">{Object.entries(eventLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="form-field"><span>חומרה</span><select name="severity" defaultValue="medium"><option value="low">נמוכה</option><option value="medium">בינונית</option><option value="high">גבוהה</option><option value="urgent">דחופה</option><option value="critical">קריטית</option></select></label>
            <label className="form-field"><span>Confidence</span><input name="confidence" type="number" min="0" max="1" step="0.01" defaultValue="0.62" /></label>
            <label className="form-field full"><span>הערה</span><textarea name="notes" rows={3} placeholder="אינדיקציה בלבד, דורשת בדיקת אדם" /></label>
            <button className="button primary full" disabled={isPending}>יצירת mock</button>
          </form>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Audio categories</h2><p>מדדים פנימיים בלבד. אין הקלטות להורים ואין מסקנות משמעתיות.</p></div>
          <div className="risk-list">
            {Object.entries(eventLabels).map(([key, label]) => <div key={key}>{label} <b>{byType[key] ?? 0}</b></div>)}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Audio review queue</h2><p>Confirm / dismiss / escalate רק אחרי review אנושי.</p></div>
        {events.length === 0 ? <div className="empty-state"><strong>אין אירועי שמע</strong><span>אירועי mock או provider עתידי יופיעו כאן.</span></div> : (
          <div className="procedure-list">
            {events.map((event) => (
              <article className="card procedure-card" key={event.id}>
                <div>
                  <span className={tone(event.review_status)}>{event.review_status}</span>
                  <span className="pill">{event.severity}</span>
                  <h3>{eventLabels[event.event_type] ?? event.event_type}</h3>
                  <p>{event.recommended_action ?? "נדרשת בדיקה אנושית לפני כל פעולה."}</p>
                  <small>confidence {Number(event.confidence ?? 0).toFixed(2)} · {event.audio_source_type ?? "mock"} · no speech-to-text</small>
                  {event.notes ? <p>{event.notes}</p> : null}
                </div>
                <div className="procedure-meta">
                  <button className="button secondary" disabled={isPending} onClick={() => review(event.id, "reviewing")}>בבדיקה</button>
                  <button className="button secondary" disabled={isPending} onClick={() => review(event.id, "confirmed")}>אישור</button>
                  <button className="button secondary" disabled={isPending} onClick={() => review(event.id, "dismissed")}>דחייה</button>
                  <button className="button secondary" disabled={isPending} onClick={() => review(event.id, "escalated")}>הסלמה</button>
                  <button className="button secondary" disabled={isPending} onClick={() => review(event.id, "false_positive")}>False positive</button>
                  <button className="button secondary" disabled={isPending} onClick={() => review(event.id, "needs_more_data")}>צריך עוד מידע</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
