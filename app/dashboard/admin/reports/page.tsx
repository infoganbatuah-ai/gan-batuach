import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["admin"]);
  const cards = [{"title":"ביקורות","body":"ציונים, ליקויים וגנים בסיכון.","status":"PDF/XLSX"},{"title":"נוכחות","body":"ילדים, צוות ושעות עבודה.","status":"XLSX"},{"title":"מצלמות ו-AI","body":"צפיות, תקלות ואירועים.","status":"CSV"}];
  return <DashboardShell role="admin" title="דוחות וייצוא"><div className="dashboard-hero-card"><div><p className="eyebrow">דוחות</p><h1>ייצוא וניהול דוחות מערכת.</h1><p>מסך דוחות עם מצב תור, פורמט וקבצי יצוא.</p></div><span className="pill warn">UI page</span></div><section className="grid cols-3 dashboard-panels">{cards.map((card) => <article className="card action-panel" key={card.title}><h2>{card.title}</h2><p>{card.body}</p><span className="pill">{card.status}</span></article>)}</section><section className="dashboard-section"><div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות במערכת הן יוצגו כאן במקום לפתוח JSON גולמי.</span></div></section></DashboardShell>;
}
