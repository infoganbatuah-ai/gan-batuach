"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, LoaderCircle, ShieldCheck } from "lucide-react";

type Summary = { garden_name: string | null; recipient: string | null; expires_at: string };

export function InvitationAcceptScreen({ token, signedIn }: { token: string; signedIn: boolean }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`/api/invitations/resolve?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setSummary(body.data); })
      .catch(error => setMessage(error instanceof Error ? error.message : "ההזמנה אינה זמינה."));
  }, [token]);

  async function claim() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/invitations/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן לקשר את ההזמנה.");
      window.location.assign(body.data.next_path);
    } catch (error) { setMessage(error instanceof Error ? error.message : "לא ניתן לקשר את ההזמנה."); setBusy(false); }
  }

  return <main className="section login-journey-page" dir="rtl"><section className="login-hero compact-auth-hero"><div><p className="eyebrow">הזמנה אישית</p><h1>הצטרפות ל{summary?.garden_name ?? "גן הילדים"}</h1><p>{summary ? `ההזמנה מיועדת ל־${summary.recipient ?? "החשבון שהוזמן"} ותקפה עד ${new Date(summary.expires_at).toLocaleString("he-IL")}.` : "בודקים את ההזמנה המאובטחת…"}</p>{message ? <p className="error-banner">{message}</p> : null}{summary && signedIn ? <button className="button primary large" onClick={() => void claim()} disabled={busy} type="button">{busy ? <LoaderCircle className="spin" /> : <ShieldCheck />} קישור לחשבון והמשך לאישור</button> : null}{summary && !signedIn ? <div className="parent-invitation-actions"><Link className="button primary" href={`/app/login?next=${encodeURIComponent(`/invite/accept?token=${token}`)}`}>יש לי חשבון</Link><Link className="button secondary" href={`/app/register/parent?invitation_token=${encodeURIComponent(token)}`}>יצירת חשבון הורה</Link></div> : null}</div><div className="card action-panel auth-readiness-card"><Building2 /><h2>לפני שנוצר שיוך</h2><p>המערכת תאמת את החשבון ואת כתובת הדוא״ל. לאחר מכן תוכלו לבחור ילד ולאשר או לדחות את ההצטרפות.</p></div></section></main>;
}
