"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, LoaderCircle, MailOpen, ShieldCheck } from "lucide-react";

type Summary = { garden_name: string | null; recipient: string | null; expires_at: string; intended_role: string };

export function InvitationAcceptScreen({ token, signedInRole }: { token: string; signedInRole: string | null }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`/api/invitations/resolve?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setSummary(body.data); })
      .catch(error => setMessage(error instanceof Error ? error.message : "ההזמנה אינה זמינה."));
  }, [token]);

  async function claim(accept = true) {
    setBusy(true); setMessage("");
    try {
      const isGarden = summary?.intended_role === "kindergarten_owner" || summary?.intended_role === "kindergarten_manager";
      const response = await fetch(isGarden ? "/api/garden/bootstrap-invitations/accept" : summary?.intended_role === "staff" ? "/api/staff/invitations/accept" : "/api/invitations/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, accept }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן לקשר את ההזמנה.");
      window.location.assign(body.data.next_path ?? (isGarden ? "/dashboard" : "/dashboard/staff"));
    } catch (error) { setMessage(error instanceof Error ? error.message : "לא ניתן לקשר את ההזמנה."); setBusy(false); }
  }

  const roleMatches = summary?.intended_role === signedInRole || (summary?.intended_role === "kindergarten_owner" && signedInRole === "owner") || (summary?.intended_role === "kindergarten_manager" && signedInRole === "manager");
  const registerPath = summary?.intended_role === "staff" ? "/app/register/staff" : summary?.intended_role === "kindergarten_owner" ? "/app/register/kindergarten?role=owner" : summary?.intended_role === "kindergarten_manager" ? "/app/register/kindergarten" : "/app/register/parent";
  return (
    <section className="gb-invitation-card" dir="rtl">
      <div className="gb-mail-illustration small" aria-hidden="true"><MailOpen /><span><Building2 /></span></div>
      <h2>הצטרפות ל{summary?.garden_name ?? "גן הילדים"}</h2>
      <p>{summary ? `ההזמנה מיועדת ל־${summary.recipient ?? "החשבון שהוזמן"} ותקפה עד ${new Date(summary.expires_at).toLocaleString("he-IL")}.` : "בודקים את ההזמנה המאובטחת…"}</p>
      {!summary && !message ? <div className="gb-invitation-loading" role="status"><LoaderCircle className="spin" /> בודקים את ההזמנה…</div> : null}
      {message ? <p className="error-banner">{message}</p> : null}
      {summary && roleMatches ? <div className="gb-invitation-actions"><button className="button primary large" onClick={() => void claim()} disabled={busy} type="button">{busy ? <LoaderCircle className="spin" /> : <ShieldCheck />} קבלת ההזמנה והמשך</button>{(summary.intended_role === "kindergarten_owner" || summary.intended_role === "kindergarten_manager") && <button className="button secondary" onClick={() => void claim(false)} disabled={busy} type="button">דחיית ההזמנה</button>}</div> : null}
      {summary && !signedInRole ? <div className="parent-invitation-actions"><Link className="button primary large" href={`/app/login?next=${encodeURIComponent(`/invite/accept?token=${token}`)}`}>יש לי חשבון</Link><Link className="button secondary" href={`${registerPath}${registerPath.includes("?") ? "&" : "?"}invitation_token=${encodeURIComponent(token)}`}>יצירת חשבון מתאים</Link></div> : null}
      {summary && signedInRole && !roleMatches ? <p className="error-banner">ההזמנה מיועדת לתפקיד משתמש אחר.</p> : null}
      <aside className="gb-invitation-safety"><ShieldCheck /><span>גישה לגן תיפתח רק אחרי אימות החשבון והשלמת התהליך המתאים.</span></aside>
    </section>
  );
}
