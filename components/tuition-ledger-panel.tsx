"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, CheckCircle2, CircleDollarSign, FileClock, Landmark, ReceiptText, SlidersHorizontal, WalletCards } from "lucide-react";
import { FinanceEmpty, FinanceMetric, FinanceMetrics, FinanceSection, FinanceStatus, FinanceTruthBanner, dateText, money, periodText } from "@/components/finance-platform-ui";

export type Period = { id: string; child_id: string; enrollment_id: string; period_start: string; due_at?: string | null; amount_due: number; amount_settled: number; outstanding: number; adjustment_total?: number; unapplied_credit_total: number; reconciliation_reason?: string | null; status: string };
export type Enrollment = { id: string; child_id: string; children?: { full_name?: string } | null };
export type TuitionEntry = { id: string; period_id: string; entry_kind: string; amount: number; method?: string | null; reason?: string | null; created_at: string };

export function TuitionLedgerPanel({ initialPeriods, initialEnrollments, initialDueDay, initialEntries = [] }: { initialPeriods: Period[]; initialEnrollments: Enrollment[]; initialDueDay: number | null; initialEntries?: TuitionEntry[] }) {
  const [periods, setPeriods] = useState<Period[]>(initialPeriods);
  const [enrollments, setEnrollments] = useState<Enrollment[]>(initialEnrollments);
  const [enrollmentId, setEnrollmentId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
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
  const [statusFilter, setStatusFilter] = useState("");
  const names = useMemo(() => new Map(enrollments.map((item) => [item.child_id, item.children?.full_name ?? "ילד/ה"])), [enrollments]);
  const visiblePeriods = periods.filter((item) => !statusFilter || item.status === statusFilter);
  const expected = periods.reduce((sum, item) => sum + Number(item.amount_due), 0);
  const settled = periods.reduce((sum, item) => sum + Number(item.amount_settled), 0);
  const outstanding = periods.reduce((sum, item) => sum + Number(item.outstanding), 0);
  const attention = periods.filter((item) => ["overdue", "reconciliation_required"].includes(item.status));

  async function refresh() {
    const response = await fetch("/api/garden/tuition-ledger", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "טעינת ספר החיובים נכשלה");
    setPeriods(body.data?.periods ?? []); setEnrollments(body.data?.enrollments ?? []); setDueDay(body.data?.due_day?.toString() ?? "");
  }
  async function submit(payload: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/garden/tuition-ledger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "הפעולה נדחתה");
      await refresh(); setIntentKey(null); setAdjustmentKey(null);
      setMessage("הפעולה נרשמה בספר החיובים ובביקורת. לא בוצע חיוב אלקטרוני.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "הפעולה נדחתה"); }
    finally { setBusy(false); }
  }

  return <div className="finance-platform">
    <FinanceMetrics>
      <FinanceMetric label="חיוב כולל" value={money(expected)} hint={`${periods.length} תקופות`} icon={CircleDollarSign} tone="blue" />
      <FinanceMetric label="שולם" value={money(settled)} hint="רישום קנוני" icon={CheckCircle2} tone="green" />
      <FinanceMetric label="יתרה פתוחה" value={money(outstanding)} hint="לא כולל מנוי גן בטוח" icon={WalletCards} tone={outstanding ? "orange" : "green"} />
      <FinanceMetric label="דורש טיפול" value={attention.length} hint="איחור או התאמה" icon={FileClock} tone={attention.length ? "red" : "green"} />
    </FinanceMetrics>
    <FinanceTruthBanner title="ספר שכר לימוד קנוני" text="כל סכום מחושב מתקופת החיוב ורישומי הספר. תשלום ידני מתועד רק לאחר שהגן אימת שהכסף התקבל." />
    <FinanceSection title="תקופות חיוב" text="לחיוב, שולם, יתרה וסטטוס — ללא יתרה שחושבה רק בדפדפן" action={<div className="finance-filter-bar">{[["", "הכל"], ["pending", "לתשלום"], ["partially_paid", "חלקי"], ["overdue", "באיחור"], ["reconciliation_required", "התאמה"], ["paid", "שולם"]].map(([key, label]) => <button className={`finance-filter-chip ${statusFilter === key ? "active" : ""}`} onClick={() => setStatusFilter(key)} type="button" key={key}>{label}</button>)}</div>}>
      <div className="finance-ledger"><div className="finance-ledger-head"><span>ילד/ה</span><span>תקופה</span><span>לחיוב</span><span>שולם</span><span>יתרה</span><span>סטטוס</span></div>{visiblePeriods.map((period) => <article className="finance-ledger-row" key={period.id}>
        <div className="finance-ledger-person"><span className="finance-ledger-avatar">{names.get(period.child_id)?.slice(0, 1) ?? "י"}</span><span><b>{names.get(period.child_id) ?? "ילד/ה"}</b><small>{period.due_at ? `לפירעון ${dateText(period.due_at)}` : "מועד לא הוגדר"}</small></span></div>
        <div className="finance-ledger-cell"><b>{periodText(period.period_start)}</b><small>{period.reconciliation_reason ? "נדרשת בדיקה" : "חודשי"}</small></div><div className="finance-ledger-cell"><b>{money(period.amount_due)}</b></div><div className="finance-ledger-cell"><b>{money(period.amount_settled)}</b></div><div className="finance-ledger-cell"><b>{money(period.outstanding)}</b>{period.unapplied_credit_total ? <small>זיכוי {money(period.unapplied_credit_total)}</small> : null}</div><FinanceStatus status={period.status} />
      </article>)}{!visiblePeriods.length ? <FinanceEmpty title="אין תקופות במסנן" text="אפשר לבחור מסנן אחר או ליצור תקופה חדשה מתוך הרשמה פעילה." /> : null}</div>
    </FinanceSection>
    <div className="finance-two-column">
      <FinanceSection title="רישום תשלום ידני" text="הגן מאשר כסף שכבר התקבל; אין כאן סליקה או אישור ספק">
        <form className="finance-form-grid" onSubmit={(event) => { event.preventDefault(); if (periodId && Number(amount) > 0) { const key = intentKey ?? crypto.randomUUID(); setIntentKey(key); void submit({ action: "manual_settlement", period_id: periodId, amount: Number(amount), method, reference: reference || undefined, reason, idempotency_key: key }); } }}>
          <label className="wide">תקופת חיוב<select value={periodId} onChange={(event) => setPeriodId(event.target.value)} required><option value="">בחרו ילד ותקופה</option>{periods.map((item) => <option key={item.id} value={item.id}>{names.get(item.child_id)} · {item.period_start.slice(0, 7)} · יתרה {money(item.outstanding)}</option>)}</select></label>
          <label>סכום שהתקבל<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
          <label>אמצעי<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="bank_transfer">העברה בנקאית</option><option value="standing_order">הוראת קבע</option><option value="checks">צ׳קים</option><option value="cash">מזומן</option><option value="external_other">אמצעי חיצוני אחר</option></select></label>
          <label>אסמכתה<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="אופציונלי" /></label><label>הערה<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          <div className="finance-form-actions wide"><button className="button primary" disabled={busy} type="submit"><Landmark size={17} /> רישום תשלום ידני</button></div>
        </form>
      </FinanceSection>
      <FinanceSection title="התאמה או זיכוי" text="החיוב המקורי נשמר. כל שינוי דורש סכום וסיבה">
        <form className="finance-form-grid" onSubmit={(event) => { event.preventDefault(); if (periodId && Number(adjustmentAmount) !== 0) { const key = adjustmentKey ?? crypto.randomUUID(); setAdjustmentKey(key); void submit({ action: "adjustment", period_id: periodId, amount: Number(adjustmentAmount), reason: adjustmentReason, idempotency_key: key }); } }}>
          <label>סכום התאמה<input type="number" step="0.01" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} required /></label><label>סיבה<input value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} minLength={3} required /></label>
          <p className="wide helper-text">סכום שלילי מפחית את החיוב. תשלום יתר נשמר כזיכוי לא משויך ודורש התאמה.</p><div className="finance-form-actions wide"><button className="button secondary" disabled={busy || !periodId} type="submit"><SlidersHorizontal size={17} /> שמירת התאמה</button></div>
        </form>
      </FinanceSection>
    </div>
    <div className="finance-two-column">
      <FinanceSection title="יצירת תקופת חיוב" text="נוצר רק מהרשמה פעילה ומחיר מוסכם">
        <form className="finance-form-grid" onSubmit={(event) => { event.preventDefault(); if (enrollmentId) void submit({ action: "generate_period", enrollment_id: enrollmentId, month: `${month}-01`, agreed_partial_amount: partialAmount ? Number(partialAmount) : undefined, partial_reason: partialReason || undefined }); }}>
          <label>ילד/ה<select value={enrollmentId} onChange={(event) => setEnrollmentId(event.target.value)} required><option value="">בחרו ילד</option>{enrollments.map((item) => <option key={item.id} value={item.id}>{item.children?.full_name ?? item.child_id}</option>)}</select></label><label>חודש<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} required /></label>
          <details className="finance-action-drawer wide"><summary>חודש התחלה/סיום חלקי</summary><div className="finance-action-body"><label>סכום מוסכם<input type="number" min="0" step="0.01" value={partialAmount} onChange={(event) => setPartialAmount(event.target.value)} /></label><label>סיבה<input value={partialReason} onChange={(event) => setPartialReason(event.target.value)} /></label></div></details>
          <div className="finance-form-actions wide"><button className="button primary" disabled={busy} type="submit"><CalendarPlus size={17} /> יצירת תקופה</button></div>
        </form>
      </FinanceSection>
      <FinanceSection title="מדיניות מועד חיוב" text="המועד חל רק על תקופות חדשות">
        <form className="finance-form-grid" onSubmit={(event) => { event.preventDefault(); void submit({ action: "set_due_day", day: dueDay ? Number(dueDay) : null }); }}><label className="wide">יום בחודש<input type="number" min="1" max="31" value={dueDay} onChange={(event) => setDueDay(event.target.value)} placeholder="לא הוגדר" /></label><div className="finance-form-actions wide"><button className="button secondary" disabled={busy} type="submit">שמירת מועד</button></div></form>
        <FinanceTruthBanner kind="warning" title="תשלום אלקטרוני אינו זמין" text="המסך אינו מציג כרטיס אשראי, ארנק דיגיטלי או אישור תשלום מזויף." />
      </FinanceSection>
    </div>
    <FinanceSection title="היסטוריית ספר" text="פעולות מתועדות; היסטוריה אינה נדרסת">
      <div className="finance-history">{initialEntries.map((entry) => { const period = periods.find((item) => item.id === entry.period_id); return <article className="finance-history-row" key={entry.id}><span><ReceiptText size={21} /></span><div><b>{names.get(period?.child_id ?? "") ?? "ילד/ה"} · {money(entry.amount)}</b><small>{entry.entry_kind === "manual_settlement" ? `תשלום ידני · ${entry.method ?? "אמצעי חיצוני"}` : entry.entry_kind === "adjustment" ? `התאמה · ${entry.reason ?? "סיבה מתועדת"}` : "זיכוי לא משויך"}</small></div><time>{dateText(entry.created_at)}</time></article>; })}{!initialEntries.length ? <FinanceEmpty title="אין עדיין פעולות בספר" text="לאחר תשלום ידני או התאמה תופיע כאן היסטוריה שאינה ניתנת למחיקה מהמסך." /> : null}</div>
    </FinanceSection>
    {message ? <p className="finance-operation-message" role="status">{message}</p> : null}
  </div>;
}
