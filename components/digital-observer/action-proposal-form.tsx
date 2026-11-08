"use client";

import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";

type ProposalResult = {
  intent: { id: string; intent_status: string; action_type: string; human_confirmation_required: boolean; lawful_use_approval_required: boolean };
  proposal: { actionType: string; parameters: Record<string, unknown>; explanation: string; executionAuthorized: false };
  executed: false;
};

async function postJson(path: string, body: unknown, isCurrent: () => boolean = () => true) {
  if (!isCurrent()) return null;
  const token = readObserverAccessToken();
  const response = await fetch(path, { method: "POST", credentials: "same-origin", headers: {
    "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {})
  }, body: JSON.stringify(body) });
  if (!isCurrent()) return null;
  const payload = await response.json().catch(() => ({}));
  if (!isCurrent()) return null;
  if (!response.ok) throw new Error(payload.error || "הפעולה נכשלה");
  return payload.data;
}

export function ActionProposalForm({ siteId }: { siteId: string }) {
  return <ScopedActionProposalForm key={siteId} siteId={siteId} />;
}

type ProposalView = { proposal: ProposalResult; instruction: string; revision: number };

function ScopedActionProposalForm({ siteId }: Parameters<typeof ActionProposalForm>[0]) {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [view, setView] = useState<ProposalView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [renderedRevision, setRenderedRevision] = useState(0);
  const owner = useRef({ active: true, revision: 0, operation: 0, busy: false, resetBusy: false, view: null as ProposalView | null });
  useLayoutEffect(() => {
    const lifetime = owner.current;
    lifetime.active = true;
    if (lifetime.resetBusy) { lifetime.resetBusy = false; setBusy(false); }
    return () => { lifetime.resetBusy = lifetime.busy; lifetime.active = false; lifetime.operation += 1; lifetime.busy = false; };
  }, []);
  const proposal = view?.proposal ?? null;
  const ownsInstruction = () => owner.current.active && owner.current.revision === renderedRevision;
  const ownsProposal = () => ownsInstruction() && view !== null && owner.current.view === view && view.revision === renderedRevision && view.instruction === instruction;
  function changeInstruction(next: string) {
    if (!ownsInstruction()) return;
    const lifetime = owner.current;
    lifetime.revision += 1;
    lifetime.operation += 1;
    lifetime.busy = false;
    lifetime.resetBusy = false;
    lifetime.view = null;
    setRenderedRevision(lifetime.revision);
    setInstruction(next);
    setView(null);
    setBusy(false);
    setMessage("");
    setError("");
  }
  function beginRequest() {
    if (!ownsInstruction() || owner.current.busy) return null;
    const lifetime = owner.current;
    const operation = ++lifetime.operation;
    lifetime.busy = true;
    setBusy(true);
    return { isCurrent: () => lifetime.active && lifetime.operation === operation && lifetime.revision === renderedRevision };
  }

  async function propose(event: FormEvent<HTMLFormElement>) {
    if (!ownsInstruction()) return;
    event.preventDefault();
    const request = beginRequest();
    if (!request) return;
    const submitted = { siteId, instruction };
    owner.current.view = null;
    setError(""); setMessage(""); setView(null);
    try {
      if (!request.isCurrent()) return;
      const result = await postJson("/api/digital-observer/action-intents", {
        kind: "natural_language_proposal", observer_site_id: submitted.siteId, instruction: submitted.instruction, request_id: crypto.randomUUID()
      }, request.isCurrent);
      if (!request.isCurrent()) return;
      if (!result) throw new Error("לא ניתן להכין הצעה");
      const next = { proposal: result, instruction: submitted.instruction, revision: renderedRevision };
      owner.current.view = next;
      setView(next);
      if (!request.isCurrent()) return;
      setMessage("נוצרה הצעה מובנית בלבד. טרם בוצעה פעולה.");
      if (!request.isCurrent()) return;
      router.refresh();
    } catch (reason) { if (request.isCurrent()) setError(reason instanceof Error ? reason.message : "לא ניתן להכין הצעה"); }
    finally { if (request.isCurrent()) { owner.current.busy = false; setBusy(false); } }
  }

  async function confirm() {
    if (!ownsProposal() || owner.current.busy || !view || !proposal?.intent.human_confirmation_required || proposal.intent.intent_status !== "awaiting_confirmation") return;
    const request = beginRequest();
    if (!request) return;
    const submitted = view;
    const isCurrent = () => request.isCurrent() && owner.current.view === submitted;
    setError(""); setMessage("");
    try {
      if (!isCurrent()) return;
      const proposalId = submitted.proposal.intent.id;
      const result = await postJson(`/api/digital-observer/action-intents/${proposalId}`, { action: "confirm", confirmation_text: "CONFIRM" }, isCurrent);
      if (!isCurrent()) return;
      const nextMessage = result.message || "הכוונה אושרה. ההרשאות והיכולת ייבדקו שוב לפני ביצוע.";
      if (!isCurrent()) return;
      const nextStatus = result.intent.intent_status;
      if (!isCurrent()) return;
      const next = { ...submitted, proposal: { ...submitted.proposal, intent: { ...submitted.proposal.intent, intent_status: nextStatus } } };
      owner.current.view = next;
      setView(next);
      const ownsCompleted = () => request.isCurrent() && owner.current.view === next;
      if (!ownsCompleted()) return;
      setMessage(nextMessage);
      if (!ownsCompleted()) return;
      router.refresh();
    } catch (reason) { if (isCurrent()) setError(reason instanceof Error ? reason.message : "האישור נדחה"); }
    finally { if (request.isCurrent()) { owner.current.busy = false; setBusy(false); } }
  }

  return <article className="do-panel do-form-section">
    <div className="do-section-head"><div><h2>הצעת פעולה בשפה טבעית</h2><p>הטקסט מומר להצעה מובנית בלבד. הרשאה, מדיניות ואישור אנושי אינם נעקפים.</p></div><Sparkles /></div>
    <form onSubmit={propose} className="do-form-grid">
      <label className="do-field full"><span>מה ברצונכם להציע?</span><textarea rows={3} required minLength={1} maxLength={500} value={instruction} onChange={(event) => { if (ownsInstruction()) changeInstruction(event.target.value); }} placeholder="למשל: שלח התראה למפעיל או הצע להזיז את המצלמה שמאלה" /></label>
      <button className="do-button secondary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="do-spin" /> : <Sparkles />} הכנת הצעה</button>
    </form>
    {proposal ? <div className="do-notice info"><ShieldCheck /><span><strong>{proposal.proposal.actionType}</strong> · {proposal.proposal.explanation}<br />מצב: {proposal.intent.intent_status} · בוצע בפועל: לא</span></div> : null}
    {proposal?.intent.human_confirmation_required && proposal.intent.intent_status === "awaiting_confirmation" ? <button className="do-button primary" type="button" disabled={busy} onClick={confirm}><Check /> אישור אנושי מפורש</button> : null}
    {proposal?.intent.lawful_use_approval_required ? <div className="do-notice warn"><AlertTriangle /><span>פעולה רגישה זו חסומה גם לאחר לחיצה עד לקיום אישור שימוש חוקי מתועד. אין הפעלה אוטומטית.</span></div> : null}
    {message ? <div className="do-action-result success"><Check /> {message}</div> : null}
    {error ? <div className="do-action-result error" role="alert"><AlertTriangle /> {error}</div> : null}
  </article>;
}
