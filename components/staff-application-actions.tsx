"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StaffApplicationActions({ openingId, applicationId, status }: { openingId: string; applicationId?: string | null; status?: string | null }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function act(action: "apply" | "accept" | "withdraw" | "respond") {
    setBusy(true); setMessage("");
    const responseText = action === "respond" ? window.prompt("כתבו את המידע שהתבקש")?.trim() : undefined;
    if (action === "respond" && !responseText) { setBusy(false); return; }
    const endpoint = action === "apply" ? "/api/staff/job-applications" : `/api/staff/job-applications/${applicationId}`;
    const payload = action === "apply" ? { opening_id: openingId, idempotency_key: `candidate-opening:${openingId}` } : { action, response: responseText };
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setMessage(body.error ?? "הפעולה נכשלה."); return; }
    setMessage("הפעולה הושלמה."); router.refresh();
  }
  if (!applicationId) return <span><button className="button primary tiny" disabled={busy} onClick={() => act("apply")} type="button">הגשת מועמדות</button>{message ? <small className="error-text">{message}</small> : null}</span>;
  if (status === "information_required") return <span><button className="button secondary tiny" disabled={busy} onClick={() => act("respond")} type="button">שליחת מידע נוסף</button>{message ? <small>{message}</small> : null}</span>;
  if (status === "awaiting_candidate_acceptance") return <span><button className="button primary tiny" disabled={busy} onClick={() => act("accept")} type="button">קבלת ההצעה והפעלת העסקה</button><button className="button secondary tiny" disabled={busy} onClick={() => act("withdraw")} type="button">דחייה</button>{message ? <small className="error-text">{message}</small> : null}</span>;
  return <small className="gateway-setup-state">מועמדות: {status}</small>;
}
