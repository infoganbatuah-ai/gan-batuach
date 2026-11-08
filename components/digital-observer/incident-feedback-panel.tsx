"use client";

import { useLayoutEffect, useRef, useState } from "react";
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

async function postFeedback(body: Record<string, unknown>, isCurrent: () => boolean = () => true) {
  if (!isCurrent()) return null;
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
  if (!isCurrent()) return null;
  const payload = await response.json().catch(() => ({}));
  if (!isCurrent()) return null;
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
  return <ScopedIncidentFeedbackPanel key={incidentId} incidentId={incidentId} currentLabel={currentLabel} currentFeedbackId={currentFeedbackId} groundTruthLabel={groundTruthLabel} canReview={canReview} />;
}

type FeedbackRetryEntry = { key: string; noteRevision: number };

function ScopedIncidentFeedbackPanel({ incidentId, currentLabel, currentFeedbackId, groundTruthLabel, canReview }: Parameters<typeof IncidentFeedbackPanel>[0]) {
  const router = useRouter();
  const pendingKeys = useRef(new Map<string, FeedbackRetryEntry>());
  const [note, setNote] = useState("");
  const [renderedNoteRevision, setRenderedNoteRevision] = useState(0);
  const [pendingView, setPendingView] = useState<{ action: string; kind: "submit" | "review"; reviewKey: string } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const reviewKey = JSON.stringify([canReview, currentFeedbackId || null, currentLabel || null]);
  const controls = {};
  const latest = useRef({ controls, reviewKey });
  const owner = useRef({ active: true, operation: 0, busy: false, kind: null as "submit" | "review" | null, reviewKey, noteRevision: 0, reviewNoteRevision: 0 });
  useLayoutEffect(() => {
    const lifetime = owner.current;
    if (!lifetime.active) setPendingView(null);
    lifetime.active = true;
    return () => { lifetime.active = false; lifetime.operation += 1; lifetime.busy = false; lifetime.kind = null; };
  }, []);
  useLayoutEffect(() => {
    if (owner.current.kind === "review" && owner.current.reviewKey !== reviewKey) setPendingView(null);
  }, [reviewKey]);
  useLayoutEffect(() => {
    const lifetime = owner.current;
    if (lifetime.kind === "review" && lifetime.reviewKey !== reviewKey) { lifetime.operation += 1; lifetime.busy = false; lifetime.kind = null; }
    lifetime.reviewKey = reviewKey;
    latest.current = { controls, reviewKey };
  });
  const busy = pendingView && (pendingView.kind !== "review" || pendingView.reviewKey === reviewKey) ? pendingView.action : null;
  const ownsControls = () => owner.current.active && latest.current.controls === controls && owner.current.noteRevision === renderedNoteRevision;

  function retryEntry(action: string) {
    const existing = pendingKeys.current.get(action);
    const noteRevision = action.startsWith("review:") ? owner.current.reviewNoteRevision : owner.current.noteRevision;
    if (existing?.noteRevision === noteRevision) return existing;
    if (action.startsWith("review:")) for (const key of pendingKeys.current.keys()) if (key.startsWith("review:") && key !== action) pendingKeys.current.delete(key);
    const entry = { key: `${action}:${crypto.randomUUID()}`, noteRevision };
    if (!existing) while (pendingKeys.current.size >= 7) {
      const oldest = pendingKeys.current.keys().next().value;
      if (oldest === undefined) break;
      pendingKeys.current.delete(oldest);
    }
    pendingKeys.current.set(action, entry);
    return entry;
  }
  function beginRequest(action: string, kind: "submit" | "review") {
    if (!ownsControls() || owner.current.busy) return null;
    const lifetime = owner.current;
    const operation = ++lifetime.operation;
    lifetime.busy = true;
    lifetime.kind = kind;
    setPendingView({ action, kind, reviewKey });
    return { isCurrent: () => lifetime.active && lifetime.operation === operation && (kind !== "review" || lifetime.reviewKey === reviewKey) };
  }
  function complete(result: { message?: string } | null, action: string, entry: FeedbackRetryEntry, fallback: string, isCurrent: () => boolean) {
    if (!isCurrent()) return;
    const savedMessage = (result as { message?: string }).message || fallback;
    if (!isCurrent()) return;
    if (pendingKeys.current.get(action) === entry) pendingKeys.current.delete(action);
    if (!isCurrent()) return;
    const changed = (action.startsWith("review:") ? owner.current.reviewNoteRevision : owner.current.noteRevision) !== entry.noteRevision;
    setMessage(changed ? `${savedMessage} ההערה החדשה טרם נשלחה.` : savedMessage);
    if (!isCurrent() || changed) return;
    router.refresh();
  }
  function updateNote(next: string) {
    if (!ownsControls()) return;
    if (next.trim() !== note.trim()) {
      owner.current.noteRevision += 1;
      for (const action of pendingKeys.current.keys()) if (!action.startsWith("review:")) pendingKeys.current.delete(action);
      if ((next.trim() || "אושר בביקורת אנושית") !== (note.trim() || "אושר בביקורת אנושית")) {
        owner.current.reviewNoteRevision += 1;
        for (const action of pendingKeys.current.keys()) if (action.startsWith("review:")) pendingKeys.current.delete(action);
      }
      setRenderedNoteRevision(owner.current.noteRevision);
    }
    setNote(next);
  }

  async function submit(label: DigitalObserverFeedbackLabel) {
    if (!ownsControls()) return;
    const actionKey = `submit:${label}`;
    const request = beginRequest(actionKey, "submit");
    if (!request) return;
    const submitted = { incidentId, label, note: note.trim() || undefined };
    setMessage("");
    setError("");
    try {
      const entry = retryEntry(actionKey);
      const result = await postFeedback({
        action: "submit",
        incident_id: submitted.incidentId,
        target_type: "INCIDENT",
        label: submitted.label,
        note: submitted.note,
        idempotency_key: entry.key
      }, request.isCurrent);
      complete(result, actionKey, entry, "המשוב נשמר.", request.isCurrent);
    } catch (cause) {
      if (!request.isCurrent()) return;
      setError(cause instanceof Error ? cause.message : "לא ניתן לשמור את המשוב");
    } finally {
      if (request.isCurrent()) { owner.current.busy = false; owner.current.kind = null; setPendingView(null); }
    }
  }

  async function approveGroundTruth() {
    if (!ownsControls() || !canReview || !currentFeedbackId || !currentLabel || latest.current.reviewKey !== reviewKey) return;
    const actionKey = `review:${currentFeedbackId}:${currentLabel}`;
    const request = beginRequest(actionKey, "review");
    if (!request) return;
    const submitted = { feedbackId: currentFeedbackId, label: currentLabel, note: note.trim() || "אושר בביקורת אנושית" };
    setMessage("");
    setError("");
    try {
      const entry = retryEntry(actionKey);
      const result = await postFeedback({
        action: "review",
        feedback_id: submitted.feedbackId,
        label: submitted.label,
        note: submitted.note,
        idempotency_key: entry.key
      }, request.isCurrent);
      complete(result, actionKey, entry, "התיוג אושר כ‑Ground Truth.", request.isCurrent);
    } catch (cause) {
      if (!request.isCurrent()) return;
      setError(cause instanceof Error ? cause.message : "לא ניתן להשלים את הביקורת");
    } finally {
      if (request.isCurrent()) { owner.current.busy = false; owner.current.kind = null; setPendingView(null); }
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
    <label className="do-field wide"><span>הערה אופציונלית</span><textarea value={note} onChange={(event) => { if (ownsControls()) updateNote(event.target.value); }} maxLength={500} rows={3} placeholder="מידע קצר שיעזור לבדיקה, ללא פרטי גישה או סודות" /></label>
    <div className="do-notice info"><ShieldCheck /><span><strong>למידה מבוקרת בלבד</strong><small>המשוב נשמר לניתוח וכיול. הוא אינו משנה מיד מודל, סף, Risk, כלל או קו בסיס.</small></span></div>
    {canReview && currentFeedbackId ? <div className="do-button-row"><button className="do-button primary" type="button" disabled={Boolean(busy)} onClick={() => void approveGroundTruth()}>{busy?.startsWith("review:") ? <LoaderCircle className="do-spin" /> : <ClipboardCheck />} אישור כ‑Ground Truth</button></div> : null}
    {message ? <div className="do-notice info" role="status"><Check /><span>{message}</span></div> : null}
    {error ? <div className="do-notice warn" role="alert"><span>{error}</span></div> : null}
  </article>;
}
