"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";

export function ResendLiveTestButton({ enabled }: { enabled: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function runTest() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/email-production/test", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      setMessage(response.ok ? "אימייל בדיקה חי נשלח לחשבון האדמין המחובר." : payload.error || "שליחת הבדיקה נכשלה");
    });
  }

  return (
    <div className="communication-test-message">
      <button className="button primary" type="button" disabled={!enabled || isPending} onClick={runTest}>
        <Send size={18} /> {isPending ? "שולח..." : "שליחת אימייל בדיקה חי"}
      </button>
      {message ? <span>{message}</span> : <span>{enabled ? "ההודעה תישלח לכתובת של האדמין המחובר." : "הכפתור ייפתח לאחר השלמת המפתח, הדומיין ודגלי ההפעלה."}</span>}
    </div>
  );
}
