"use client";

import { useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Brain, Camera, ShieldCheck, TriangleAlert } from "lucide-react";

type Row = Record<string, any>;
type Garden = { id: string; name: string };
type Availability = { gardens: boolean; summaries: boolean; correlatedEvents: boolean; cameras: boolean; learningProfiles: boolean };

const summaryTypeLabels: Record<string, string> = {
  needs_review_now: "דורש review עכשיו",
  camera_health_warning: "בריאות מצלמות",
  unresolved_safety_indicators: "אינדיקציות בטיחות",
  correlated_event_attention: "צירי זמן מקושרים",
  audio_indicator_attention: "אינדיקציות שמע",
  watch_request_attention: "בקשות מעקב",
  pickup_verification_attention: "איסוף",
  learning_readiness: "מוכנות למידה",
  site_health: "בריאות אתר",
  mock_summary: "Mock"
};

const statusLabels: Record<string, string> = {
  open: "פתוח",
  reviewing: "בבדיקה",
  handled: "טופל",
  dismissed: "נדחה",
  escalated: "הוסלם",
  snoozed: "נדחה זמנית"
};

function tone(severity?: string) {
  if (["critical", "urgent", "high"].includes(severity ?? "")) return "pill bad";
  if (severity === "medium") return "pill warn";
  return "pill good";
}

function statusTone(status?: string) {
  if (status === "handled" || status === "dismissed") return "pill good";
  if (status === "escalated") return "pill bad";
  return "pill warn";
}

function percent(value: unknown) {
  return `${Math.round(Number(value ?? 0) * 100)}%`;
}

