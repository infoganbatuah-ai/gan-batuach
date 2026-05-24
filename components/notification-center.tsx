import Link from "next/link";
import { BellRing } from "lucide-react";

export function NotificationCenter({ notifications }: { notifications: any[] }) {
  return (
    <section className="dashboard-section">
      <div className="section-heading"><h2><BellRing size={20} /> מרכז התראות</h2><p>מסמכים חסרים, פיקוח, מצלמות, AI, משימות והודעות.</p></div>
      {notifications.length === 0 ? <div className="empty-state"><strong>אין התראות פתוחות</strong><span>כאשר יש פעולה חשובה, היא תופיע כאן בצורה ברורה.</span></div> : <div className="notification-grid">{notifications.map((item) => <article className="card notification-card" key={item.id}><span className="pill warn">{item.status ?? "pending"}</span><h3>{item.title}</h3><p>{item.body}</p><small>{item.scheduled_for ? new Date(item.scheduled_for).toLocaleString("he-IL") : ""}</small>{item.entity_type ? <Link className="button secondary tiny" href={item.entity_type === "inspection" ? "/dashboard/admin/inspection-forms" : "/dashboard"}>פתיחה</Link> : null}</article>)}</div>}
    </section>
  );
}
