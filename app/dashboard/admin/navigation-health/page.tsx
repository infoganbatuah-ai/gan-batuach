import Link from "next/link";
import { Activity, CheckCircle2, Route, ShieldCheck, TriangleAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dashboardRouteChecks, dashboardRouteExists } from "@/lib/dashboard-route-safety";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";

type HealthRow = {
  route: string;
  label: string;
  exists: boolean;
  permission: string;
  dataStatus: string;
  error: string | null;
  count: number | null;
};

export default async function AdminNavigationHealthPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin navigation health", async () => {
    const supabase = await createClient();
    const tableResults = new Map<string, { count: number; error: string | null }>();
    const tables = Array.from(new Set(dashboardRouteChecks.flatMap((check) => check.dataTable ? [check.dataTable] : [])));

    // Keep the diagnostics responsive without flooding Supabase with every table at once.
    for (let index = 0; index < tables.length; index += 8) {
      const batch = tables.slice(index, index + 8);
      await Promise.all(batch.map(async (table) => {
        const response = await supabase.from(table as any).select("id", { count: "exact", head: true });
        if (response.error) {
          logSupabaseError(`navigation health table ${table}`, response.error);
          tableResults.set(table, { count: 0, error: "שגיאת נתונים בטבלה" });
          return;
        }
        tableResults.set(table, { count: response.count ?? 0, error: null });
      }));
    }

    const rows: HealthRow[] = dashboardRouteChecks.map((check) => {
      const tableResult = check.dataTable ? tableResults.get(check.dataTable) : null;
      const count = check.dataTable ? tableResult?.count ?? 0 : null;
      const error = check.dataTable ? tableResult?.error ?? null : null;
      return {
        route: check.route,
        label: check.label,
        exists: dashboardRouteExists(check.route),
        permission: check.roles.join(", "),
        dataStatus: error ? "שגיאה" : count === null ? "לא נדרש" : count > 0 ? `${count} רשומות` : "אין מידע זמין כרגע",
        error,
        count
      };
    });
    return { rows };
  }, { rows: [] as HealthRow[] });

  const brokenRoutes = result.data.rows.filter((row) => !row.exists || row.error);
  const emptyRoutes = result.data.rows.filter((row) => row.exists && !row.error && row.count === 0);

  return (
    <DashboardShell role="admin" title="בריאות ניווט">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Navigation Health</p>
          <h1>בדיקת בריאות לכל קישורי הדשבורד.</h1>
          <p>העמוד בודק קיום route, הרשאות מיועדות וסטטוס נתונים בסיסי כדי למנוע מסכים ריקים או שגיאות מפתיעות.</p>
        </div>
        <span className={brokenRoutes.length ? "pill bad" : "pill good"}>{brokenRoutes.length ? `${brokenRoutes.length} בעיות` : "כל הראוטים קיימים"}</span>
      </div>
      <AdminDataError message={result.error} />
      <div className="grid cols-3 dashboard-kpis">
        <article className="card risk-score-card good"><CheckCircle2 /><strong>{result.data.rows.filter((row) => row.exists && !row.error).length}</strong><span>Routes תקינים</span></article>
        <article className={brokenRoutes.length ? "card risk-score-card bad" : "card risk-score-card good"}><TriangleAlert /><strong>{brokenRoutes.length}</strong><span>Routes עם בעיה</span></article>
        <article className="card risk-score-card warn"><Activity /><strong>{emptyRoutes.length}</strong><span>Routes ללא נתונים כרגע</span></article>
      </div>
      <section className="dashboard-section">
        {result.data.rows.length === 0 ? <div className="empty-state"><strong>אין מידע זמין כרגע</strong><span>בדיקת הניווט לא הצליחה להחזיר תוצאות. נסו לטעון מחדש או בדקו את לוג השרת.</span><Link className="button primary" href="/dashboard/admin">חזרה לאדמין</Link></div> : <div className="navigation-health-grid">
          {result.data.rows.map((row) => <article className={row.exists && !row.error ? "card navigation-health-card" : "card navigation-health-card bad"} key={row.route}>
            <div>
              <span className={row.exists ? "pill good" : "pill bad"}>{row.exists ? "route קיים" : "route חסר"}</span>
              <h3><Route size={18} /> {row.label}</h3>
              <p>{row.route}</p>
            </div>
            <div className="profile-badge-row">
              <span className="pill"><ShieldCheck size={14} /> {row.permission}</span>
              <span className={row.error ? "pill bad" : row.count === 0 ? "pill warn" : "pill good"}>{row.dataStatus}</span>
            </div>
            <div className="profile-actions">
              {row.exists && !row.route.includes("[") ? <Link className="button secondary tiny" href={row.route}>פתיחת עמוד</Link> : null}
              {row.exists && row.route.includes("[") ? <span className="pill">נפתח מתוך רשומת מקור</span> : null}
              {row.error ? <span className="pill bad">נרשם בלוג שרת</span> : null}
            </div>
          </article>)}
        </div>}
      </section>
    </DashboardShell>
  );
}
