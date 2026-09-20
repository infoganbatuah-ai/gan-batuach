"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Mail, Send, UserPlus } from "lucide-react";

export function ManagerParentInvitationPanel({ gardenId }: { gardenId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const fieldsRef = useRef<HTMLDivElement>(null);

  async function submit() {
    const fields = fieldsRef.current;
    if (!fields) return;
    const input = (name: string) => fields.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    const fullName = input("invite_full_name")?.value.trim() ?? "";
    const email = input("invite_email")?.value.trim() ?? "";
    if (fullName.length < 2 || !email || !input("invite_email")?.checkValidity()) {
      setMessage("יש להזין שם הורה ואימייל תקין לפני שליחת ההזמנה.");
      setSuccess(false);
      return;
    }
    setBusy(true);
    setMessage("");
    setSuccess(false);
    try {
      const response = await fetch("/api/garden/parent-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone: input("invite_phone")?.value.trim() ?? "",
          child_name: input("invite_child_name")?.value.trim() ?? ""
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
      fields.querySelectorAll("input").forEach((field) => { field.value = ""; });
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
      <div className="manager-parent-invitation-fields" ref={fieldsRef} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); } }}>
        <label>שם ההורה<input name="invite_full_name" aria-required="true" minLength={2} placeholder="שם פרטי ומשפחה" /></label>
        <label>אימייל<input name="invite_email" aria-required="true" type="email" placeholder="parent@example.com" /></label>
        <label>טלפון<input name="invite_phone" inputMode="tel" placeholder="05X-XXXXXXX" /></label>
        <label>שם הילד/ה לצורך זיהוי<input name="invite_child_name" placeholder="אופציונלי — ההורה יבחר כרטיס ילד" /></label>
        <button className="button primary" disabled={busy} type="button" onClick={() => void submit()}><Send size={18} /> {busy ? "שולחים..." : "שליחת הזמנה"}</button>
      </div>
      <div className="manager-invite-channel-state"><Mail size={18} /><span>הודעת מערכת: פעילה · אימייל/SMS/WhatsApp: בדיקה או ידני בלבד עד חיבור ספק מאושר</span></div>
      {message ? <p className={success ? "success-banner" : "error-banner"}>{success ? <CheckCircle2 size={18} /> : null}{message}</p> : null}
    </section>
  );
}
