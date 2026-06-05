"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, Brain, Gauge, ShieldCheck } from "lucide-react";
import { anomalyReadinessLabels, baselineLabels } from "@/lib/domain/advanced-learning-engine";

type Row = Record<string, any>;

const outcomes = [
  ["confirmed", "אושר"],
  ["dismissed", "נדחה"],
  ["false_positive", "False positive"],
  ["escalated", "הוסלם"],
  ["valid_detection", "זיהוי תקין"],
  ["needs_more_data", "צריך עוד מידע"]
] as const;

const sourceTypes = [
  ["ai_camera_event", "אירוע מצלמה"],
  ["audio_observer_event", "אירוע שמע"],
  ["pickup_event", "איסוף"],
  ["watch_request", "בקשת מעקב"],
  ["safety_incident", "אירוע בטיחות"],
  ["camera_health", "בריאות מצלמה"],
  ["mock", "Mock"]
] as const;

function percent(value: unknown) {
  return `${Math.round(Number(value ?? 0) * 100)}%`;
}

function maturityTone(value?: string) {
  if (value === "mature" || value === "calibrated") return "pill good";
  if (value === "learning") return "pill warn";
  return "pill";
}

async function postLearning(payload: Record<string, unknown>) {
  const response = await fetch("/api/observer-learning-advanced", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "הפעולה נכשלה");
  return body.data;
}

