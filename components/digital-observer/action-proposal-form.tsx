"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";

type ProposalResult = {
  intent: { id: string; intent_status: string; action_type: string; human_confirmation_required: boolean; lawful_use_approval_required: boolean };
  proposal: { actionType: string; parameters: Record<string, unknown>; explanation: string; executionAuthorized: false };
  executed: false;
};

async function postJson(path: string, body: unknown) {
  const token = readObserverAccessToken();
  const response = await fetch(path, { method: "POST", credentials: "same-origin", headers: {
    "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {})
  }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "הפעולה נכשלה");
  return payload.data;
}

export function ActionProposalForm({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<ProposalResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage(""); setProposal(null);
    try {
      const result = await postJson("/api/digital-observer/action-intents", {
        kind: "natural_language_proposal", observer_site_id: siteId, instruction, request_id: crypto.randomUUID()
      });
      setProposal(result);
      setMessage("נוצרה הצעה מובנית בלבד. טרם בוצעה פעולה.");
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "לא ניתן להכין הצעה"); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!proposal) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await postJson(`/api/digital-observer/action-intents/${proposal.intent.id}`, { action: "confirm", confirmation_text: "CONFIRM" });
      setMessage(result.message || "הכוונה אושרה. ההרשאות והיכולת ייבדקו שוב לפני ביצוע.");
      setProposal((current) => current ? { ...current, intent: { ...current.intent, intent_status: result.intent.intent_status } } : current);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "האישור נדחה"); }
    finally { setBusy(false); }
  }

  return <article className="do-panel do-form-section">
    <div className="do-section-head"><div><h2>הצעת פעולה בשפה טבעית</h2><p>הטקסט מומר להצעה מובנית בלבד. הרשאה, מדיניות ואישור אנושי אינם נעקפים.</p></div><Sparkles /></div>
    <form onSubmit={propose} className="do-form-grid">
      <label className="do-field full"><span>מה ברצונכם להציע?</span><textarea rows={3} required minLength={1} maxLength={500} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="למשל: שלח התראה למפעיל או הצע להזיז את המצלמה שמאלה" /></label>
      <button className="do-button secondary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="do-spin" /> : <Sparkles />} הכנת הצעה</button>
    </form>
    {proposal ? <div className="do-notice info"><ShieldCheck /><span><strong>{proposal.proposal.actionType}</strong> · {proposal.proposal.explanation}<br />מצב: {proposal.intent.intent_status} · בוצע בפועל: לא</span></div> : null}
    {proposal?.intent.human_confirmation_required && proposal.intent.intent_status === "awaiting_confirmation" ? <button className="do-button primary" type="button" disabled={busy} onClick={confirm}><Check /> אישור אנושי מפורש</button> : null}
    {proposal?.intent.lawful_use_approval_required ? <div className="do-notice warn"><AlertTriangle /><span>פעולה רגישה זו חסומה גם לאחר לחיצה עד לקיום אישור שימוש חוקי מתועד. אין הפעלה אוטומטית.</span></div> : null}
    {message ? <div className="do-action-result success"><Check /> {message}</div> : null}
    {error ? <div className="do-action-result error" role="alert"><AlertTriangle /> {error}</div> : null}
  </article>;
}
