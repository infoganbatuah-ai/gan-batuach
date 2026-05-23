import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["staff"]);
  const cards = [{"title":"כניסה","body":"בדיקת מיקום מול כתובת הגן.","status":"GPS"},{"title":"יציאה","body":"סגירת משמרת.","status":"יומי"},{"title":"חריגה","body":"דורשת אישור.","status":"בקרה"}];
  return <DashboardShell role="staff" title="נוכחות צוות"><div className="dashboard-hero-card"><div><p className="eyebrow">GPS</p><h1>כניסה ויציאה מהעבודה עם אימות מיקום.</h1><p>מסך צוות.</p></div><span className="pill warn">UI page</span></div><section className="grid cols-3 dashboard-panels">{cards.map((card) => <article className="card action-panel" key={card.title}><h2>{card.title}</h2><p>{card.body}</p><span className="pill">{card.status}</span></article>)}</section><section className="dashboard-section"><div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות במערכת הן יוצגו כאן במקום לפתוח JSON גולמי.</span></div></section></DashboardShell>;
}
