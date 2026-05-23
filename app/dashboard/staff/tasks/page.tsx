import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["staff"]);
  const cards = [{"title":"פתוחות","body":"משימות לביצוע.","status":"פתוח"},{"title":"נצפו","body":"לוג צפייה נשמר.","status":"מתועד"},{"title":"הושלמו","body":"הוכחות וקבצים.","status":"אישור"}];
  return <DashboardShell role="staff" title="משימות צוות"><div className="dashboard-hero-card"><div><p className="eyebrow">משימות</p><h1>משימות שהוקצו לאיש צוות.</h1><p>צפייה, ביצוע והוכחת השלמה.</p></div><span className="pill warn">UI page</span></div><section className="grid cols-3 dashboard-panels">{cards.map((card) => <article className="card action-panel" key={card.title}><h2>{card.title}</h2><p>{card.body}</p><span className="pill">{card.status}</span></article>)}</section><section className="dashboard-section"><div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות במערכת הן יוצגו כאן במקום לפתוח JSON גולמי.</span></div></section></DashboardShell>;
}
