"use client";

import { useState } from "react";

export function DocumentReviewActions({ id }: { id: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function review(status: "valid" | "rejected") {
    setBusy(true);
    setMessage(null);
    try {
      const notes = status === "rejected" ? window.prompt("סיבת דחייה") ?? "" : undefined;
      if (status === "rejected" && !notes) return;
      const response = await fetch(`/api/documents/${id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, notes }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "הפעולה נכשלה");
      setMessage(status === "rejected" ? "המסמך נדחה ונשמר לוג." : "המסמך אושר ונשמר לוג.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן להשלים את הפעולה כרגע");
    } finally {
      setBusy(false);
    }
  }

  return <div className="review-actions"><button className="button secondary tiny" type="button" disabled={busy} onClick={() => review("valid")}>אישור</button><button className="button tiny" type="button" disabled={busy} onClick={() => review("rejected")}>דחייה</button>{message ? <small>{message}</small> : null}</div>;
}
