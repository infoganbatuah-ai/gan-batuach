"use client";

import { useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, Brain, Gauge, ShieldCheck } from "lucide-react";
import { anomalyReadinessLabels, baselineLabels } from "@/lib/domain/advanced-learning-engine";

type Row = Record<string, any>;
type Availability = { gardens: boolean; learningProfiles: boolean; baselines: boolean; cameraProfiles: boolean; zoneProfiles: boolean; feedbackSignals: boolean };
type Context = { target: string; canSave: boolean; generation: number };
type Feedback = { context: Context; busy: boolean; message: string | null; error: string | null };

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
  feedbackSignals = [],
  availability
}: {
  role: "admin" | "garden";
  kindergartenId?: string | null;
  gardens?: Row[];
  learningProfiles?: Row[];
  baselines?: Row[];
  cameraProfiles?: Row[];
  zoneProfiles?: Row[];
  feedbackSignals?: Row[];
  availability?: Availability;
}) {
  const router = useRouter();
  const qualified = role === "admin" && availability !== undefined;
  const gardensAvailable = !qualified || availability.gardens;
  const available = (source: keyof Availability) => !qualified || (gardensAvailable && availability[source]);
  const profileAvailable = available("learningProfiles");
  const baselinesAvailable = available("baselines");
  const camerasAvailable = available("cameraProfiles");
  const zonesAvailable = available("zoneProfiles");
  const signalsAvailable = available("feedbackSignals");
  const unavailable = "לא זמין";
  const [gardenId, setSelectedGardenId] = useState(kindergartenId ?? gardens[0]?.id ?? "");
  const selectedGardenId = qualified ? gardensAvailable ? gardens.some((garden) => garden.id === gardenId) ? gardenId : gardens[0]?.id ?? "" : "" : gardenId;
  if (qualified && gardenId !== selectedGardenId) setSelectedGardenId(selectedGardenId);
  const canSave = !qualified || (gardensAvailable && gardens.some((garden) => garden.id === selectedGardenId));
  const [snapshot, setSnapshot] = useState<Context>(() => ({ target: selectedGardenId, canSave, generation: 0 }));
  const context = useMemo(() => snapshot.target === selectedGardenId && snapshot.canSave === canSave ? snapshot : { target: selectedGardenId, canSave, generation: snapshot.generation + 1 }, [snapshot, selectedGardenId, canSave]);
  if (snapshot !== context) setSnapshot(context);
  const live = useRef<Context | null>(null);
  const baselineSequence = useRef(0);
  const feedbackSequence = useRef(0);
  useLayoutEffect(() => {
    live.current = context;
    return () => { if (live.current === context) live.current = null; };
  }, [context]);
  const [baselineFeedback, setBaselineFeedback] = useState<Feedback>(() => ({ context, busy: false, message: null, error: null }));
  const [reviewFeedback, setReviewFeedback] = useState<Feedback>(() => ({ context, busy: false, message: null, error: null }));
  const currentBaseline = baselineFeedback.context === context ? baselineFeedback : { context, busy: false, message: null, error: null };
  const currentReview = reviewFeedback.context === context ? reviewFeedback : { context, busy: false, message: null, error: null };
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scopedLearning = profileAvailable ? (qualified && !selectedGardenId ? undefined : learningProfiles.find((profile) => profile.kindergarten_id === selectedGardenId)) ?? (qualified ? {} : learningProfiles[0] ?? {}) : {};
  const inScope = (row: Row) => (!qualified && !selectedGardenId) || ((!qualified || Boolean(selectedGardenId)) && row.kindergarten_id === selectedGardenId);
  const scopedBaselines = baselinesAvailable ? baselines.filter(inScope) : [];
  const scopedCameraProfiles = camerasAvailable ? cameraProfiles.filter(inScope) : [];
  const scopedZoneProfiles = zonesAvailable ? zoneProfiles.filter(inScope) : [];
  const scopedSignals = signalsAvailable ? feedbackSignals.filter(inScope) : [];
  const metrics = (() => {
    const falsePositives = scopedSignals.filter((signal) => signal.review_outcome === "false_positive").length;
    const confirmed = scopedSignals.filter((signal) => ["confirmed", "valid_detection", "escalated"].includes(signal.review_outcome)).length;
    const reviewed = scopedSignals.length;
    return {
      falsePositiveRate: reviewed ? falsePositives / reviewed : 0,
      confirmedRate: reviewed ? confirmed / reviewed : 0,
      reviewed
    };
  })();

  function currentForm() {
    return !qualified || (canSave && live.current === context);
  }

  function runAction(kind: "baseline" | "feedback", payload: Record<string, unknown>) {
    if (qualified) {
      if (!currentForm()) return;
      const sequence = kind === "baseline" ? baselineSequence : feedbackSequence;
      const setter = kind === "baseline" ? setBaselineFeedback : setReviewFeedback;
      const token = ++sequence.current;
      const current = () => currentForm() && sequence.current === token;
      const update = (patch: Partial<Omit<Feedback, "context">>) => setter((previous) => current() ? { ...previous, context, ...patch } : previous);
      update({ busy: true, message: null, error: null });
      startTransition(() => {
        if (!current()) return;
        void (async () => {
          try {
            await postLearning(payload);
            if (!current()) return;
            update({ message: "נשמר כ-learning mock. אין פעולה אוטומטית ואין התראה להורים." });
            router.refresh();
          } catch (err) {
            update({ error: err instanceof Error ? err.message : "הפעולה נכשלה" });
          } finally {
            update({ busy: false });
          }
        })();
      });
      return;
    }
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
    if (!currentForm()) return;
    const target = String(formData.get("kindergarten_id") || selectedGardenId);
    if (qualified && (target !== selectedGardenId || !currentForm())) return;
    const payload = {
      action: "create_mock_baseline",
      kindergarten_id: target,
      baseline_type: String(formData.get("baseline_type") || "normal_activity_levels"),
      confidence_level: formData.get("confidence_level") || "0.18",
      anomaly_readiness_score: formData.get("anomaly_readiness_score") || "0.12"
    };
    if (!currentForm()) return;
    runAction("baseline", payload);
  }

  function recordFeedback(formData: FormData) {
    if (!currentForm()) return;
    const target = String(formData.get("kindergarten_id") || selectedGardenId);
    if (qualified && (target !== selectedGardenId || !currentForm())) return;
    const payload = {
      action: "record_feedback",
      kindergarten_id: target,
      source_type: String(formData.get("source_type") || "mock"),
      event_type: String(formData.get("event_type") || "mock_reviewed_event"),
      review_outcome: String(formData.get("review_outcome") || "confirmed")
    };
    if (!currentForm()) return;
    runAction("feedback", payload);
  }

  return (
    <div className="stack">
      {qualified ? <>
        {currentBaseline.message ? <div className="success-banner">{currentBaseline.message}</div> : null}
        {currentReview.message ? <div className="success-banner">{currentReview.message}</div> : null}
        {currentBaseline.error ? <div className="error-banner">{currentBaseline.error}</div> : null}
        {currentReview.error ? <div className="error-banner">{currentReview.error}</div> : null}
      </> : <>
        {message ? <div className="success-banner">{message}</div> : null}
        {error ? <div className="error-banner">{error}</div> : null}
      </>}

      {role === "admin" ? (
        <label className="form-field card">
          <span>גן לבדיקה</span>
          <select value={selectedGardenId} disabled={!gardensAvailable || gardens.length === 0} onChange={(event) => setSelectedGardenId(event.target.value)}>
            {!gardensAvailable ? <option value="">{unavailable}</option> : gardens.map((garden) => <option value={garden.id} key={garden.id}>{garden.name}</option>)}
          </select>
        </label>
      ) : null}

      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><Brain /><strong>{profileAvailable ? scopedLearning.learning_maturity ?? "new" : unavailable}</strong><span>Learning maturity</span></article>
        <article className="metric-card"><Gauge /><strong>{profileAvailable ? percent(scopedLearning.confidence_level) : unavailable}</strong><span>Confidence trend</span></article>
        <article className="metric-card"><Activity /><strong>{profileAvailable ? percent(scopedLearning.anomaly_readiness_score) : unavailable}</strong><span>Anomaly readiness</span></article>
        <article className="metric-card"><ShieldCheck /><strong>{signalsAvailable ? qualified && metrics.reviewed === 0 ? "טרם נמדד" : percent(metrics.falsePositiveRate) : unavailable}</strong><span>False positive rate</span></article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <form key={qualified ? `baseline-${context.generation}` : undefined} className="card form compact-form" action={createBaseline}>
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
          <button className="button primary" disabled={qualified ? !canSave || currentBaseline.busy : isPending}>שמירת baseline mock</button>
        </form>

        <form key={qualified ? `feedback-${context.generation}` : undefined} className="card form compact-form" action={recordFeedback}>
          <div>
            <p className="eyebrow">Reviewed feedback</p>
            <h2>כיול confidence לפי review</h2>
            <p>אירוע שאושר מעלה confidence. False positive או דחייה מורידים confidence.</p>
          </div>
          <input type="hidden" name="kindergarten_id" value={selectedGardenId} />
          <label>מקור<select name="source_type" defaultValue="mock">{sourceTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>סוג אירוע<input name="event_type" defaultValue="mock_reviewed_event" /></label>
          <label>תוצאת review<select name="review_outcome" defaultValue="confirmed">{outcomes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <button className="button primary" disabled={qualified ? !canSave || currentReview.busy : isPending}>שמירת feedback mock</button>
        </form>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <h2>Behavior baselines</h2>
          {!baselinesAvailable ? <div className="empty-mini">{unavailable}</div> : scopedBaselines.length === 0 ? <div className="empty-mini">אין baselines עדיין.</div> : scopedBaselines.slice(0, 10).map((baseline) => (
            <div className="list-item" key={baseline.id}>
              <div><strong>{baselineLabels[baseline.baseline_type] ?? baseline.baseline_type}</strong><span>confidence {percent(baseline.confidence_level)} · readiness {percent(baseline.anomaly_readiness_score)}</span></div>
              <span className={maturityTone(baseline.learning_maturity)}>{baseline.learning_maturity}</span>
            </div>
          ))}
        </article>
        <article className="card action-panel">
          <h2>Anomaly readiness</h2>
          <div className="risk-list">
            {Object.entries(anomalyReadinessLabels).map(([key, label]) => <div key={key}>{label}<b>{profileAvailable ? percent(scopedLearning.anomaly_readiness_score) : unavailable}</b></div>)}
          </div>
        </article>
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel"><h2>Camera profiles</h2><strong>{camerasAvailable ? scopedCameraProfiles.length : unavailable}</strong><p>activity, motion, occupancy, offline, obstruction and anomaly history.</p></article>
        <article className="card action-panel"><h2>Zone profiles</h2><strong>{zonesAvailable ? scopedZoneProfiles.length : unavailable}</strong><p>expected occupancy, schedules, movement and restricted-area behavior.</p></article>
        <article className="card action-panel"><h2>Reviewed signals</h2><strong>{signalsAvailable ? metrics.reviewed : unavailable}</strong><p>confirmed, dismissed, escalated and false-positive feedback.</p></article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Recent learning feedback</h2><p>משמש לכיול בלבד. אין אכיפה, אין האשמות ואין התראות אוטומטיות להורים.</p></div>
        {!signalsAvailable ? <div className="empty-state"><strong>{unavailable}</strong></div> : scopedSignals.length === 0 ? <div className="empty-state"><strong>אין feedback עדיין</strong><span>לאחר review אנושי, אותות כיול יופיעו כאן.</span></div> : (
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
