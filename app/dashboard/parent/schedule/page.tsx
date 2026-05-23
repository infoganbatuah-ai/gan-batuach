import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["parent"]);
  const cards = [{"title":"לו״ז היום","body":"פעילויות וארוחות.","status":"יומי"},{"title":"תפריט","body":"אלרגיות ורגישויות.","status":"מידע"},{"title":"אירועים","body":"ימי הולדת והודעות.","status":"קרוב"}];
  return <DashboardShell role="parent" title="לו״ז ותפריט"><div className="dashboard-hero-card"><div><p className="eyebrow">סדר יום</p><h1>לו״ז, תפריט ופעילויות הגן.</h1><p>מסך הורים ידידותי במקום JSON.</p></div><span className="pill warn">UI page</span></div><section className="grid cols-3 dashboard-panels">{cards.map((card) => <article className="card action-panel" key={card.title}><h2>{card.title}</h2><p>{card.body}</p><span className="pill">{card.status}</span></article>)}</section><section className="dashboard-section"><div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות במערכת הן יוצגו כאן במקום לפתוח JSON גולמי.</span></div></section></DashboardShell>;
}
