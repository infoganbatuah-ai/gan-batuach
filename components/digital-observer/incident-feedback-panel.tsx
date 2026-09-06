"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCheck, LoaderCircle, MessageSquareText, ShieldCheck } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";
import type { DigitalObserverFeedbackLabel } from "@/lib/domain/digital-observer/feedback-calibration";

const feedbackOptions: Array<{ label: DigitalObserverFeedbackLabel; title: string; description: string }> = [
  { label: "TRUE_SECURITY_EVENT", title: "אמיתי ודורש תשומת לב", description: "הפעילות הייתה אמיתית ובעלת משמעות אבטחתית." },
  { label: "TRUE_EXPECTED_ACTIVITY", title: "אמיתי אבל צפוי", description: "הפעילות הייתה אמיתית, רגילה או בלתי מזיקה." },
  { label: "FALSE_DETECTION", title: "זיהוי שגוי", description: "לא היה אדם או אובייקט מהסוג שזוהה." },
  { label: "FALSE_CORRELATION", title: "קיבוץ תקרית שגוי", description: "האירועים אמיתיים, אך אינם שייכים לאותה תקרית." },
  { label: "FALSE_SPATIAL_EVENT", title: "מעבר או אזור שגוי", description: "הזיהוי אמיתי, אך כניסה, יציאה או חציית אזור לא התרחשו." },
  { label: "UNCERTAIN", title: "לא בטוח", description: "אין מספיק מידע לקביעה אמינה." }
];

const labelName = (label?: string | null) => feedbackOptions.find((item) => item.label === label)?.title
  ?? (label === "OTHER" ? "אחר" : "טרם נמסר משוב");

async function postFeedback(body: Record<string, unknown>) {
  const token = readObserverAccessToken();
  const response = await fetch("/api/digital-observer/incidents/feedback", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "לא ניתן לשמור את המשוב");
  return payload.data as { message?: string };
}

export function IncidentFeedbackPanel({
  incidentId,
  currentLabel,
  currentFeedbackId,
  groundTruthLabel,
  canReview
}: {
  incidentId: string;
  currentLabel?: string | null;
  currentFeedbackId?: string | null;
  groundTruthLabel?: string | null;
  canReview: boolean;
}) {
  const router = useRouter();
  const pendingKeys = useRef(new Map<string, string>());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function idempotencyKey(action: string) {
    const existing = pendingKeys.current.get(action);
    if (existing) return existing;
    const value = `${action}:${crypto.randomUUID()}`;
    pendingKeys.current.set(action, value);
    return value;
  }

  async function submit(label: DigitalObserverFeedbackLabel) {
    const actionKey = `submit:${label}`;
    setBusy(actionKey);
    setMessage("");
    setError("");
    try {
      const result = await postFeedback({
        action: "submit",
        incident_id: incidentId,
        target_type: "INCIDENT",
        label,
        note: note.trim() || undefined,
        idempotency_key: idempotencyKey(actionKey)
      });
      pendingKeys.current.delete(actionKey);
      setMessage(result.message || "המשוב נשמר.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא ניתן לשמור את המשוב");
    } finally {
      setBusy(null);
    }
  }

  async function approveGroundTruth() {
    if (!currentFeedbackId || !currentLabel) return;
    const actionKey = `review:${currentFeedbackId}:${currentLabel}`;
    setBusy(actionKey);
    setMessage("");
    setError("");
    try {
      const result = await postFeedback({
        action: "review",
        feedback_id: currentFeedbackId,
        label: currentLabel,
        note: note.trim() || "אושר בביקורת אנושית",
        idempotency_key: idempotencyKey(actionKey)
      });
      pendingKeys.current.delete(actionKey);
      setMessage(result.message || "התיוג אושר כ‑Ground Truth.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא ניתן להשלים את הביקורת");
    } finally {
      setBusy(null);
    }
  }

  return <article className="do-panel do-event-review-panel">
    <div className="do-section-head"><div><h2>משוב על התקרית</h2><p>ספרו לנו מה קרה בפועל. פעילות אמיתית וצפויה אינה זיהוי שגוי.</p></div><MessageSquareText /></div>
    <div className="do-summary-list">
      <div><span>המשוב הנוכחי</span><strong>{labelName(currentLabel)}</strong></div>
      <div><span>Ground Truth שנבדק</span><strong>{labelName(groundTruthLabel)}</strong></div>
    </div>
    <div className="do-grid cols-2">
      {feedbackOptions.map((option) => <button
        className={`do-button secondary ${currentLabel === option.label ? "active" : ""}`}
        type="button"
        disabled={Boolean(busy)}
        title={option.description}
        onClick={() => void submit(option.label)}
        key={option.label}
      >{busy === `submit:${option.label}` ? <LoaderCircle className="do-spin" /> : currentLabel === option.label ? <Check /> : null}{option.title}</button>)}
    </div>
    <label className="do-field wide"><span>הערה אופציונלית</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} placeholder="מידע קצר שיעזור לבדיקה, ללא פרטי גישה או סודות" /></label>
    <div className="do-notice info"><ShieldCheck /><span><strong>למידה מבוקרת בלבד</strong><small>המשוב נשמר לניתוח וכיול. הוא אינו משנה מיד מודל, סף, Risk, כלל או קו בסיס.</small></span></div>
    {canReview && currentFeedbackId ? <div className="do-button-row"><button className="do-button primary" type="button" disabled={Boolean(busy)} onClick={() => void approveGroundTruth()}>{busy?.startsWith("review:") ? <LoaderCircle className="do-spin" /> : <ClipboardCheck />} אישור כ‑Ground Truth</button></div> : null}
    {message ? <div className="do-notice info" role="status"><Check /><span>{message}</span></div> : null}
    {error ? <div className="do-notice warn" role="alert"><span>{error}</span></div> : null}
  </article>;
}
