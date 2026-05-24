"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export function TaskWorkbench({ tasks }: { tasks: any[] }) {
  const [rows, setRows] = useState(tasks);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function updateTask(id: string, status: string) {
    const reason = status === "rejected" ? window.prompt("סיבת דחייה") ?? "" : "";
    if (status === "rejected" && !reason) return;
    startTransition(async () => {
      const response = await fetch(`/api/tasks/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, rejection_reason: reason, completion_comment: status === "done" ? "בוצע דרך המערכת" : undefined }) });
      if (response.ok) {
        const body = await response.json();
        setRows((current) => current.map((task) => task.id === id ? body.data : task));
        setMessage("המשימה עודכנה.");
      } else {
        setMessage("לא ניתן לעדכן משימה כרגע.");
      }
    });
  }

  return (
    <section className="dashboard-section">
      {message ? <div className={message.includes("עודכנה") ? "success-banner" : "error-banner"}>{message}</div> : null}
      {rows.length === 0 ? <div className="empty-state"><strong>אין משימות פתוחות</strong><span>כשאדמין, מנהלת או פקח יקצו משימה, היא תופיע כאן עם דדליין ועדיפות.</span></div> : <div className="procedure-list">{rows.map((task) => <article className="card procedure-card" key={task.id}><div><span className={task.priority === "critical" || task.priority === "high" ? "pill bad" : "pill warn"}>{task.priority ?? "medium"}</span><h3>{task.title}</h3><p>{task.description}</p><small>דדליין: {task.due_at ? new Date(task.due_at).toLocaleString("he-IL") : "לא הוגדר"} · סטטוס {task.status}</small></div><div className="procedure-meta"><button className="button secondary" disabled={isPending} onClick={() => updateTask(task.id, "waiting_approval")}><CheckCircle2 size={16} /> בוצע וממתין לאישור</button><button className="button" disabled={isPending} onClick={() => updateTask(task.id, "rejected")}><XCircle size={16} /> דחייה</button></div></article>)}</div>}
    </section>
  );
}
