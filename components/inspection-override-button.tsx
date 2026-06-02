"use client";

import { useState } from "react";

export function InspectionOverrideButton({ inspectionId }: { inspectionId: string }) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function override() {
    setMessage(null); setError(null);
    if (!reason.trim()) { setError("חובה להזין סיבה"); return; }
    const response = await fetch(`/api/inspections/${inspectionId}/override`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, notes }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error || "הפעולה נכשלה"); return; }
    setMessage("הביקורת סומנה כהושלמה ידנית ונרשמה בלוג ביקורת.");
  }

  return <div className="override-box">{message ? <div className="success-banner">{message}</div> : null}{error ? <div className="error-banner">{error}</div> : null}<input placeholder="סיבת override" value={reason} onChange={(event) => setReason(event.target.value)} /><input placeholder="הערות" value={notes} onChange={(event) => setNotes(event.target.value)} /><button className="button secondary" onClick={override}>סימון ידני כהושלם</button></div>;
}
