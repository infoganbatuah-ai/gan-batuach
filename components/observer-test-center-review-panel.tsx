"use client";

import { useState } from "react";

type Row = Record<string, any>;

const outcomeLabels: Record<string, string> = {
  correct_detection: "זיהוי נכון",
  missed_detection: "זיהוי שפוספס",
  false_positive: "False positive",
  false_negative: "False negative",
  uncertain: "לא בטוח"
};

export function ObserverTestCenterReviewPanel({ events }: { events: Row[] }) {
  const [rows, setRows] = useState(events);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function submit(event: Row, action: "review" | "replay", outcome?: string) {
    setBusy(`${action}-${event.id}`);
    setMessage(null);
    const response = await fetch("/api/admin/observer-test-center/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        event_source: event.event_source,
        event_id: event.id,
        outcome,
        observer_recommendation: event.observer_recommendation ?? event.recommended_action ?? null,
        confidence_at_review: Number(event.confidence ?? event.confidence_score ?? event.combined_confidence ?? 0)
      })
    });
    const body = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setMessage(body.error || "הפעולה נכשלה");
      return;
    }
    if (action === "review" && outcome) {
      setRows((current) => current.map((row) => row.id === event.id ? { ...row, ground_truth_outcome: outcome } : row));
      setMessage("Feedback נשמר. לא הופעלה פעולה אוטומטית.");
    } else {
      setMessage("Replay נשמר לבדיקה. אין חשיפת מדיה גולמית.");
    }
  }

  return (
    <section className="dashboard-section">
      <div className="section-heading">
        <h2>Ground truth review</h2>
        <p>הבודק משווה המלצת תצפיתן למציאות. אין האשמות ואין פעולה אוטומטית.</p>
      </div>
      {message ? <div className="status-banner">{message}</div> : null}
      {rows.length === 0 ? <div className="empty-state"><strong>אין אירועים לבדיקה</strong><span>אירועי shadow, אודיו או correlation יופיעו כאן.</span></div> : (
        <div className="procedure-list">
          {rows.map((event) => (
            <article className="card procedure-card" key={`${event.event_source}-${event.id}`}>
              <div>
                <span className="pill warn">Shadow mode</span>
                <span className="pill">{event.event_source}</span>
                {event.ground_truth_outcome ? <span className="pill good">{outcomeLabels[event.ground_truth_outcome] ?? event.ground_truth_outcome}</span> : null}
                <h3>{event.event_type ?? event.correlation_type ?? "אירוע לבדיקה"}</h3>
                <p>{event.description ?? event.observer_recommendation ?? event.recommended_action ?? "נדרש review אנושי."}</p>
                <small>Confidence {Math.round(Number(event.confidence ?? event.confidence_score ?? event.combined_confidence ?? 0) * 100)}% · {event.created_at ? new Date(event.created_at).toLocaleString("he-IL") : ""}</small>
              </div>
              <div className="procedure-meta">
                {Object.entries(outcomeLabels).map(([value, label]) => (
                  <button className="button secondary tiny" disabled={busy === `review-${event.id}`} key={value} type="button" onClick={() => submit(event, "review", value)}>{label}</button>
                ))}
                <button className="button secondary tiny" disabled={busy === `replay-${event.id}`} type="button" onClick={() => submit(event, "replay")}>Replay</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
