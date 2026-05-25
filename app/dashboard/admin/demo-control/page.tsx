import { DashboardShell } from "@/components/dashboard-shell";
import { DemoControlPanel } from "@/components/demo-control-panel";
import { requireRole } from "@/lib/auth";
import { isAdminClientConfigured } from "@/lib/supabase/admin";

export default async function DemoControlPage() {
  await requireRole(["admin"]);
  const configured = isAdminClientConfigured();

  return (
    <DashboardShell role="admin" title="Demo Control">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Demo Environment</p>
          <h1>מרכז שליטה לנתוני דמו ובדיקות תפעוליות.</h1>
          <p>כאן אפשר ליצור אירועי QA נקודתיים. סביבת דמו מלאה עם משתמשים, גנים, ילדים, ביקורות ותצפיתן נוצרת דרך הפקודה npm run seed:demo-full.</p>
        </div>
        <span className={configured ? "pill good" : "pill bad"}>{configured ? "Service Role מחובר" : "Service Role חסר"}</span>
      </div>
      {!configured ? <div className="error-banner">SUPABASE_SERVICE_ROLE_KEY חסר. פעולות דמו דורשות מפתח Service Role בצד שרת.</div> : null}
      <DemoControlPanel />
      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel"><h2>איך טוענים דמו מלא?</h2><p>הרץ במחשב שלך: npm run seed:demo-full. הסקריפט יוצר משתמשים, גנים, ילדים, ביקורות, מצלמות, AI, תלונות ומשימות.</p></article>
        <article className="card action-panel"><h2>איפוס מלא</h2><p>לאיפוס נתוני הדמו שנוצרו בסקריפט: npm run seed:demo-full -- --reset.</p></article>
        <article className="card action-panel"><h2>בטיחות</h2><p>הנתונים מסומנים בדומיין demo.ganbatuach.com ובשמות גנים דמו כדי לא להתערבב עם לקוחות אמיתיים.</p></article>
      </section>
    </DashboardShell>
  );
}
