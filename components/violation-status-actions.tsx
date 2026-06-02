"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const labels: Record<string, string> = {
  open: "פתוח",
  in_progress: "בטיפול",
  waiting_approval: "ממתין לאישור",
  done: "נפתר",
  overdue: "באיחור",
  rejected: "נדחה"
};

export function ViolationStatusActions({ id, initialStatus }: { id: string; initialStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function update(nextStatus: "in_progress" | "done" | "rejected") {
    setBusy(nextStatus);
    setMessage(null);
    try {
      const response = await fetch(`/api/violations/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, note: nextStatus === "done" ? "אושר על ידי פקח" : undefined })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן לעדכן את הליקוי");
      setStatus(body.data.status);
      setMessage("הסטטוס נשמר");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן לעדכן את הליקוי");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="profile-actions violation-actions">
      <span className={status === "done" ? "pill good" : status === "rejected" ? "pill bad" : "pill warn"}>{labels[status] ?? status}</span>
      <button className="button secondary tiny" disabled={!!busy || status === "in_progress"} type="button" onClick={() => update("in_progress")}>
        {busy === "in_progress" ? "שומר..." : "סמן בטיפול"}
      </button>
      <button className="button primary tiny" disabled={!!busy || status === "done"} type="button" onClick={() => update("done")}>
        {busy === "done" ? "שומר..." : "סמן נפתר"}
      </button>
      <button className="button danger tiny" disabled={!!busy || status === "rejected"} type="button" onClick={() => update("rejected")}>
        {busy === "rejected" ? "שומר..." : "דחה"}
      </button>
      {message ? <small className={message.includes("נשמר") ? "payment-action-message" : "error-text"}>{message}</small> : null}
    </div>
  );
}
