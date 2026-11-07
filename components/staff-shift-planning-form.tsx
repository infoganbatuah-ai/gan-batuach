"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { staffAvailableOnDate, validateShiftPlan, type ShiftPlanningStaff } from "@/lib/domain/staff-shift-planning";
import styles from "./staff-shift-planning-form.module.css";

export function StaffShiftPlanningForm({ gardenId, today, zone, staff }: {
  gardenId: string; today: string; zone: string; staff: ShiftPlanningStaff[];
}) {
  const router = useRouter();
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const submitting = useRef(false);
  const available = useMemo(() => staff.filter((person) => staffAvailableOnDate(person, date)), [staff, date]);

  return <form className={styles.form} onSubmit={async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    setMessage(""); setSuccess("");
    const values = new FormData(event.currentTarget);
    const submitted = {
      staffId: String(values.get("staff_id") ?? ""), date: String(values.get("shift_date") ?? ""),
      start: String(values.get("planned_start") ?? ""), end: String(values.get("planned_end") ?? "")
    };
    const error = validateShiftPlan({ ...submitted, today, staff });
    if (error) { setMessage(error); return; }
    submitting.current = true; setBusy(true);
    try {
      const response = await fetch("/api/staff/shifts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: submitted.staffId, garden_id: gardenId, shift_date: submitted.date, planned_start: `${submitted.start}:00`, planned_end: `${submitted.end}:00` })
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "שמירת המשמרת נכשלה. נסו שוב.");
      setSuccess("המשמרת נשמרה. היא תופיע בלוח של איש הצוות.");
      setStart(""); setEnd("");
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "שמירת המשמרת נכשלה.");
    } finally { submitting.current = false; setBusy(false); }
  }}>
    <label>איש צוות
      <select name="staff_id" value={staffId} onChange={(event) => setStaffId(event.target.value)} required disabled={busy || staff.length === 0}>
        {staff.map((person) => <option key={person.id} value={person.id} disabled={!staffAvailableOnDate(person, date)}>{person.name}</option>)}
      </select>
    </label>
    <label>תאריך משמרת
      <input name="shift_date" type="date" min={today} value={date} onChange={(event) => {
        const nextDate = event.target.value;
        setDate(nextDate);
        if (!staff.some((person) => person.id === staffId && staffAvailableOnDate(person, nextDate))) {
          setStaffId(staff.find((person) => staffAvailableOnDate(person, nextDate))?.id ?? "");
        }
      }} required disabled={busy} />
    </label>
    <label>התחלה
      <input name="planned_start" type="time" value={start} onChange={(event) => setStart(event.target.value)} required disabled={busy} />
    </label>
    <label>סיום
      <input name="planned_end" type="time" value={end} onChange={(event) => setEnd(event.target.value)} required disabled={busy} />
    </label>
    <button className="gb-primary-button" type="submit" disabled={busy || available.length === 0}>{busy ? "שומר…" : "שמירת משמרת"}</button>
    <p className={styles.note}>שעות מקומיות בגן · {zone}. תכנון המשמרת אינו רישום נוכחות או אישור שכר.</p>
    {message ? <p role="alert" className={`ux07-local-error ${styles.feedback}`}>{message}</p> : null}
    {success ? <p role="status" className={`${styles.feedback} ${styles.success}`}>{success}</p> : null}
  </form>;
}
