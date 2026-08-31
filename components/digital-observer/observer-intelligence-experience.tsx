"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

async function postJson(path: string, body: unknown) {
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
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "הפעולה נכשלה");
  return payload.data;
}

type ConversationMessage = {
  id: string;
  role: "user" | "observer";
  text: string;
  source?: string;
  actionState?: string;
  links?: { label: string; href: string }[];
  actionOffer?: {
    available: boolean;
    reason?: string;
    action_type?: string;
    label?: string;
    parameters?: Record<string, string | number | boolean>;
    camera_source_id?: string;
  } | null;
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
  const [actionBusy, setActionBusy] = useState(false);

  async function approveAction(offer: NonNullable<ConversationMessage["actionOffer"]>) {
    if (!offer.available || !offer.action_type || !offer.camera_source_id || !cameraName) return;
    setActionBusy(true);
    setError("");
    try {
      const prepared = await postJson("/api/digital-observer/camera-actions", {
        action: "request",
        observer_site_id: siteId,
        camera_source_id: offer.camera_source_id,
        action_type: offer.action_type,
        request_origin: "observer_chat",
        parameters: offer.parameters ?? {}
      });
      if (!window.confirm(`לאשר עכשיו ${offer.label || "את הפעולה"} במצלמה ${cameraName}?`)) {
        await postJson("/api/digital-observer/camera-actions", { action: "cancel", request_id: prepared.request.id });
        return;
      }
      const approved = await postJson("/api/digital-observer/camera-actions", { action: "confirm", request_id: prepared.request.id, confirmation: true });
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "observer", text: approved.message, source: "אישור פעולה מתועד" }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "לא ניתן לאשר את הפעולה");
    } finally {
      setActionBusy(false);
    }
  }

  async function ask(value: string) {
    const message = value.trim();
    if (message.length < 2 || busy) return;
    const userMessage: ConversationMessage = { id: crypto.randomUUID(), role: "user", text: message };
    setMessages((current) => [...current, userMessage]);
    setText("");
    setError("");
    setBusy(true);
    try {
      const data = await postJson("/api/digital-observer/conversation", {
        observer_site_id: siteId,
        camera_source_id: cameraSourceId,
        message
      });
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "observer",
        text: data.answer,
        source: data.live_ai_used ? "AI מקומי מאומת" : (data.source_label || "אירועים מאומתים וסטטוס חיבור"),
        actionState: ({ saved: "הנחיה נשמרה, טרם הופעלה", executed: "המידע השמור נקרא", awaiting_confirmation: "ממתין לאישור פעולה", blocked: "חסרים תנאים להפעלה", needs_clarification: "נדרש פירוט" } as Record<string, string>)[data.action_result?.state],
        links: data.links,
        actionOffer: data.suggested_camera_action
      }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "לא ניתן לקבל תשובה כרגע");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
            <div><p>{message.text}</p>{message.actionState ? <small role="status">{message.actionState}</small> : null}{message.source ? <small>מקור: {message.source}</small> : null}{message.links?.length ? <nav aria-label="מסכים וראיות הקשורים לתשובה" className="do-conversation-context-links">{message.links.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}</nav> : null}{message.actionOffer ? message.actionOffer.available ? <button className="do-button primary" type="button" disabled={actionBusy} onClick={() => void approveAction(message.actionOffer!)}>{actionBusy ? <LoaderCircle className="do-spin" /> : <ShieldCheck />} {message.actionOffer.label} באישור</button> : <small>{message.actionOffer.reason}</small> : null}</div>
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
        <b className="do-badge info">{ruleSummary ? "הנחיה שמורה" : "מוכן להגדרה"}</b>
      </div>
      <div className="do-conversation-suggestions">
        {suggestions.map((suggestion) => <button type="button" onClick={() => void ask(suggestion)} disabled={busy} key={suggestion}>{suggestion}</button>)}
      </div>
      <form className="do-conversation-composer" onSubmit={submit}>
        <label><MessageCircle /><input value={text} onChange={(event) => setText(event.target.value)} placeholder="למשל: מה קרה בחניה מאז הבוקר?" aria-label="שאלה לתצפיתן" /></label>
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
  const [accessClass, setAccessClass] = useState<"household_resident" | "authorized_visitor">("authorized_visitor");
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
        access_class: accessClass,
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
            <fieldset className="do-field"><legend>סוג הרשאת כניסה</legend><div className="do-segmented-control"><button className={accessClass === "household_resident" ? "active" : ""} type="button" onClick={() => setAccessClass("household_resident")}>דייר/ת הבית</button><button className={accessClass === "authorized_visitor" ? "active" : ""} type="button" onClick={() => setAccessClass("authorized_visitor")}>מאושר/ת כניסה</button></div></fieldset>
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
