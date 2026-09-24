"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, CheckCircle2, PencilLine, Plus, Save } from "lucide-react";

type ClassroomValue = {
  id: string;
  name: string;
  age_group_key: string;
  age_group_label?: string | null;
  min_age_months?: number | null;
  max_age_months?: number | null;
  capacity_limit?: number | null;
};

function numberValue(form: FormData, name: string) {
  const value = String(form.get(name) ?? "").trim();
  return value ? Number(value) : null;
}

export function ClassroomManagementForm({ classroom }: { classroom?: ClassroomValue }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/garden/classrooms", {
          method: classroom ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(classroom ? { action: "update", classroom_id: classroom.id } : {}),
            name: String(form.get("name") ?? "").trim(),
            age_group_key: String(form.get("age_group_key") ?? "").trim(),
            age_group_label: String(form.get("age_group_label") ?? "").trim() || null,
            min_age_months: numberValue(form, "min_age_months"),
            max_age_months: numberValue(form, "max_age_months"),
            capacity_limit: numberValue(form, "capacity_limit")
          })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error ?? "לא ניתן לשמור את הכיתה כרגע");
        setMessage(classroom ? "פרטי הכיתה עודכנו." : "הכיתה נוצרה ונוספה למרחב הגן.");
        router.refresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "לא ניתן לשמור את הכיתה כרגע");
      }
    });
  }

  return (
    <form className="ux04-form-card" onSubmit={submit}>
      <header>
        <span>{classroom ? <PencilLine size={21} /> : <Plus size={21} />}</span>
        <div><h3>{classroom ? "עריכת כיתה" : "הוספת כיתה"}</h3><p>כיתה היא ישות תפעולית נפרדת מקבוצת הגיל.</p></div>
      </header>
      <div className="ux04-form-grid">
        <label><span>שם הכיתה</span><input name="name" defaultValue={classroom?.name} required maxLength={120} placeholder="לדוגמה: פרפרים א׳" /></label>
        <label><span>מפתח קבוצת גיל</span><input name="age_group_key" defaultValue={classroom?.age_group_key} required maxLength={80} placeholder="TODDLER_YOUNG" dir="ltr" /></label>
        <label><span>שם קבוצת הגיל</span><input name="age_group_label" defaultValue={classroom?.age_group_label ?? ""} maxLength={120} placeholder="פעוטים צעירים" /></label>
        <label><span>גיל מינימלי בחודשים</span><input name="min_age_months" type="number" min={0} max={240} defaultValue={classroom?.min_age_months ?? ""} /></label>
        <label><span>גיל מרבי בחודשים</span><input name="max_age_months" type="number" min={0} max={240} defaultValue={classroom?.max_age_months ?? ""} /></label>
        <label><span>קיבולת</span><input name="capacity_limit" type="number" min={1} max={10000} defaultValue={classroom?.capacity_limit ?? ""} placeholder="לפי הגדרת הגן" /></label>
      </div>
      {message ? <p className="ux04-inline-message success"><CheckCircle2 size={17} />{message}</p> : null}
      {error ? <p className="ux04-inline-message error">{error}</p> : null}
      <button className="button primary" disabled={pending} type="submit"><Save size={18} />{pending ? "שומר..." : "שמירת כיתה"}</button>
    </form>
  );
}

export function ClassroomAssignmentForm({
  childId,
  classrooms,
  currentClassroomId
}: {
  childId: string;
  classrooms: Array<{ id: string; name: string }>;
  currentClassroomId?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const classroomId = String(form.get("classroom_id") ?? "");
    if (!classroomId) return;
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/garden/classrooms", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "assign_child", child_id: childId, classroom_id: classroomId })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error ?? "לא ניתן להעביר את הילד/ה לכיתה");
        setMessage("השיבוץ עודכן ונשמר בהיסטוריית הכיתות.");
        router.refresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "לא ניתן לעדכן את השיבוץ");
      }
    });
  }

  return (
    <form className="ux04-assignment-form" onSubmit={submit}>
      <label><span>שיוך לכיתה</span><select name="classroom_id" defaultValue={currentClassroomId ?? ""} required><option value="" disabled>בחירת כיתה</option>{classrooms.map((room) => <option value={room.id} key={room.id}>{room.name}</option>)}</select></label>
      <button className="button secondary" disabled={pending || classrooms.length === 0} type="submit"><ArrowLeftRight size={17} />{pending ? "מעדכן..." : "עדכון שיבוץ"}</button>
      {message ? <small className="ux04-inline-message success">{message}</small> : null}
      {error ? <small className="ux04-inline-message error">{error}</small> : null}
    </form>
  );
}
