"use client";

import { useState, useTransition, type FormEvent } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export function TaskWorkbench({ tasks, gardenId, assignees = [], canManage = false }: {
  tasks: any[];
  gardenId?: string;
  assignees?: { id: string; name: string }[];
  canManage?: boolean;
}) {
  const [rows, setRows] = useState(tasks);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function updateTask(id: string, action: "submit" | "reject" | "complete" | "reopen" | "cancel") {
    const reason = ["reject", "reopen"].includes(action) ? window.prompt("הערה לפעולה") ?? "" : "";
    if (["reject", "reopen"].includes(action) && !reason) return;
    startTransition(async () => {
      const response = await fetch(`/api/tasks/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note: reason || undefined }) });
      const body = await response.json().catch(() => null);
      if (response.ok) {
        setRows((current) => current.map((task) => task.id === id ? body.data : task));
        setMessage("המשימה עודכנה.");
      } else {
        setMessage(body?.error || "לא ניתן לעדכן משימה כרגע. בדקו הרשאה או סטטוס משימה.");
      }
    });
  }

  function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gardenId) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    startTransition(async () => {
      const response = await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          garden_id: gardenId,
          title: String(data.title ?? ""),
          description: String(data.description ?? ""),
          assigned_to: String(data.assigned_to ?? "") || null,
          due_at: data.due_at ? new Date(String(data.due_at)).toISOString() : null,
          priority: String(data.priority ?? "medium")
        })
      });
      const body = await response.json().catch(() => null);
      if (response.ok) { setRows((current) => [body.data, ...current]); form.reset(); setMessage("המשימה נוצרה."); }
      else setMessage(body?.error || "יצירת המשימה נכשלה.");
    });
  }

  return (
    <section className="dashboard-section">
      {message ? <div className={message.includes("עודכנה") ? "success-banner" : "error-banner"}>{message}</div> : null}
      {canManage && gardenId ? <form className="card form" onSubmit={createTask}>
        <h3>משימה חדשה</h3>
        <div className="form-grid">
          <label>כותרת<input name="title" required maxLength={200} /></label>
          <label>אחראי<select name="assigned_to"><option value="">לא משויך</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
          <label>תאריך יעד<input name="due_at" type="datetime-local" /></label>
          <label>עדיפות<select name="priority"><option value="low">נמוכה</option><option value="medium">רגילה</option><option value="high">גבוהה</option><option value="critical">דחופה</option></select></label>
          <label className="wide">תיאור<textarea name="description" rows={2} /></label>
        </div>
        <button className="button primary" disabled={isPending}>יצירת משימה</button>
      </form> : null}
      {rows.length === 0 ? <div className="empty-state"><strong>אין משימות פתוחות</strong><span>כשאדמין, מנהלת או פקח יקצו משימה, היא תופיע כאן עם דדליין ועדיפות.</span></div> : <div className="procedure-list">{rows.map((task) => <article className="card procedure-card" key={task.id}><div><span className={task.priority === "critical" || task.priority === "high" ? "pill bad" : "pill warn"}>{task.priority ?? "medium"}</span><h3>{task.title}</h3><p>{task.description}</p><small>דדליין: {task.due_at ? new Date(task.due_at).toLocaleString("he-IL") : "לא הוגדר"} · סטטוס {task.status}</small></div><div className="procedure-meta">{!["done","cancelled","waiting_approval"].includes(task.status) ? <button className="button secondary" disabled={isPending} onClick={() => updateTask(task.id, "submit")}><CheckCircle2 size={16} /> בוצע וממתין לאישור</button> : null}{canManage && task.status === "waiting_approval" ? <button className="button secondary" disabled={isPending} onClick={() => updateTask(task.id, "complete")}><CheckCircle2 size={16} /> אישור השלמה</button> : null}{canManage && task.status === "waiting_approval" ? <button className="button" disabled={isPending} onClick={() => updateTask(task.id, "reject")}><XCircle size={16} /> החזרה לתיקון</button> : null}{canManage && ["done","cancelled","rejected"].includes(task.status) ? <button className="button secondary" disabled={isPending} onClick={() => updateTask(task.id, "reopen")}>פתיחה מחדש</button> : null}{canManage && !["done","cancelled"].includes(task.status) ? <button className="button" disabled={isPending} onClick={() => updateTask(task.id, "cancel")}>ביטול</button> : null}</div></article>)}</div>}
    </section>
  );
}
