import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["admin"]);
  const cards = [{"title":"הודעה ארצית","body":"שליחה לפי תפקיד וקהל יעד.","status":"טיוטה"},{"title":"התראת חירום","body":"משימה דחופה לכל הגנים או לגן מסוים.","status":"קריטי"},{"title":"היסטוריה","body":"לוג של הודעות שנשלחו.","status":"ריק"}];
  return <DashboardShell role="admin" title="הודעות וקמפיינים"><div className="dashboard-hero-card"><div><p className="eyebrow">הודעות מערכת</p><h1>פרסום הודעות, קמפיינים והתראות חירום.</h1><p>מסך UI להודעות אדמין במקום /api/admin/push-notices.</p></div><span className="pill warn">UI page</span></div><section className="grid cols-3 dashboard-panels">{cards.map((card) => <article className="card action-panel" key={card.title}><h2>{card.title}</h2><p>{card.body}</p><span className="pill">{card.status}</span></article>)}</section><section className="dashboard-section"><div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות במערכת הן יוצגו כאן במקום לפתוח JSON גולמי.</span></div></section></DashboardShell>;
}
