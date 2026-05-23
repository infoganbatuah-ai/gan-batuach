import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["parent"]);
  const cards = [{"title":"תמונות","body":"רק לפי הרשאה.","status":"פרטי"},{"title":"Watermark","body":"סימון מקור וזמן.","status":"פעיל"},{"title":"וידאו","body":"גישה מוגבלת.","status":"מורשה"}];
  return <DashboardShell role="parent" title="גלריה"><div className="dashboard-hero-card"><div><p className="eyebrow">תמונות וסרטונים</p><h1>גלריה לפי הרשאות צילום וצפייה.</h1><p>לא מוצגים קישורים ציבוריים ישירים.</p></div><span className="pill warn">UI page</span></div><section className="grid cols-3 dashboard-panels">{cards.map((card) => <article className="card action-panel" key={card.title}><h2>{card.title}</h2><p>{card.body}</p><span className="pill">{card.status}</span></article>)}</section><section className="dashboard-section"><div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות במערכת הן יוצגו כאן במקום לפתוח JSON גולמי.</span></div></section></DashboardShell>;
}
