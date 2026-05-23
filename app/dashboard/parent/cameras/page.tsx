import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["parent"]);
  const cards = [{"title":"הרשאות","body":"רק מצלמות שמותרות לילד.","status":"מוגן"},{"title":"Watermark","body":"שם משתמש ותאריך.","status":"פעיל"},{"title":"לוג צפייה","body":"מי צפה ומתי.","status":"חובה"}];
  return <DashboardShell role="parent" title="צפייה במצלמות"><div className="dashboard-hero-card"><div><p className="eyebrow">לייב מורשה</p><h1>צפייה במצלמות לפי כיתה, חלון שעות ו-token זמני.</h1><p>לא נחשפים קישורי DVR או RTSP.</p></div><span className="pill warn">UI page</span></div><section className="grid cols-3 dashboard-panels">{cards.map((card) => <article className="card action-panel" key={card.title}><h2>{card.title}</h2><p>{card.body}</p><span className="pill">{card.status}</span></article>)}</section><section className="dashboard-section"><div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות במערכת הן יוצגו כאן במקום לפתוח JSON גולמי.</span></div></section></DashboardShell>;
}
