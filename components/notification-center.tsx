"use client";

import Link from "next/link";
import { BellRing } from "lucide-react";
import { useState, useTransition } from "react";

export function NotificationCenter({ notifications }: { notifications: any[] }) {
  const [rows, setRows] = useState(notifications);
  const [isPending, startTransition] = useTransition();
  function markAllRead() {
    startTransition(async () => {
      const response = await fetch("/api/notifications/mark-read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: rows.map((row) => row.id) }) });
      if (response.ok) setRows((current) => current.map((row) => ({ ...row, status: "read", read_at: new Date().toISOString() })));
    });
  }
  return (
    <section className="dashboard-section">
      <div className="section-heading"><h2><BellRing size={20} /> מרכז התראות</h2><p>מסמכים חסרים, פיקוח, מצלמות, AI, משימות והודעות.</p><button className="button secondary" type="button" disabled={isPending || rows.length === 0} onClick={markAllRead}>סימון הכל כנקרא</button></div>
      {rows.length === 0 ? <div className="empty-state"><strong>אין התראות פתוחות</strong><span>כאשר יש פעולה חשובה, היא תופיע כאן בצורה ברורה.</span></div> : <div className="notification-grid">{rows.map((item) => <article className="card notification-card" key={item.id}><span className={item.read_at ? "pill good" : "pill warn"}>{item.read_at ? "read" : item.status ?? "pending"}</span><h3>{item.title}</h3><p>{item.body}</p><small>{item.scheduled_for ? new Date(item.scheduled_for).toLocaleString("he-IL") : ""}</small>{item.entity_type ? <Link className="button secondary tiny" href={item.entity_type === "inspection" ? "/dashboard/admin/inspection-forms" : item.entity_type === "task" ? "/dashboard/admin/tasks" : "/dashboard"}>פתיחה</Link> : null}</article>)}</div>}
    </section>
  );
}
