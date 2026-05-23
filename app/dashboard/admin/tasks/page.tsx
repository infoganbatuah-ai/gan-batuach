import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["admin"]);
  const cards = [{"title":"יצירת משימה","body":"שיוך לגן, אחראי, תאריך יעד וקבצים.","status":"מוכן לחיבור"},{"title":"מעקב צפייה","body":"מי קיבל, מי צפה ומתי.","status":"מתועד"},{"title":"הסלמה","body":"משימות באיחור או קריטיות.","status":"בקרה"}];
  return <DashboardShell role="admin" title="משימות אדמין"><div className="dashboard-hero-card"><div><p className="eyebrow">משימות וביצוע</p><h1>ניהול משימות עם מעקב צפייה, ביצוע והסלמה.</h1><p>יצירת משימות לגנים, פקחים וצוות בלי לפתוח endpoint גולמי.</p></div><span className="pill warn">UI page</span></div><section className="grid cols-3 dashboard-panels">{cards.map((card) => <article className="card action-panel" key={card.title}><h2>{card.title}</h2><p>{card.body}</p><span className="pill">{card.status}</span></article>)}</section><section className="dashboard-section"><div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות במערכת הן יוצגו כאן במקום לפתוח JSON גולמי.</span></div></section></DashboardShell>;
}
