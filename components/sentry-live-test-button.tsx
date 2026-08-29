"use client";

import { useState, useTransition } from "react";
import { Bug } from "lucide-react";

export function SentryLiveTestButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function runTest() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/sentry-test", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      const eventId = payload?.data?.eventId;
      setMessage(response.ok ? `אירוע בדיקה נשלח ל-Sentry${eventId ? ` · ${eventId}` : ""}` : payload.error || "בדיקת Sentry נכשלה");
    });
  }

  return (
    <div className="communication-test-message">
      <button className="button secondary" type="button" disabled={isPending} onClick={runTest}>
        <Bug size={18} /> {isPending ? "שולח..." : "שליחת אירוע בדיקה ל-Sentry"}
      </button>
      {message ? <span>{message}</span> : <span>הבדיקה יוצרת אירוע שגיאה מבוקר ונגישת רק לאדמין.</span>}
    </div>
  );
}
