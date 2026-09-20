"use client";

import { useState } from "react";

async function mutate(payload: Record<string, unknown>) {
  const response = await fetch("/api/garden/staff-time", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("הפעולה לא נשמרה. בדקו הרשאה ונתונים.");
  window.location.reload();
}

function localInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function StaffTimeManagerActions({ shiftId, actualStart, actualEnd, approved }: {
  shiftId: string; actualStart: string | null; actualEnd: string | null; approved: boolean;
}) {
  const [reason, setReason] = useState("");
  const [start, setStart] = useState(localInput(actualStart));
  const [end, setEnd] = useState(localInput(actualEnd));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(payload: Record<string, unknown>) {
    setBusy(true); setError("");
    try { await mutate(payload); } catch (caught) { setError(caught instanceof Error ? caught.message : "שגיאה"); setBusy(false); }
  }
  return <div>
    {!approved && actualEnd ? <button type="button" disabled={busy} onClick={() => act({ action: "approve", shift_id: shiftId })}>אישור שעות</button> : null}
    {approved ? <details><summary>פתיחת אישור לתיקון</summary>
      <input aria-label="סיבת פתיחה מחדש" value={reason} onChange={(event) => setReason(event.target.value)} minLength={8} maxLength={1000} />
      <button type="button" disabled={busy || reason.trim().length < 8} onClick={() => act({ action: "reopen", shift_id: shiftId, reason })}>פתיחה מחדש</button>
    </details> : <details><summary>תיקון שעות עם סיבה</summary>
      <label>כניסה <input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label>
      <label>יציאה <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
      <label>סיבה <input value={reason} onChange={(event) => setReason(event.target.value)} minLength={8} maxLength={1000} /></label>
      <button type="button" disabled={busy || !start || !end || reason.trim().length < 8} onClick={() => act({ action: "correct", shift_id: shiftId, actual_start: new Date(start).toISOString(), actual_end: new Date(end).toISOString(), reason })}>שמירת תיקון</button>
    </details>}
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}

export function StaffTimeRateForm({ employments }: { employments: { id: string; staff_name: string }[] }) {
  const [employment, setEmployment] = useState(employments[0]?.id ?? "");
  const [kind, setKind] = useState<"hourly" | "monthly">("hourly");
  const [amount, setAmount] = useState("");
  const [effective, setEffective] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <form onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try { await mutate({ action: "rate", employment_id: employment, rate_kind: kind, amount: Number(amount), effective_from: effective }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "שגיאה"); setBusy(false); }
  }}>
    <label>איש צוות <select value={employment} onChange={(event) => setEmployment(event.target.value)}>{employments.map((item) => <option key={item.id} value={item.id}>{item.staff_name}</option>)}</select></label>
    <label>סוג תעריף <select value={kind} onChange={(event) => setKind(event.target.value as "hourly" | "monthly")}><option value="hourly">שעתי</option><option value="monthly">חודשי</option></select></label>
    <label>סכום בש״ח <input type="number" min="0" max="1000000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
    <label>בתוקף מתאריך <input type="date" value={effective} onChange={(event) => setEffective(event.target.value)} required /></label>
    <button type="submit" disabled={busy || !employment}>שמירת גרסת תעריף</button>
    {error ? <p role="alert">{error}</p> : null}
  </form>;
}
