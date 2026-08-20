"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Mail, Send, UserPlus } from "lucide-react";

export function ManagerParentInvitationPanel({ gardenId }: { gardenId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setMessage("");
    setSuccess(false);
    try {
      const response = await fetch("/api/garden/parent-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: String(data.get("full_name") ?? "").trim(),
          email: String(data.get("email") ?? "").trim(),
          phone: String(data.get("phone") ?? "").trim(),
          child_name: String(data.get("child_name") ?? "").trim()
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן לשלוח את ההזמנה כרגע");
      setSuccess(true);
      setMessage(body.data?.already_pending
        ? "כבר קיימת הזמנה פתוחה להורה הזה. לא נוצר שיוך כפול."
        : body.data?.account_created
          ? "נוצר חשבון בדיקה/הזמנה. ההורה חייב להתחבר, ליצור או לבחור ילד ולאשר לפני שיוך. משלוח חיצוני נשאר במצב בדיקה עד חיבור ספק."
          : "ההזמנה נשלחה לחשבון ההורה הקיים. השיוך ייווצר רק לאחר אישור ההורה ובחירת ילד.");
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן לשלוח את ההזמנה כרגע");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="manager-parent-invitation-panel" data-garden-id={gardenId}>
      <div className="manager-invite-summary">
        <span><UserPlus /></span>
        <div><h3>הזמנת הורה</h3><p>עובד גם להורה שכבר רשום וגם להורה חדש. אין שיוך אוטומטי לפני אישור ההורה.</p></div>
      </div>
      <form onSubmit={submit}>
        <label>שם ההורה<input name="full_name" required minLength={2} placeholder="שם פרטי ומשפחה" /></label>
        <label>אימייל<input name="email" type="email" required placeholder="parent@example.com" /></label>
        <label>טלפון<input name="phone" inputMode="tel" placeholder="05X-XXXXXXX" /></label>
        <label>שם הילד/ה לצורך זיהוי<input name="child_name" placeholder="אופציונלי — ההורה יבחר כרטיס ילד" /></label>
        <button className="button primary" disabled={busy} type="submit"><Send size={18} /> {busy ? "שולחים..." : "שליחת הזמנה"}</button>
      </form>
      <div className="manager-invite-channel-state"><Mail size={18} /><span>הודעת מערכת: פעילה · אימייל/SMS/WhatsApp: בדיקה או ידני בלבד עד חיבור ספק מאושר</span></div>
      {message ? <p className={success ? "success-banner" : "error-banner"}>{success ? <CheckCircle2 size={18} /> : null}{message}</p> : null}
    </section>
  );
}
