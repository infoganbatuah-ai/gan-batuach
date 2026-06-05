"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Brain, Camera, ShieldCheck, TriangleAlert } from "lucide-react";

type Row = Record<string, any>;
type Garden = { id: string; name: string };

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
  learningProfiles = []
}: {
  role: "admin" | "garden";
  fixedKindergartenId?: string | null;
  gardens?: Garden[];
  summaries: Row[];
  correlatedEvents?: Row[];
  cameraWarnings?: number;
  learningProfiles?: Row[];
}) {
  const router = useRouter();
  const [selectedGardenId, setSelectedGardenId] = useState(fixedKindergartenId ?? gardens[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scopedSummaries = summaries.filter((item) => !selectedGardenId || item.kindergarten_id === selectedGardenId);
  const scopedLearning = learningProfiles.find((profile) => profile.kindergarten_id === selectedGardenId);
  const metrics = useMemo(() => {
    const open = scopedSummaries.filter((item) => ["open", "reviewing", "snoozed"].includes(item.status)).length;
    const high = scopedSummaries.filter((item) => ["high", "urgent", "critical"].includes(item.severity)).length;
    const falsePositiveRelated = scopedSummaries.filter((item) => JSON.stringify(item.related_event_ids ?? []).includes("false_positive")).length;
    return { open, high, falsePositiveRelated };
  }, [scopedSummaries]);

  async function post(payload: Record<string, unknown>) {
    setMessage(null);
    const response = await fetch("/api/observer-intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? "הפעולה נכשלה");
      return;
    }
    setMessage("נשמר. הסיכומים דורשים review אנושי.");
    router.refresh();
  }

  function generate() {
    startTransition(() => void post({
      action: "generate",
      kindergarten_id: selectedGardenId || fixedKindergartenId || null
    }));
  }

  function review(id: string, status: string) {
    startTransition(() => void post({ action: "review", id, status, review_notes: "Review אנושי. אין מסקנה אוטומטית." }));
  }

  return (
    <div className="stack">
      {message ? <div className={message.includes("נכשלה") ? "notice warning" : "notice success"}>{message}</div> : null}
      {role === "admin" ? (
        <label className="form-field card">
          <span>גן</span>
          <select value={selectedGardenId} onChange={(event) => setSelectedGardenId(event.target.value)}>
            {gardens.map((garden) => <option value={garden.id} key={garden.id}>{garden.name}</option>)}
          </select>
        </label>
      ) : null}

      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><Brain /><strong>{metrics.open}</strong><span>דורש review</span></article>
        <article className="metric-card"><TriangleAlert /><strong>{metrics.high}</strong><span>עדיפות גבוהה</span></article>
        <article className="metric-card"><Camera /><strong>{cameraWarnings}</strong><span>אזהרות מצלמה</span></article>
        <article className="metric-card"><ShieldCheck /><strong>{scopedLearning?.learning_maturity ?? "new"}</strong><span>Learning maturity</span></article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <h2>מה דורש review עכשיו</h2>
          <p>הסיכומים נוצרים מנתוני תצפיתן, מצלמות, שמע, איסוף, learning ובקשות מעקב. אין מסקנה אוטומטית.</p>
          <button className="button primary" disabled={isPending || (!selectedGardenId && !fixedKindergartenId)} onClick={generate}>יצירת סיכומי מצב mock</button>
        </article>
        <article className="card action-panel">
          <h2>Context readiness</h2>
          <div className="risk-list">
            <div>Learning confidence <b>{percent(scopedLearning?.confidence_level)}</b></div>
            <div>Anomaly readiness <b>{percent(scopedLearning?.anomaly_readiness_score)}</b></div>
            <div>Correlated events <b>{correlatedEvents.filter((event) => !selectedGardenId || event.kindergarten_id === selectedGardenId).length}</b></div>
            <div>Parent auto notify <b>לא פעיל</b></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Observer situation summaries</h2><p>פעולות מומלצות זהירות בלבד. אין ניסוח משפטי/משמעתי ואין האשמה.</p></div>
        {scopedSummaries.length === 0 ? <div className="empty-state"><strong>אין סיכומי תצפיתן עדיין</strong><span>לחצו על יצירת סיכומי מצב כדי להריץ mock aggregation.</span></div> : (
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
