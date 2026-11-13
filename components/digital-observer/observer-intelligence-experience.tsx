"use client";

import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  CircleHelp,
  LoaderCircle,
  MessageCircle,
  Radar,
  Send,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  UserRoundX
} from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";

async function postJson(path: string, body: unknown, isCurrent: () => boolean = () => true) {
  if (!isCurrent()) return;
  const accessToken = readObserverAccessToken();
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify(body)
  });
  if (!isCurrent()) return;
  const payload = await response.json().catch(() => ({}));
  if (!isCurrent()) return;
  if (!response.ok) throw new Error(payload.error || "הפעולה נכשלה");
  return payload.data;
}

type ConversationMessage = {
  id: string;
  role: "user" | "observer";
  text: string;
  source?: string;
};

export function ObserverConversationPanel({
  siteId,
  cameraSourceId,
  cameraName,
  initialPrompt,
  ruleSummary
}: {
  siteId: string;
  cameraSourceId?: string;
  cameraName?: string;
  initialPrompt?: string;
  ruleSummary?: {
    title: string;
    description?: string | null;
    active: boolean;
  } | null;
}) {
  return <ScopedObserverConversationPanel key={JSON.stringify([siteId, cameraSourceId ?? null])} siteId={siteId} cameraSourceId={cameraSourceId} cameraName={cameraName} initialPrompt={initialPrompt} ruleSummary={ruleSummary} />;
}

