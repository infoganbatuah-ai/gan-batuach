import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["manager", "owner"]);
  const cards = [{"title":"הודעות להורים","body":"שליחה ומעקב קריאה.","status":"פתוח"},{"title":"פניות הורים","body":"טיפול וסגירה.","status":"SLA"},{"title":"פקח","body":"תקשורת מול פיקוח.","status":"מתועד"}];
  return <DashboardShell role="manager" title="הודעות"><div className="dashboard-hero-card"><div><p className="eyebrow">תקשורת</p><h1>הודעות ופניות מתועדות מול הורים, צוות ופקח.</h1><p>מסך תקשורת פנימי במקום JSON.</p></div><span className="pill warn">UI page</span></div><section className="grid cols-3 dashboard-panels">{cards.map((card) => <article className="card action-panel" key={card.title}><h2>{card.title}</h2><p>{card.body}</p><span className="pill">{card.status}</span></article>)}</section><section className="dashboard-section"><div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות במערכת הן יוצגו כאן במקום לפתוח JSON גולמי.</span></div></section></DashboardShell>;
}
