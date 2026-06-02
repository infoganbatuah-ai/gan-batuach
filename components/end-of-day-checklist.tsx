"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, LockKeyhole } from "lucide-react";

type ChecklistItem = {
  label: string;
  ok: boolean;
  count?: number;
};

export function EndOfDayChecklist({ items }: { items: ChecklistItem[] }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const ready = items.every((item) => item.ok);

  function closeDay() {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/garden/day-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: items })
      });
      const body = await response.json().catch(() => ({}));
      setMessage(response.ok ? "היום נסגר ונשמר לוג תפעולי." : body.error || "לא ניתן לסגור את היום כרגע.");
    });
  }

  return (
    <section className="end-day-checklist">
      <div>
        <p className="eyebrow">לפני סיום היום</p>
        <h2>סגירת יום</h2>
        <p>בדיקה מהירה לפני שהצוות מסיים: עדכונים, פניות, איסוף ואירועים.</p>
      </div>
      <div className="end-day-items">
        {items.map((item) => (
          <span className={item.ok ? "end-day-item good" : "end-day-item warn"} key={item.label}>
            <CheckCircle2 size={15} />
            {item.label}
            {item.count !== undefined ? <b>{item.count}</b> : null}
          </span>
        ))}
      </div>
      <button className="button primary large" type="button" disabled={pending} onClick={closeDay}>
        <LockKeyhole size={16} />
        {ready ? "סגור יום" : "סגור יום עם חריגים"}
      </button>
      {message ? <small className={message.includes("נשמר") ? "payment-action-message" : "error-text"}>{message}</small> : null}
    </section>
  );
}
