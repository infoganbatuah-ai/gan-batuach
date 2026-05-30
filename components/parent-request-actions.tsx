"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, MessageSquareReply } from "lucide-react";

export function ParentRequestActions({ childId, requestId }: { childId: string; requestId: string }) {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [pending, startTransition] = useTransition();

  function update(status: "viewed" | "in_progress" | "handled" | "rejected") {
    setMessage("");
    startTransition(async () => {
      const result = await fetch(`/api/garden/children/${childId}/operations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "parent_request_status", request_id: requestId, status, manager_response: response || undefined })
      });
      setMessage(result.ok ? "בקשת ההורה עודכנה." : "לא ניתן לעדכן את הבקשה כרגע.");
      if (result.ok) window.setTimeout(() => window.location.reload(), 700);
    });
  }

  return (
    <div className="parent-request-actions">
      <input value={response} onChange={(event) => setResponse(event.target.value)} placeholder="תגובה למעקב / להורה" />
      <div className="profile-actions">
        <button className="button secondary tiny" disabled={pending} type="button" onClick={() => update("viewed")}><MessageSquareReply size={14} /> נצפה</button>
        <button className="button secondary tiny" disabled={pending} type="button" onClick={() => update("in_progress")}>בטיפול</button>
        <button className="button secondary tiny" disabled={pending} type="button" onClick={() => update("handled")}><CheckCircle2 size={14} /> טופל</button>
        <button className="button tiny" disabled={pending} type="button" onClick={() => update("rejected")}>נדחה</button>
      </div>
      {message ? <small className="payment-action-message">{message}</small> : null}
    </div>
  );
}
