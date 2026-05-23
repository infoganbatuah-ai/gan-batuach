import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["manager", "owner"]);
  const cards = [{"title":"תלמידים פעילים","body":"רשימת תלמידים מאושרים.","status":"פעיל"},{"title":"ממתינים לאישור","body":"רישומי הורים שנשלחו.","status":"בדיקה"},{"title":"כרטיס ילד","body":"בריאות, הסכמות ומורשי איסוף.","status":"רגיש"}];
  return <DashboardShell role="manager" title="ילדים"><div className="dashboard-hero-card"><div><p className="eyebrow">רישום תלמידים</p><h1>ילדים, בקשות רישום ואישורי מנהלת.</h1><p>ניהול ילדים בלי לפתוח JSON.</p></div><span className="pill warn">UI page</span></div><section className="grid cols-3 dashboard-panels">{cards.map((card) => <article className="card action-panel" key={card.title}><h2>{card.title}</h2><p>{card.body}</p><span className="pill">{card.status}</span></article>)}</section><section className="dashboard-section"><div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות במערכת הן יוצגו כאן במקום לפתוח JSON גולמי.</span></div></section></DashboardShell>;
}
