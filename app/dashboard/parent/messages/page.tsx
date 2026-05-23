import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["parent"]);
  const cards = [{"title":"פנייה חדשה","body":"נושא, תוכן ודחיפות.","status":"פתוח"},{"title":"הודעות מהגן","body":"קריאה ותגובות.","status":"לפי הרשאה"},{"title":"סטטוס טיפול","body":"פתוח, בטיפול, נסגר.","status":"מעקב"}];
  return <DashboardShell role="parent" title="פנייה לגן"><div className="dashboard-hero-card"><div><p className="eyebrow">הודעות</p><h1>שליחת פנייה מתועדת לגן.</h1><p>מסך הורה נקי.</p></div><span className="pill warn">UI page</span></div><section className="grid cols-3 dashboard-panels">{cards.map((card) => <article className="card action-panel" key={card.title}><h2>{card.title}</h2><p>{card.body}</p><span className="pill">{card.status}</span></article>)}</section><section className="dashboard-section"><div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות במערכת הן יוצגו כאן במקום לפתוח JSON גולמי.</span></div></section></DashboardShell>;
}
