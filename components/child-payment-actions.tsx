"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { CreditCard } from "lucide-react";

type Action = "mark_paid" | "mark_unpaid" | "partial_payment" | "discount" | "special_arrangement";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function endOfCurrentMonth() {
  const now = new Date();
  return isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

const actionLabels: Record<Action, string> = {
  mark_paid: "אישור תשלום",
  mark_unpaid: "סימון לא שולם",
  partial_payment: "תשלום חלקי",
  discount: "הנחה",
  special_arrangement: "הסדר מיוחד"
};

export function ChildPaymentActions({ childId, amount }: { childId: string; amount: number }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [paymentDate, setPaymentDate] = useState(isoDate(new Date()));
  const [validFrom, setValidFrom] = useState(isoDate(new Date()));
  const [validUntil, setValidUntil] = useState(endOfCurrentMonth());
  const [amountPaid, setAmountPaid] = useState(String(amount || 0));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [customMonthlyFee, setCustomMonthlyFee] = useState(String(amount || 0));

  function openModal(nextAction: Action) {
    setAction(nextAction);
    setMessage(null);
    setAmountPaid(String(amount || 0));
    setCustomMonthlyFee(String(amount || 0));
    setPaymentDate(isoDate(new Date()));
    setValidFrom(isoDate(new Date()));
    setValidUntil(endOfCurrentMonth());
  }

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/garden/child-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          child_id: childId,
          action,
          amount: Number(amountPaid || 0),
          amount_paid: Number(amountPaid || 0),
          payment_date: paymentDate,
          valid_from: validFrom,
          valid_until: validUntil,
          payment_method: paymentMethod || undefined,
          notes: notes || undefined,
          custom_monthly_fee: action === "special_arrangement" ? Number(customMonthlyFee || 0) : undefined,
          arrangement_notes: action === "special_arrangement" ? notes || undefined : undefined,
          arrangement_valid_until: action === "special_arrangement" ? validUntil : undefined
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "העדכון נכשל");
      setMessage("סטטוס התשלום עודכן ונרשם בהיסטוריה.");
      setAction(null);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "העדכון נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="payment-action-stack">
      <div className="profile-actions">
        <button className="button secondary tiny" disabled={busy} type="button" onClick={() => openModal("mark_paid")}><CreditCard size={14} /> שולם</button>
        <button className="button secondary tiny" disabled={busy} type="button" onClick={() => openModal("mark_unpaid")}>לא שולם</button>
        <button className="button secondary tiny" disabled={busy} type="button" onClick={() => openModal("partial_payment")}>חלקי</button>
        <button className="button secondary tiny" disabled={busy} type="button" onClick={() => openModal("discount")}>הנחה</button>
        <button className="button tiny" disabled={busy} type="button" onClick={() => openModal("special_arrangement")}>הסדר מיוחד</button>
      </div>
      {message ? <small className="payment-action-message">{message}</small> : null}
      {action ? (
        <div className="modal-backdrop payment-modal-backdrop" role="presentation">
          <form className="card payment-confirm-modal" onSubmit={update}>
            <div className="section-heading">
              <h3>{actionLabels[action]}</h3>
              <p>בדקו את פרטי התשלום לפני שמירה. הפעולה תירשם בהיסטוריה וביומן ביקורת.</p>
            </div>
            <div className="form-grid compact">
              <label>תאריך תשלום<input value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} type="date" /></label>
              <label>תקף מ־<input value={validFrom} onChange={(event) => setValidFrom(event.target.value)} type="date" /></label>
              <label>תקף עד<input value={validUntil} onChange={(event) => setValidUntil(event.target.value)} type="date" /></label>
              <label>סכום ששולם<input value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} type="number" min="0" /></label>
              {action === "special_arrangement" ? <label>סכום חודשי בהסדר<input value={customMonthlyFee} onChange={(event) => setCustomMonthlyFee(event.target.value)} type="number" min="0" /></label> : null}
              <label>אמצעי תשלום<input value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} placeholder="מזומן / העברה / אשראי" /></label>
              <label className="wide">הערות<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="הערה פנימית או פירוט הסדר" /></label>
            </div>
            <div className="profile-actions">
              <button className="button primary" disabled={busy} type="submit">{busy ? "שומר..." : "שמירת תשלום"}</button>
              <button className="button secondary" disabled={busy} type="button" onClick={() => setAction(null)}>ביטול</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
