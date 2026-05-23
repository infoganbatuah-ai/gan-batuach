import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["parent"]);
  const cards = [{"title":"תלונה רגילה","body":"עד 48 שעות.","status":"SLA"},{"title":"תלונה חמורה","body":"התראה לפקח ולאדמין.","status":"דחוף"},{"title":"קבצים","body":"תמונה או מסמך מצורף.","status":"אפשרי"}];
  return <DashboardShell role="parent" title="תלונות"><div className="dashboard-hero-card"><div><p className="eyebrow">פנייה לפיקוח</p><h1>הגשת תלונה מסודרת לפי חומרה.</h1><p>מסך UI לתלונות הורים.</p></div><span className="pill warn">UI page</span></div><section className="grid cols-3 dashboard-panels">{cards.map((card) => <article className="card action-panel" key={card.title}><h2>{card.title}</h2><p>{card.body}</p><span className="pill">{card.status}</span></article>)}</section><section className="dashboard-section"><div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות במערכת הן יוצגו כאן במקום לפתוח JSON גולמי.</span></div></section></DashboardShell>;
}
