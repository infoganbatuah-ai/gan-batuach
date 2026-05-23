import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["manager", "owner"]);
  const cards = [{"title":"ילדים","body":"נוכח, נעדר, חולה, איחר.","status":"יומי"},{"title":"צוות","body":"כניסה/יציאה ו-GPS.","status":"מעקב"},{"title":"דוחות","body":"חודשי, איחורים ויציאות מוקדמות.","status":"ייצוא"}];
  return <DashboardShell role="manager" title="נוכחות"><div className="dashboard-hero-card"><div><p className="eyebrow">נוכחות יומית</p><h1>סימון נוכחות ילדים וצוות עם לוג שינוי.</h1><p>מסך UI לנוכחות במקום /api/attendance.</p></div><span className="pill warn">UI page</span></div><section className="grid cols-3 dashboard-panels">{cards.map((card) => <article className="card action-panel" key={card.title}><h2>{card.title}</h2><p>{card.body}</p><span className="pill">{card.status}</span></article>)}</section><section className="dashboard-section"><div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות במערכת הן יוצגו כאן במקום לפתוח JSON גולמי.</span></div></section></DashboardShell>;
}
