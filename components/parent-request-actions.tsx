"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageSquareReply } from "lucide-react";

export function ParentRequestActions({ childId, requestId }: { childId: string; requestId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [completed, setCompleted] = useState(false);
  const [pending, startTransition] = useTransition();

  function update(status: "viewed" | "in_progress" | "handled" | "rejected") {
    setMessage("");
    startTransition(async () => {
      const result = await fetch(`/api/garden/children/${childId}/operations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "parent_request_status", request_id: requestId, status, manager_response: response || undefined })
      });
      const body = await result.json().catch(() => null);
      if (result.ok) {
        setMessage("בקשת ההורה עודכנה.");
        if (["handled", "rejected"].includes(status)) setCompleted(true);
        router.refresh();
      } else {
        setMessage(body?.error || "לא ניתן לעדכן את הבקשה כרגע. בדקו שהבקשה עדיין משויכת לגן.");
      }
    });
  }

  if (completed) {
    return <div className="success-banner compact">{message || "בקשת ההורה עודכנה."}</div>;
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
