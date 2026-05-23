import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["staff"]);
  const cards = [{"title":"תעודת יושר","body":"סטטוס ותוקף.","status":"חובה"},{"title":"בדיקת רקע","body":"אישור מנהלת.","status":"ממתין"},{"title":"אישור עבודה","body":"נפתח רק לאחר מסמכים.","status":"נעול"}];
  return <DashboardShell role="staff" title="בדיקות רקע"><div className="dashboard-hero-card"><div><p className="eyebrow">אישור עבודה</p><h1>תעודת יושר ובדיקות רקע.</h1><p>עובד לא מאושר כפעיל בלי מסמכי חובה.</p></div><span className="pill warn">UI page</span></div><section className="grid cols-3 dashboard-panels">{cards.map((card) => <article className="card action-panel" key={card.title}><h2>{card.title}</h2><p>{card.body}</p><span className="pill">{card.status}</span></article>)}</section><section className="dashboard-section"><div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות במערכת הן יוצגו כאן במקום לפתוח JSON גולמי.</span></div></section></DashboardShell>;
}