export function AdvancedLearningDashboard({
  role,
  kindergartenId,
  gardens = [],
  learningProfiles = [],
  baselines = [],
  cameraProfiles = [],
  zoneProfiles = [],
  feedbackSignals = []
}: {
  role: "admin" | "garden";
  kindergartenId?: string | null;
  gardens?: Row[];
  learningProfiles?: Row[];
  baselines?: Row[];
  cameraProfiles?: Row[];
  zoneProfiles?: Row[];
  feedbackSignals?: Row[];
}) {
  const router = useRouter();
  const [selectedGardenId, setSelectedGardenId] = useState(kindergartenId ?? gardens[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scopedLearning = learningProfiles.find((profile) => profile.kindergarten_id === selectedGardenId) ?? learningProfiles[0] ?? {};
  const scopedBaselines = baselines.filter((baseline) => !selectedGardenId || baseline.kindergarten_id === selectedGardenId);
  const scopedCameraProfiles = cameraProfiles.filter((profile) => !selectedGardenId || profile.kindergarten_id === selectedGardenId);
  const scopedZoneProfiles = zoneProfiles.filter((profile) => !selectedGardenId || profile.kindergarten_id === selectedGardenId);
  const scopedSignals = feedbackSignals.filter((signal) => !selectedGardenId || signal.kindergarten_id === selectedGardenId);
  const metrics = useMemo(() => {
    const falsePositives = scopedSignals.filter((signal) => signal.review_outcome === "false_positive").length;
    const confirmed = scopedSignals.filter((signal) => ["confirmed", "valid_detection", "escalated"].includes(signal.review_outcome)).length;
    const reviewed = scopedSignals.length;
    return {
      falsePositiveRate: reviewed ? falsePositives / reviewed : 0,
      confirmedRate: reviewed ? confirmed / reviewed : 0,
      reviewed
    };
  }, [scopedSignals]);

  function runAction(payload: Record<string, unknown>) {
    setMessage(null);
    setError(null);
    startTransition(() => {
      void (async () => {
      try {
        await postLearning(payload);
        setMessage("נשמר כ-learning mock. אין פעולה אוטומטית ואין התראה להורים.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "הפעולה נכשלה");
      }
      })();
    });
  }

  function createBaseline(formData: FormData) {
    runAction({
      action: "create_mock_baseline",
      kindergarten_id: String(formData.get("kindergarten_id") || selectedGardenId),
      baseline_type: String(formData.get("baseline_type") || "normal_activity_levels"),
      confidence_level: formData.get("confidence_level") || "0.18",
      anomaly_readiness_score: formData.get("anomaly_readiness_score") || "0.12"
    });
  }

  function recordFeedback(formData: FormData) {
    runAction({
      action: "record_feedback",
      kindergarten_id: String(formData.get("kindergarten_id") || selectedGardenId),
      source_type: String(formData.get("source_type") || "mock"),
      event_type: String(formData.get("event_type") || "mock_reviewed_event"),
      review_outcome: String(formData.get("review_outcome") || "confirmed")
    });
  }

  return (
    <div className="stack">
      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {role === "admin" ? (
        <label className="form-field card">
          <span>גן לבדיקה</span>
          <select value={selectedGardenId} onChange={(event) => setSelectedGardenId(event.target.value)}>
            {gardens.map((garden) => <option value={garden.id} key={garden.id}>{garden.name}</option>)}
          </select>
        </label>
      ) : null}

      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><Brain /><strong>{scopedLearning.learning_maturity ?? "new"}</strong><span>Learning maturity</span></article>
        <article className="metric-card"><Gauge /><strong>{percent(scopedLearning.confidence_level)}</strong><span>Confidence trend</span></article>
        <article className="metric-card"><Activity /><strong>{percent(scopedLearning.anomaly_readiness_score)}</strong><span>Anomaly readiness</span></article>
        <article className="metric-card"><ShieldCheck /><strong>{percent(metrics.falsePositiveRate)}</strong><span>False positive rate</span></article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <form className="card form compact-form" action={createBaseline}>
          <div>
            <p className="eyebrow">Mock baseline</p>
            <h2>יצירת baseline התנהגותי</h2>
            <p>תשתית למידה ברמת אתר/גן בלבד. אין פרופיל ילדים, אין ניקוד צוות ואין החלטות אוטומטיות.</p>
          </div>
          <input type="hidden" name="kindergarten_id" value={selectedGardenId} />
          <label>סוג baseline<select name="baseline_type" defaultValue="normal_activity_levels">{Object.entries(baselineLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
          <div className="form-grid two">
            <label>Confidence<input name="confidence_level" type="number" min="0" max="1" step="0.01" defaultValue="0.18" /></label>
            <label>Anomaly readiness<input name="anomaly_readiness_score" type="number" min="0" max="1" step="0.01" defaultValue="0.12" /></label>
          </div>
          <button className="button primary" disabled={isPending}>שמירת baseline mock</button>
        </form>

        <form className="card form compact-form" action={recordFeedback}>
          <div>
            <p className="eyebrow">Reviewed feedback</p>
            <h2>כיול confidence לפי review</h2>
            <p>אירוע שאושר מעלה confidence. False positive או דחייה מורידים confidence.</p>
          </div>
          <input type="hidden" name="kindergarten_id" value={selectedGardenId} />
          <label>מקור<select name="source_type" defaultValue="mock">{sourceTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>סוג אירוע<input name="event_type" defaultValue="mock_reviewed_event" /></label>
          <label>תוצאת review<select name="review_outcome" defaultValue="confirmed">{outcomes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <button className="button primary" disabled={isPending}>שמירת feedback mock</button>
        </form>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <h2>Behavior baselines</h2>
          {scopedBaselines.length === 0 ? <div className="empty-mini">אין baselines עדיין.</div> : scopedBaselines.slice(0, 10).map((baseline) => (
            <div className="list-item" key={baseline.id}>
              <div><strong>{baselineLabels[baseline.baseline_type] ?? baseline.baseline_type}</strong><span>confidence {percent(baseline.confidence_level)} · readiness {percent(baseline.anomaly_readiness_score)}</span></div>
              <span className={maturityTone(baseline.learning_maturity)}>{baseline.learning_maturity}</span>
            </div>
          ))}
        </article>
        <article className="card action-panel">
          <h2>Anomaly readiness</h2>
          <div className="risk-list">
            {Object.entries(anomalyReadinessLabels).map(([key, label]) => <div key={key}>{label}<b>{percent(scopedLearning.anomaly_readiness_score)}</b></div>)}
          </div>
        </article>
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel"><h2>Camera profiles</h2><strong>{scopedCameraProfiles.length}</strong><p>activity, motion, occupancy, offline, obstruction and anomaly history.</p></article>
        <article className="card action-panel"><h2>Zone profiles</h2><strong>{scopedZoneProfiles.length}</strong><p>expected occupancy, schedules, movement and restricted-area behavior.</p></article>
        <article className="card action-panel"><h2>Reviewed signals</h2><strong>{metrics.reviewed}</strong><p>confirmed, dismissed, escalated and false-positive feedback.</p></article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Recent learning feedback</h2><p>משמש לכיול בלבד. אין אכיפה, אין האשמות ואין התראות אוטומטיות להורים.</p></div>
        {scopedSignals.length === 0 ? <div className="empty-state"><strong>אין feedback עדיין</strong><span>לאחר review אנושי, אותות כיול יופיעו כאן.</span></div> : (
          <div className="procedure-list">
            {scopedSignals.slice(0, 12).map((signal) => (
              <article className="card procedure-card" key={signal.id}>
                <div>
                  <span className={maturityTone(signal.maturity_after)}>{signal.maturity_after}</span>
                  <span className="pill">{signal.review_outcome}</span>
                  <h3>{signal.event_type}</h3>
                  <p>{signal.source_type} · delta {Number(signal.confidence_delta ?? 0).toFixed(2)} · confidence {percent(signal.confidence_after)}</p>
                </div>
                <div className="procedure-meta"><small>{signal.created_at ? new Date(signal.created_at).toLocaleString("he-IL") : ""}</small></div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
