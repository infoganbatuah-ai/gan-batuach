import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["staff"]);
  const cards = [{"title":"מהמנהלת","body":"הודעות ומשימות.","status":"קריאה"},{"title":"להורים","body":"לפי הרשאה בלבד.","status":"מוגבל"},{"title":"לוג","body":"מי קרא ומתי.","status":"מתועד"}];
  return <DashboardShell role="staff" title="הודעות צוות"><div className="dashboard-hero-card"><div><p className="eyebrow">תקשורת</p><h1>הודעות פנימיות מתועדות.</h1><p>מסך UI להודעות צוות.</p></div><span className="pill warn">UI page</span></div><section className="grid cols-3 dashboard-panels">{cards.map((card) => <article className="card action-panel" key={card.title}><h2>{card.title}</h2><p>{card.body}</p><span className="pill">{card.status}</span></article>)}</section><section className="dashboard-section"><div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות במערכת הן יוצגו כאן במקום לפתוח JSON גולמי.</span></div></section></DashboardShell>;
}
