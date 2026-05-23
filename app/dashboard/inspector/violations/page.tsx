import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["inspector"]);
  const cards = [{"title":"ליקויים אדומים","body":"שאלות ציון 1-4.","status":"דחוף"},{"title":"הוכחות תיקון","body":"תמונה, מסמך והערת גן.","status":"ממתין"},{"title":"אישור פקח","body":"אישור, דחייה או בקשת השלמה.","status":"פעולה"}];
  return <DashboardShell role="inspector" title="ליקויים"><div className="dashboard-hero-card"><div><p className="eyebrow">תיקונים</p><h1>אישור או דחייה של תיקון ליקויים.</h1><p>מסך UI לפקח במקום endpoint של violations.</p></div><span className="pill warn">UI page</span></div><section className="grid cols-3 dashboard-panels">{cards.map((card) => <article className="card action-panel" key={card.title}><h2>{card.title}</h2><p>{card.body}</p><span className="pill">{card.status}</span></article>)}</section><section className="dashboard-section"><div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות במערכת הן יוצגו כאן במקום לפתוח JSON גולמי.</span></div></section></DashboardShell>;
}
