"use client";

import { useState } from "react";

export type Period = { id: string; child_id: string; period_start: string; amount_due: number; amount_settled: number; outstanding: number; unapplied_credit_total: number; status: string };
export type Enrollment = { id: string; child_id: string; children?: { full_name?: string } | null };

export function TuitionLedgerPanel({ initialPeriods, initialEnrollments, initialDueDay }: { initialPeriods: Period[]; initialEnrollments: Enrollment[]; initialDueDay: number | null }) {
  const [periods, setPeriods] = useState<Period[]>(initialPeriods);
  const [enrollments, setEnrollments] = useState<Enrollment[]>(initialEnrollments);
  const [enrollmentId, setEnrollmentId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [intentKey, setIntentKey] = useState<string | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentKey, setAdjustmentKey] = useState<string | null>(null);
  const [dueDay, setDueDay] = useState(initialDueDay?.toString() ?? "");
  const [partialAmount, setPartialAmount] = useState("");
  const [partialReason, setPartialReason] = useState("");

  async function refresh() {
    const response = await fetch("/api/garden/tuition-ledger", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "טעינת ספר החיובים נכשלה");
    setPeriods(body.data?.periods ?? []);
    setEnrollments(body.data?.enrollments ?? []);
    setDueDay(body.data?.due_day?.toString() ?? "");
  }

  async function submit(payload: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/garden/tuition-ledger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "הפעולה נדחתה");
      await refresh();
      setIntentKey(null);
      setAdjustmentKey(null);
      setMessage("הפעולה נרשמה בספר החיובים. לא בוצע חיוב אלקטרוני.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "הפעולה נדחתה"); }
    finally { setBusy(false); }
  }

  return <section className="card" aria-label="ספר חיובי שכר לימוד">
    <h2>ספר חיובי שכר לימוד</h2>
    <p>חיובים לפי ילד וחודש. אישור ידני מתעד תשלום שהגן אימת; אין כאן סליקה אלקטרונית.</p>
    <form onSubmit={event => { event.preventDefault(); void submit({ action: "set_due_day", day: dueDay ? Number(dueDay) : null }); }}>
      <label>יום פירעון חודשי <input type="number" min="1" max="31" value={dueDay} onChange={event => setDueDay(event.target.value)} placeholder="לא הוגדר" /></label>
      <button className="button secondary" disabled={busy} type="submit">שמירת מועד לחיובים חדשים</button>
    </form>
    <form onSubmit={event => { event.preventDefault(); if (enrollmentId) void submit({ action: "generate_period", enrollment_id: enrollmentId, month: `${month}-01`, agreed_partial_amount: partialAmount ? Number(partialAmount) : undefined, partial_reason: partialReason || undefined }); }}>
      <label>הרשמה פעילה <select value={enrollmentId} onChange={event => setEnrollmentId(event.target.value)} required><option value="">בחרו ילד</option>{enrollments.map(item => <option key={item.id} value={item.id}>{item.children?.full_name ?? item.child_id}</option>)}</select></label>
      <label>חודש חיוב <input type="month" value={month} onChange={event => setMonth(event.target.value)} required /></label>
      <p>אם תחילת ההרשמה או סיומה באמצע החודש, יש להזין סכום מוסכם וסיבה. המערכת אינה מחשבת חלוקה יחסית בעצמה.</p>
      <label>סכום מוסכם לחודש חלקי <input type="number" min="0" step="0.01" value={partialAmount} onChange={event => setPartialAmount(event.target.value)} /></label>
      <label>סיבת סכום לחודש חלקי <input value={partialReason} onChange={event => setPartialReason(event.target.value)} /></label>
      <button className="button secondary" disabled={busy} type="submit">יצירת תקופת חיוב</button>
    </form>
    <form onSubmit={event => { event.preventDefault(); if (periodId && Number(adjustmentAmount) !== 0) { const key = adjustmentKey ?? crypto.randomUUID(); setAdjustmentKey(key); void submit({ action: "adjustment", period_id: periodId, amount: Number(adjustmentAmount), reason: adjustmentReason, idempotency_key: key }); } }}>
      <h3>התאמת חיוב</h3>
      <p>סכום שלילי מפחית את החיוב. כל התאמה מחייבת סיבה ונרשמת בביקורת.</p>
      <label>סכום התאמה <input type="number" step="0.01" value={adjustmentAmount} onChange={event => setAdjustmentAmount(event.target.value)} required /></label>
      <label>סיבה <input value={adjustmentReason} onChange={event => setAdjustmentReason(event.target.value)} minLength={3} required /></label>
      <button className="button secondary" disabled={busy || !periodId} type="submit">שמירת התאמה לתקופה שנבחרה</button>
    </form>
    {periods.length ? <div className="parent-payment-list">{periods.map(period => <article className="parent-payment-card" key={period.id}>
      <strong>{enrollments.find(item => item.child_id === period.child_id)?.children?.full_name ?? "ילד/ה"} · {period.period_start.slice(0, 7)}</strong>
      <span>לחיוב ₪{period.amount_due} · נרשם ₪{period.amount_settled} · יתרה ₪{period.outstanding}</span>
      {period.unapplied_credit_total > 0 ? <span>זיכוי לא משויך ₪{period.unapplied_credit_total} · נדרשת התאמה</span> : null}
      <span>{period.status === "reconciliation_required" ? "נדרשת התאמה" : period.status === "overdue" ? "באיחור" : period.status === "paid" ? "שולם" : period.status === "partially_paid" ? "שולם חלקית" : "ממתין"}</span>
    </article>)}</div> : <p>אין עדיין תקופות חיוב בספר הקנוני.</p>}
    <form onSubmit={event => { event.preventDefault(); if (periodId && Number(amount) > 0) { const key = intentKey ?? crypto.randomUUID(); setIntentKey(key); void submit({ action: "manual_settlement", period_id: periodId, amount: Number(amount), method, reason, idempotency_key: key }); } }}>
      <h3>אישור תשלום ידני לתקופה</h3>
      <label>תקופת חיוב <select value={periodId} onChange={event => setPeriodId(event.target.value)} required><option value="">בחרו תקופה</option>{periods.map(item => <option key={item.id} value={item.id}>{item.period_start.slice(0, 7)} · יתרה ₪{item.outstanding}</option>)}</select></label>
      <label>סכום שהתקבל <input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required /></label>
      <label>אמצעי <select value={method} onChange={event => setMethod(event.target.value)}><option value="bank_transfer">העברה בנקאית</option><option value="standing_order">הוראת קבע</option><option value="checks">צ׳קים</option><option value="cash">מזומן</option><option value="external_other">אמצעי חיצוני אחר</option></select></label>
      <label>הערה <input value={reason} onChange={event => setReason(event.target.value)} /></label>
      <button className="button primary" disabled={busy} type="submit">רישום תשלום ידני</button>
    </form>
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
