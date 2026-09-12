"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, MailCheck, Phone, ShieldCheck } from "lucide-react";

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
  const [status, setStatus] = useState<Status | null>(initialStatus);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  async function refresh() {
    try {
      setStatus(await requestJson("/api/auth/verification/status"));
    } catch {
      setStatus(null);
    }
  }

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

  async function sendPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await requestJson("/api/auth/verification/phone/request", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone })
      });
      setCodeSent(true);
      setMessage("קוד חד־פעמי נשלח למספר הטלפון.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן לשלוח קוד.");
    } finally { setBusy(false); }
  }

  async function confirmPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    setBusy(true);
    setMessage("");
    try {
      await requestJson("/api/auth/verification/phone/confirm", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, code })
      });
      setMessage("הטלפון אומת בהצלחה.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "האימות נכשל.");
    } finally { setBusy(false); }
  }

  if (status?.complete) return (
    <div className="do-page-stack">
      <div className="do-notice good"><CheckCircle2 /><span>הדוא״ל והטלפון מאומתים. אפשר להמשיך למערכת.</span></div>
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

    {status?.emailVerified && !status.phoneVerified ? <>
      <form className="do-page-stack" onSubmit={sendPhone}>
        <label className="do-field"><span>טלפון נייד ישראלי</span><input name="phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required disabled={busy} placeholder="05X-XXXXXXX" /></label>
        <button className="do-button secondary full" disabled={busy} type="submit"><Phone /> {codeSent ? "שליחת קוד נוסף" : "שליחת קוד"}</button>
      </form>
      {codeSent ? <form className="do-page-stack" onSubmit={confirmPhone}>
        <label className="do-field"><span>קוד חד־פעמי</span><input name="code" inputMode="numeric" autoComplete="one-time-code" minLength={4} maxLength={8} required disabled={busy} /></label>
        <button className="do-button primary full" disabled={busy} type="submit"><ShieldCheck /> אימות הטלפון</button>
      </form> : null}
    </> : null}

    {message ? <div className="do-notice warn" role="status"><span>{message}</span></div> : null}
    {!status ? <div className="do-notice warn"><LoaderCircle className="do-spin" /><span>יש להתחבר לאחר אימות הדוא״ל כדי להשלים אימות טלפון.</span></div> : null}
    {!status ? <Link className="do-button secondary full" href="/app/login">מעבר להתחברות</Link> : null}
  </div>;
}
