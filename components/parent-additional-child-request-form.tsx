"use client";

import { useState, useTransition } from "react";
import { Baby, Send } from "lucide-react";

export function ParentAdditionalChildRequestForm({ gardenName }: { gardenName?: string | null }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    setMessage("");
    const payload = {
      child_name: String(formData.get("child_name") ?? ""),
      child_age: String(formData.get("child_age") ?? ""),
      notes: String(formData.get("notes") ?? "")
    };

    startTransition(async () => {
      const response = await fetch("/api/parent/additional-child-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      setMessage(response.ok ? "בקשת הרישום נשלחה לגן. לאחר אישור המנהלת ייפתח כרטיס השלמת פרטים לילד החדש." : body.error ?? "לא ניתן לשלוח בקשה כרגע.");
    });
  }

  return (
    <form id="add-child-request" action={submit} className="card action-panel parent-request-form warm-request-card">
      <div className="section-heading">
        <h2><Baby size={18} /> בקשת רישום ילד נוסף</h2>
        <p>זו בקשה נפרדת ל{gardenName ?? "גן"}. היא לא פותחת טופס ריק לילד קיים, אלא עוברת לאישור המנהלת.</p>
      </div>
      {message ? <div className={message.includes("נשלחה") ? "success-banner" : "error-banner"}>{message}</div> : null}
      <label>שם הילד/ה<input name="child_name" required placeholder="לדוגמה: נועה כהן" /></label>
      <label>גיל / תאריך לידה משוער<input name="child_age" placeholder="לדוגמה: 2.5 או 12/04/2023" /></label>
      <label>הערות למנהלת<textarea name="notes" rows={3} placeholder="מה חשוב שהגן ידע לפני פתיחת כרטיס חדש?" /></label>
      <button className="button primary" disabled={pending} type="submit"><Send size={15} /> שליחת בקשה לגן</button>
    </form>
  );
}
