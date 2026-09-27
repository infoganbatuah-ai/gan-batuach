"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, LoaderCircle, Send, Undo2, X } from "lucide-react";
import { recruitmentApplicationState } from "@/lib/domain/recruitment-display";

export function StaffApplicationActions({ openingId, applicationId, status }: { openingId: string; applicationId?: string | null; status?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [panel, setPanel] = useState<"respond" | "accept" | "withdraw" | null>(null);
  const [responseText, setResponseText] = useState("");
  async function act(action: "apply" | "accept" | "withdraw" | "respond") {
    if (action === "respond" && responseText.trim().length < 2) { setMessage("כתבו את המידע שהתבקש לפני השליחה."); return; }
    setBusy(true); setMessage("");
    const endpoint = action === "apply" ? "/api/staff/job-applications" : `/api/staff/job-applications/${applicationId}`;
    const payload = action === "apply" ? { opening_id: openingId, idempotency_key: `candidate-opening:${openingId}` } : { action, response: action === "respond" ? responseText.trim() : undefined };
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setMessage(body.error ?? "הפעולה נכשלה."); return; }
    if (action === "accept") { window.location.assign("/dashboard/staff"); return; }
    setMessage(action === "apply" ? "המועמדות הוגשה בהצלחה." : action === "respond" ? "ההשלמה נשלחה לבדיקה." : "המועמדות נמשכה וההיסטוריה נשמרה.");
    setPanel(null); router.refresh();
  }
  if (!applicationId) return <div className="ux08-action-stack"><button className="button primary" disabled={busy} onClick={() => void act("apply")} type="button">{busy ? <LoaderCircle className="spin" /> : <Send />} הגשת מועמדות</button>{message ? <small className="ux08-form-message danger">{message}</small> : null}</div>;
  const state = recruitmentApplicationState(status);
  if (status === "information_required") return <div className="ux08-action-stack"><button className="button primary" disabled={busy} onClick={() => setPanel("respond")} type="button"><CircleAlert /> השלמת המידע</button>{panel === "respond" ? <div className="ux08-action-panel"><button aria-label="סגירה" onClick={() => setPanel(null)} type="button"><X /></button><label>המידע שהתבקש<textarea autoFocus value={responseText} onChange={(event) => setResponseText(event.target.value)} rows={4} /></label><button className="button primary" disabled={busy} onClick={() => void act("respond")} type="button">{busy ? "שולחת..." : "שליחה לבדיקה"}</button></div> : null}{message ? <small>{message}</small> : null}</div>;
  if (status === "awaiting_candidate_acceptance") return <div className="ux08-action-stack"><button className="button primary" disabled={busy} onClick={() => setPanel("accept")} type="button"><CheckCircle2 /> קבלת ההצעה</button><button className="button secondary" disabled={busy} onClick={() => setPanel("withdraw")} type="button"><Undo2 /> דחיית ההצעה</button>{panel ? <div className={`ux08-action-panel ${panel === "withdraw" ? "danger" : "success"}`}><button aria-label="סגירה" onClick={() => setPanel(null)} type="button"><X /></button><CircleAlert /><h3>{panel === "accept" ? "לאשר ולהפעיל את ההעסקה?" : "לדחות את ההצעה?"}</h3><p>{panel === "accept" ? "השרת יאמת שוב פרופיל, מסמכים, גן, תפקיד וכיתה. רק לאחר הצלחה תיפתח גישת צוות." : "המועמדות תיסגר, אך הפרופיל וההיסטוריה יישמרו."}</p><button className={`button ${panel === "accept" ? "primary" : "danger"}`} disabled={busy} onClick={() => void act(panel === "accept" ? "accept" : "withdraw")} type="button">{busy ? "מבצעת..." : panel === "accept" ? "אישור והפעלה" : "אישור דחייה"}</button></div> : null}{message ? <small className="ux08-form-message danger">{message}</small> : null}</div>;
  if (["submitted", "under_review", "resubmitted", "approved"].includes(String(status))) return <div className="ux08-action-stack"><span className={`ux08-inline-status tone-${state.tone}`}>{state.label}</span><button className="button ghost" disabled={busy} onClick={() => setPanel("withdraw")} type="button">משיכת מועמדות</button>{panel === "withdraw" ? <div className="ux08-action-panel danger"><button aria-label="סגירה" onClick={() => setPanel(null)} type="button"><X /></button><h3>למשוך את המועמדות?</h3><p>הפעולה נשמרת בהיסטוריה ולא יוצרת העסקה.</p><button className="button danger" disabled={busy} onClick={() => void act("withdraw")} type="button">אישור משיכה</button></div> : null}{message ? <small>{message}</small> : null}</div>;
  return <span className={`ux08-inline-status tone-${state.tone}`}>{state.label}</span>;
}
