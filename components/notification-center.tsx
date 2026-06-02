"use client";

import Link from "next/link";
import { BellRing, CheckCircle2, ExternalLink } from "lucide-react";
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
  async function markRead(id: string) {
    const response = await fetch("/api/notifications/mark-read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
    if (response.ok) setRows((current) => current.map((row) => row.id === id ? { ...row, status: "read", read_at: new Date().toISOString() } : row));
  }
  function hrefFor(item: any) {
    return item.action_url || item.metadata?.href || (item.entity_type === "inspection" ? "/dashboard/garden/inspections" : item.entity_type === "task" ? "/dashboard/staff/tasks" : "/dashboard");
  }
  const unread = rows.filter((row) => !row.read_at && row.status !== "read").length;
  return (
    <section className="dashboard-section">
      <div className="section-heading"><h2><BellRing size={20} /> מרכז התראות</h2><p>מה קרה, מה דורש טיפול, ואיפה ללחוץ כדי להמשיך.</p><div className="actions"><span className={unread ? "pill warn" : "pill good"}>{unread} לא נקראו</span><button className="button secondary" type="button" disabled={isPending || rows.length === 0} onClick={markAllRead}>סימון הכל כנקרא</button></div></div>
      {rows.length === 0 ? <div className="empty-state"><strong>אין התראות פתוחות</strong><span>כאשר יש פעולה חשובה, היא תופיע כאן עם כפתור פעולה ברור.</span></div> : <div className="notification-grid">{rows.map((item) => <article className={`card notification-card severity-${item.severity ?? "info"}`} key={item.id}><span className={item.read_at ? "pill good" : item.severity === "critical" || item.severity === "urgent" ? "pill bad" : "pill warn"}>{item.read_at ? "נקרא" : item.severity ?? item.status ?? "חדש"}</span><h3>{item.title}</h3><p>{item.message ?? item.body}</p><small>{item.created_at ? new Date(item.created_at).toLocaleString("he-IL") : item.scheduled_for ? new Date(item.scheduled_for).toLocaleString("he-IL") : ""}</small><div className="profile-actions"><Link className="button primary tiny" href={hrefFor(item)}><ExternalLink size={14} /> פתיחה</Link>{!item.read_at ? <button className="button secondary tiny" type="button" onClick={() => markRead(item.id)}><CheckCircle2 size={14} /> נקרא</button> : null}</div></article>)}</div>}
    </section>
  );
}