function ScopedObserverConversationPanel({ siteId, cameraSourceId, cameraName, initialPrompt, ruleSummary }: Parameters<typeof ObserverConversationPanel>[0]) {
  const [messages, setMessages] = useState<ConversationMessage[]>([
    {
      id: "welcome",
      role: "observer",
      text: initialPrompt || "אפשר לשאול מה קרה, מי נכנס, האם היה משהו חריג או לבקש ממני לשים לב למשהו מסוים.",
      source: "פתיחה"
    }
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draftRevision, setDraftRevision] = useState(0);
  const [lifecycle, setLifecycle] = useState(0);
  const ownership = useRef({ active: false, operation: 0, busy: false, draft: 0, lifecycle: 0, resetBusy: false });
  useLayoutEffect(() => {
    const owner = ownership.current;
    owner.active = true;
    if (owner.lifecycle > 0) setLifecycle(owner.lifecycle);
    if (owner.resetBusy) { owner.resetBusy = false; setBusy(false); }
    return () => {
      owner.resetBusy = owner.busy;
      owner.active = false; owner.operation++; owner.lifecycle++; owner.busy = false;
    };
  }, []);

  async function ask(value: string) {
    const owner = ownership.current;
    if (!owner.active || owner.lifecycle !== lifecycle || owner.busy) return;
    const message = value.trim();
    if (message.length < 2) return;
    owner.busy = true;
    const operation = ++owner.operation;
    const isCurrent = () => owner.active && owner.operation === operation;
    setBusy(true);
    setError("");
    try {
      const userMessage: ConversationMessage = { id: crypto.randomUUID(), role: "user", text: message };
      setMessages((current) => [...current, userMessage]);
      owner.draft++;
      setDraftRevision(owner.draft);
      setText("");
      const data = await postJson("/api/digital-observer/conversation", {
        observer_site_id: siteId,
        camera_source_id: cameraSourceId,
        message
      }, isCurrent);
      if (!isCurrent()) return;
      if (!data || typeof data !== "object" || typeof data.answer !== "string" || !data.answer.trim()) throw new Error("לא ניתן לקבל תשובה כרגע");
      const reply: ConversationMessage = {
        id: crypto.randomUUID(),
        role: "observer",
        text: data.answer,
        source: data.live_ai_used ? "AI חי" : "המידע השמור באתר"
      };
      setMessages((current) => [...current, reply]);
    } catch (requestError) {
      if (!isCurrent()) return;
      setError(requestError instanceof Error ? requestError.message : "לא ניתן לקבל תשובה כרגע");
    } finally {
      if (isCurrent()) { owner.busy = false; setBusy(false); }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    const owner = ownership.current;
    if (!owner.active || owner.lifecycle !== lifecycle) return;
    event.preventDefault();
    if (owner.busy || owner.draft !== draftRevision) return;
    void ask(text);
  }

  const suggestions = cameraName
    ? ["מה קרה כאן היום?", "האם הייתה תנועה חריגה?", "מי נכנס או יצא?", "שים לב לכל שינוי במצלמה"]
    : ["מה קרה היום?", "מי נכנס או יצא?", "האם היה משהו חריג?", "שים לב לאדם ליד הרכב"];

  return (
    <section className="do-panel do-conversation-panel">
      <div className="do-conversation-head">
        <span className="do-observer-presence"><BrainCircuit /><i /></span>
        <div><h2>{cameraName ? `שיחה על ${cameraName}` : "שיחה עם התצפיתן"}</h2><p>{cameraName ? "התשובות וההנחיות מוגבלות למצלמה הזאת" : "שאלות ותובנות מהמידע של האתר שלכם בלבד"}</p></div>
        <span className="do-badge info">ביקורת אנושית</span>
      </div>
      <div className="do-conversation-messages" aria-live="polite">
        {messages.map((message) => (
          <article className={`do-chat-message ${message.role}`} key={message.id}>
            {message.role === "observer" ? <Sparkles /> : null}
            <div><p>{message.text}</p>{message.source ? <small>מקור: {message.source}</small> : null}</div>
          </article>
        ))}
        {busy ? <article className="do-chat-message observer is-typing"><LoaderCircle className="do-spin" /><div><p>בודק את האירועים, המצלמות ודפוסי השגרה...</p></div></article> : null}
      </div>
      <div className="do-conversation-rule-state">
        <Radar />
        <span>
          <small>{ruleSummary ? "כלל תצפית מהאתר" : "כלל תצפית"}</small>
          <strong>{ruleSummary?.title || "עדיין לא הוגדר כלל תצפית"}</strong>
          <p>{ruleSummary?.description || "אפשר לכתוב לתצפיתן מה חשוב לבדוק והוא יכין כלל לאישור."}</p>
        </span>
        <b className={ruleSummary?.active ? "do-badge good" : "do-badge warn"}>{ruleSummary?.active ? "פעיל" : "מוכן להגדרה"}</b>
      </div>
      <div className="do-conversation-suggestions">
        {suggestions.map((suggestion) => <button type="button" onClick={() => void ask(suggestion)} disabled={busy} key={suggestion}>{suggestion}</button>)}
      </div>
      <form className="do-conversation-composer" onSubmit={submit}>
        <label><MessageCircle /><input value={text} onChange={(event) => {
          const owner = ownership.current;
          if (!owner.active || owner.lifecycle !== lifecycle || owner.draft !== draftRevision) return;
          const value = event.target.value;
          owner.draft++; setDraftRevision(owner.draft); setText(value);
        }} placeholder="למשל: מה קרה בחניה מאז הבוקר?" aria-label="שאלה לתצפיתן" /></label>
        <button type="submit" disabled={busy || text.trim().length < 2} aria-label="שליחת שאלה"><Send /></button>
      </form>
      {error ? <div className="do-action-result error" role="alert"><AlertTriangle /> {error}</div> : null}
      <p className="do-conversation-safety"><ShieldCheck /> אין חיוג חירום או פעולה אוטומטית מתוך השיחה. אירוע חריג תמיד מועבר לאישור אנושי.</p>
    </section>
  );
}

export function ObserverIdentityCandidateReview({
  candidate,
  cameraName
}: {
  candidate: any;
  cameraName?: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const ready = candidate.candidate_status === "ready_for_review";

  async function review(outcome: "known" | "unknown" | "dismissed") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await postJson("/api/digital-observer/identity-candidates", {
        candidate_id: candidate.id,
        outcome,
        display_name: name,
        relationship_label: relationship,
        explicit_consent: consent
      });
      setMessage(data.message);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "לא ניתן לשמור את ההחלטה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="do-candidate-card">
      <div className="do-candidate-preview">
        {candidate.preview_available
          ? <img src={`/api/digital-observer/identity-candidates/${candidate.id}/preview`} alt="תצוגה פרטית של אדם שנצפה" />
          : <span><CircleHelp /><small>אין תמונה זמינה</small></span>}
        <b>{candidate.observation_count} הופעות</b>
      </div>
      <div className="do-candidate-body">
        <div><strong>{candidate.suggested_label || "אדם שנצפה לעיתים קרובות"}</strong><small>{cameraName || "מצלמה לא ידועה"} · ביטחון ממוצע {candidate.average_confidence == null ? "לא זמין" : `${Math.round(Number(candidate.average_confidence) * 100)}%`}</small></div>
        {!ready ? <span className="do-badge warn">אוסף עוד תצפיות</span> : expanded ? (
          <div className="do-candidate-form">
            <label><span>שם האדם</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="למשל: דניאל" /></label>
            <label><span>קשר למקום</span><input value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="בן משפחה / עובד / בעל גישה" /></label>
            <label className="do-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>קיימת הסכמה מפורשת להגדרת האדם כמוכר</span></label>
            <div className="do-button-row">
              <button className="do-button primary" type="button" onClick={() => void review("known")} disabled={busy || name.trim().length < 2 || !consent}>{busy ? <LoaderCircle className="do-spin" /> : <UserRoundCheck />} שמירה כאדם מוכר</button>
              <button className="do-button secondary" type="button" onClick={() => void review("unknown")} disabled={busy}><UserRoundX /> אדם לא מוכר</button>
            </div>
          </div>
        ) : (
          <div className="do-button-row">
            <button className="do-button primary" type="button" onClick={() => setExpanded(true)}><UserRoundCheck /> אני מכיר/ה</button>
            <button className="do-button secondary" type="button" onClick={() => void review("unknown")} disabled={busy}><UserRoundX /> לא מוכר/ת</button>
            <button className="do-icon-button" type="button" onClick={() => void review("dismissed")} disabled={busy} aria-label="הסרת מועמד"><Check /></button>
          </div>
        )}
        {message ? <div className="do-action-result success"><Check /> {message}</div> : null}
        {error ? <div className="do-action-result error"><AlertTriangle /> {error}</div> : null}
      </div>
    </article>
  );
}
