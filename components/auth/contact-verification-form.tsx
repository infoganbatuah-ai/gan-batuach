"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, MailCheck } from "lucide-react";

type Status = {
  required: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  complete: boolean;
  email: string | null;
  phone: string | null;
};

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "הפעולה נכשלה");
  return body.data ?? body;
}

export function ContactVerificationForm({ initialStatus, nextPath = "/dashboard" }: { initialStatus: Status | null; nextPath?: string }) {
  const status = initialStatus;
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setBusy(true);
    setMessage("");
    try {
      await requestJson("/api/auth/verification/email/resend", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email })
      });
      setMessage("אם קיים חשבון מתאים, נשלח אליו קישור אימות חדש.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן לשלוח קישור אימות.");
    } finally { setBusy(false); }
  }

  if (status?.complete) return (
    <div className="do-page-stack">
      <div className="do-notice good"><CheckCircle2 /><span>הדוא״ל מאומת. אפשר להמשיך למערכת.</span></div>
      <Link className="do-button primary full" href={nextPath}>המשך</Link>
    </div>
  );

  return <div className="do-page-stack">
    <div className={status?.emailVerified ? "do-notice good" : "do-notice warn"}>
      {status?.emailVerified ? <CheckCircle2 /> : <MailCheck />}
      <span>{status?.emailVerified ? `הדוא״ל אומת${status.email ? ` (${status.email})` : ""}.` : "יש לאמת את הדוא״ל דרך הקישור שנשלח אליכם."}</span>
    </div>

    {!status?.emailVerified ? <form className="do-page-stack" onSubmit={sendEmail}>
      <label className="do-field"><span>דוא״ל</span><input name="email" type="email" autoComplete="email" required disabled={busy} /></label>
      <button className="do-button secondary full" disabled={busy} type="submit"><MailCheck /> שליחת קישור חדש</button>
    </form> : null}

    {message ? <div className="do-notice warn" role="status"><span>{message}</span></div> : null}
    {!status ? <div className="do-notice warn"><LoaderCircle className="do-spin" /><span>יש להתחבר לאחר אימות הדוא״ל כדי להשלים את הפעלת החשבון.</span></div> : null}
    {!status ? <Link className="do-button secondary full" href="/app/login">מעבר להתחברות</Link> : null}
  </div>;
}
