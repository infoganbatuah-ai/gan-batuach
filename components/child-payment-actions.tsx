"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";

export function ChildPaymentActions({ childId, amount }: { childId: string; amount: number }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function update(action: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/garden/child-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ child_id: childId, action, amount })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "העדכון נכשל");
      setMessage("סטטוס התשלום עודכן ונרשם בהיסטוריה.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "העדכון נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="payment-action-stack">
      <div className="profile-actions">
        <button className="button secondary tiny" disabled={busy} type="button" onClick={() => update("mark_paid")}><CreditCard size={14} /> שולם</button>
        <button className="button secondary tiny" disabled={busy} type="button" onClick={() => update("mark_unpaid")}>לא שולם</button>
        <button className="button secondary tiny" disabled={busy} type="button" onClick={() => update("partial_payment")}>חלקי</button>
        <button className="button secondary tiny" disabled={busy} type="button" onClick={() => update("discount")}>הנחה</button>
        <button className="button tiny" disabled={busy} type="button" onClick={() => update("special_arrangement")}>הסדר מיוחד</button>
      </div>
      {message ? <small className="payment-action-message">{message}</small> : null}
    </div>
  );
}