export function ObserverIntelligencePanel({
  role,
  fixedKindergartenId,
  gardens = [],
  summaries,
  correlatedEvents = [],
  cameraWarnings = 0,
  learningProfiles = [],
  availability
}: {
  role: "admin" | "garden";
  fixedKindergartenId?: string | null;
  gardens?: Garden[];
  summaries: Row[];
  correlatedEvents?: Row[];
  cameraWarnings?: number;
  learningProfiles?: Row[];
  availability?: Availability;
}) {
  const router = useRouter();
  const qualified = role === "admin" && availability !== undefined;
  const gardensAvailable = !qualified || availability.gardens;
  const summariesAvailable = !qualified || availability.summaries;
  const correlatedAvailable = !qualified || availability.correlatedEvents;
  const camerasAvailable = !qualified || availability.cameras;
  const learningAvailable = !qualified || availability.learningProfiles;
  const unavailable = "לא זמין";
  const [gardenId, setSelectedGardenId] = useState(fixedKindergartenId ?? gardens[0]?.id ?? "");
  const selectedGardenId = qualified
    ? gardensAvailable ? (gardens.some((garden) => garden.id === gardenId) ? gardenId : gardens[0]?.id ?? "") : ""
    : gardenId;
  // Reconcile only an invalid Admin selection, preserving valid choices across
  // reordering, renamed options and unrelated source/metadata refreshes.
  if (qualified && gardenId !== selectedGardenId) setSelectedGardenId(selectedGardenId);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scopedSummaries = useMemo(() => summariesAvailable ? summaries.filter((item) => !selectedGardenId || item.kindergarten_id === selectedGardenId) : [], [summariesAvailable, summaries, selectedGardenId]);
  const scopedLearning = learningAvailable ? learningProfiles.find((profile) => profile.kindergarten_id === selectedGardenId) : undefined;
  const canGenerate = qualified ? gardensAvailable && gardens.some((garden) => garden.id === selectedGardenId) : Boolean(selectedGardenId || fixedKindergartenId);
  const destinationIdentity = qualified ? JSON.stringify([role, selectedGardenId, canGenerate]) : "legacy";
  const reviewIdentity = qualified ? JSON.stringify([role, selectedGardenId, summariesAvailable, scopedSummaries.map((item) => [
    item.id, item.kindergarten_id, item.status, item.severity, item.summary_type,
    item.title, item.summary, item.confidence, (item.related_event_ids ?? []).length, item.recommended_actions ?? []
  ])]) : "legacy";
  const [destinationSnapshot, setDestinationSnapshot] = useState(() => ({ identity: destinationIdentity, generation: 0 }));
  const [reviewSnapshot, setReviewSnapshot] = useState(() => ({ identity: reviewIdentity, generation: 0 }));
  const currentDestination = useMemo(() => destinationSnapshot.identity === destinationIdentity ? destinationSnapshot : { identity: destinationIdentity, generation: destinationSnapshot.generation + 1 }, [destinationSnapshot, destinationIdentity]);
  const currentReview = useMemo(() => reviewSnapshot.identity === reviewIdentity ? reviewSnapshot : { identity: reviewIdentity, generation: reviewSnapshot.generation + 1 }, [reviewSnapshot, reviewIdentity]);
  if (destinationSnapshot.identity !== destinationIdentity) setDestinationSnapshot(currentDestination);
  if (reviewSnapshot.identity !== reviewIdentity) setReviewSnapshot(currentReview);
  const liveDestination = useRef<typeof currentDestination | null>(null);
  const liveReview = useRef<typeof currentReview | null>(null);
  // Commit-bound, independently scoped snapshots reject captured callbacks and
  // responses across A->B->A or unmount without fencing unrelated data updates.
  useLayoutEffect(() => {
    liveDestination.current = currentDestination;
    return () => { if (liveDestination.current === currentDestination) liveDestination.current = null; };
  }, [currentDestination]);
  useLayoutEffect(() => {
    liveReview.current = currentReview;
    return () => { if (liveReview.current === currentReview) liveReview.current = null; };
  }, [currentReview]);
  function generationCurrent() {
    return !qualified || (canGenerate && liveDestination.current === currentDestination);
  }
  function reviewCurrent(id: string) {
    return !qualified || (summariesAvailable && liveReview.current === currentReview && scopedSummaries.some((item) => item.id === id));
  }
  const metrics = useMemo(() => {
    const open = scopedSummaries.filter((item) => ["open", "reviewing", "snoozed"].includes(item.status)).length;
    const high = scopedSummaries.filter((item) => ["high", "urgent", "critical"].includes(item.severity)).length;
    const falsePositiveRelated = scopedSummaries.filter((item) => JSON.stringify(item.related_event_ids ?? []).includes("false_positive")).length;
    return { open, high, falsePositiveRelated };
  }, [scopedSummaries]);

  async function post(payload: Record<string, unknown>, current: () => boolean) {
    if (!current()) return;
    setMessage((previous) => current() ? null : previous);
    const response = await fetch("/api/observer-intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!current()) return;
    if (!response.ok) {
      setMessage((previous) => current() ? body.error ?? "הפעולה נכשלה" : previous);
      return;
    }
    setMessage((previous) => current() ? "נשמר. הסיכומים דורשים review אנושי." : previous);
    router.refresh();
  }

  function generate() {
    if (!generationCurrent()) return;
    startTransition(() => void post({
      action: "generate",
      kindergarten_id: qualified ? selectedGardenId : selectedGardenId || fixedKindergartenId || null
    }, generationCurrent));
  }

  function review(id: string, status: string) {
    if (!reviewCurrent(id)) return;
    startTransition(() => void post({ action: "review", id, status, review_notes: "Review אנושי. אין מסקנה אוטומטית." }, () => reviewCurrent(id)));
  }

  return (
    <div className="stack">
      {message ? <div className={message.includes("נכשלה") ? "notice warning" : "notice success"}>{message}</div> : null}
      {role === "admin" ? (
        <label className="form-field card">
          <span>גן</span>
          <select value={selectedGardenId} disabled={qualified && (!gardensAvailable || gardens.length === 0)} onChange={(event) => setSelectedGardenId(event.target.value)}>
            {gardensAvailable ? gardens.map((garden) => <option value={garden.id} key={garden.id}>{garden.name}</option>) : null}
          </select>
          {!gardensAvailable ? <span>אפשרויות הגן אינן זמינות</span> : null}
        </label>
      ) : null}

      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><Brain /><strong>{summariesAvailable ? metrics.open : unavailable}</strong><span>דורש review</span></article>
        <article className="metric-card"><TriangleAlert /><strong>{summariesAvailable ? metrics.high : unavailable}</strong><span>עדיפות גבוהה</span></article>
        <article className="metric-card"><Camera /><strong>{camerasAvailable ? cameraWarnings : unavailable}</strong><span>אזהרות מצלמה</span></article>
        <article className="metric-card"><ShieldCheck /><strong>{learningAvailable ? scopedLearning?.learning_maturity ?? "new" : unavailable}</strong><span>Learning maturity</span></article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <h2>מה דורש review עכשיו</h2>
          <p>הסיכומים נוצרים מנתוני תצפיתן, מצלמות, שמע, איסוף, learning ובקשות מעקב. אין מסקנה אוטומטית.</p>
          <button className="button primary" disabled={isPending || !canGenerate} onClick={generate}>יצירת סיכומי מצב mock</button>
        </article>
        <article className="card action-panel">
          <h2>Context readiness</h2>
          <div className="risk-list">
            <div>Learning confidence <b>{learningAvailable ? percent(scopedLearning?.confidence_level) : unavailable}</b></div>
            <div>Anomaly readiness <b>{learningAvailable ? percent(scopedLearning?.anomaly_readiness_score) : unavailable}</b></div>
            <div>Correlated events <b>{correlatedAvailable ? correlatedEvents.filter((event) => !selectedGardenId || event.kindergarten_id === selectedGardenId).length : unavailable}</b></div>
            <div>Parent auto notify <b>לא פעיל</b></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Observer situation summaries</h2><p>פעולות מומלצות זהירות בלבד. אין ניסוח משפטי/משמעתי ואין האשמה.</p></div>
        {!summariesAvailable ? <div className="empty-state"><strong>סיכומי התצפיתן אינם זמינים כרגע</strong></div> : scopedSummaries.length === 0 ? <div className="empty-state"><strong>אין סיכומי תצפיתן עדיין</strong><span>לחצו על יצירת סיכומי מצב כדי להריץ mock aggregation.</span></div> : (
          <div className="procedure-list">
            {scopedSummaries.map((item) => (
              <article className="card procedure-card" key={item.id}>
                <div>
                  <span className={tone(item.severity)}>{item.severity}</span>
                  <span className={statusTone(item.status)}>{statusLabels[item.status] ?? item.status}</span>
                  <span className="pill">{summaryTypeLabels[item.summary_type] ?? item.summary_type}</span>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  <small>confidence {percent(item.confidence)} · related {(item.related_event_ids ?? []).length} · human review required</small>
                  <div className="tag-cloud">
                    {(item.recommended_actions ?? []).map((action: string) => <span key={action}>{action}</span>)}
                  </div>
                </div>
                <div className="procedure-meta">
                  <button className="button secondary" disabled={isPending} onClick={() => review(item.id, "reviewing")}>בבדיקה</button>
                  <button className="button secondary" disabled={isPending} onClick={() => review(item.id, "handled")}>טופל</button>
                  <button className="button secondary" disabled={isPending} onClick={() => review(item.id, "dismissed")}>דחייה</button>
                  <button className="button secondary" disabled={isPending} onClick={() => review(item.id, "escalated")}>הסלמה</button>
                  <button className="button secondary" disabled={isPending} onClick={() => review(item.id, "snoozed")}>Snooze</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
