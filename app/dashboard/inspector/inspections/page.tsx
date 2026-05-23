import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["inspector"]);
  const cards = [{"title":"ביקורות פתוחות","body":"משימות חודשיות שטרם נסגרו.","status":"פתוח"},{"title":"GPS","body":"אימות מיקום לפני שליחה.","status":"חובה"},{"title":"דוחות","body":"תוצאות ותיקונים.","status":"מעקב"}];
  return <DashboardShell role="inspector" title="ביקורות פקח"><div className="dashboard-hero-card"><div><p className="eyebrow">פיקוח</p><h1>ביקורות חודשיות, GPS וליקויים.</h1><p>רשימת ביקורות עם סטטוס, ציון ופעולות המשך.</p></div><span className="pill warn">UI page</span></div><section className="grid cols-3 dashboard-panels">{cards.map((card) => <article className="card action-panel" key={card.title}><h2>{card.title}</h2><p>{card.body}</p><span className="pill">{card.status}</span></article>)}</section><section className="dashboard-section"><div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות במערכת הן יוצגו כאן במקום לפתוח JSON גולמי.</span></div></section></DashboardShell>;
}
