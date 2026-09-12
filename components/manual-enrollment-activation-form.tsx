"use client";

import { useState, type FormEvent } from "react";

function monthBounds() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const until = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const local = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  return { from: local(from), until: local(until) };
}

export function ManualEnrollmentActivationForm({ requestId, suggestedAmount }: { requestId: string; suggestedAmount?: number | null }) {
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const period = monthBounds();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setState(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/garden/enrollment-requests/${requestId}/activation`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        method: form.get("method"), amount: form.get("amount"), covered_from: form.get("covered_from"),
        covered_until: form.get("covered_until"), reference: form.get("reference"), note: form.get("note")
      })
    });
    const body = await response.json().catch(() => ({}));
    setState({ ok: response.ok, message: response.ok ? "הסדר התשלום נשמר וההרשמה הופעלה." : body.error ?? "לא ניתן להשלים את ההפעלה." });
    setBusy(false);
    if (response.ok) window.location.reload();
  }
  return <form className="form compact-form" onSubmit={submit}>
    <strong>הסדר תשלום ידני והפעלת הרשמה</strong>
    <select name="method" required defaultValue="bank_transfer">
      <option value="bank_transfer">העברה בנקאית</option><option value="standing_order">הוראת קבע</option><option value="checks">המחאות</option>
    </select>
    <input name="amount" type="number" min="0" step="0.01" required defaultValue={suggestedAmount ?? 0} aria-label="סכום" />
    <label>מתאריך<input name="covered_from" type="date" required defaultValue={period.from} /></label>
    <label>עד תאריך<input name="covered_until" type="date" required defaultValue={period.until} /></label>
    <input name="reference" maxLength={200} placeholder="אסמכתא, ללא פרטי כרטיס" />
    <textarea name="note" maxLength={1000} placeholder="הערה פנימית קצרה" />
    <button className="button primary" type="submit" disabled={busy}>{busy ? "מפעיל…" : "שמור הסדר והפעל הרשמה"}</button>
    {state ? <p className={state.ok ? "form-success" : "form-error"}>{state.message}</p> : null}
  </form>;
}
