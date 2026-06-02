import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { smartThresholds } from "@/lib/domain/smart-kindergarten-engine";
import { createClient } from "@/lib/supabase/server";

export default async function SmartEngineAuditPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("smart engine audit", async () => {
    const supabase = await createClient();
    const [insights, notifications, managers, parents, staff, inspectors] = await Promise.all([
      supabase.from("smart_insights" as any).select("id, role, status, severity, category", { count: "exact" }).limit(200),
      supabase.from("notifications" as any).select("id", { count: "exact", head: true }).eq("entity_type", "smart_insight"),
      supabase.from("profiles" as any).select("id", { count: "exact", head: true }).in("role", ["manager", "owner"]),
      supabase.from("profiles" as any).select("id", { count: "exact", head: true }).eq("role", "parent"),
      supabase.from("profiles" as any).select("id", { count: "exact", head: true }).eq("role", "staff"),
      supabase.from("profiles" as any).select("id", { count: "exact", head: true }).eq("role", "inspector")
    ]);
    [insights, notifications, managers, parents, staff, inspectors].forEach((res: any, index) => logSupabaseError(`smart engine audit ${index}`, res.error));
    const rows = (insights.data ?? []) as any[];
    return {
      rows,
      notificationCount: notifications.count ?? 0,
      roleCoverage: {
        manager: managers.count ?? 0,
        parent: parents.count ?? 0,
        staff: staff.count ?? 0,
        inspector: inspectors.count ?? 0,
        admin: 1
      },
      queryError: [insights, notifications].some((res: any) => res.error) ? "חלק מנתוני מנוע התובנות לא נטענו" : null
    };
  }, { rows: [] as any[], notificationCount: 0, roleCoverage: { manager: 0, parent: 0, staff: 0, inspector: 0, admin: 0 }, queryError: null as string | null });

  const rows = result.data.rows as any[];
  const activeRules = [
    "נוכחות חסרה",
    "ארוחה חסרה אחרי 13:00",
    "שינה חסרה אחרי 15:00",
    "פניית הורה מעל 4/24 שעות",
    "תשלום נכשל / באיחור",
    "מסמכים חסרים",
    "אירוע פתוח מעל 24 שעות",
    "פיקוח קרוב",
    "מצלמה לא מחוברת",
    "בקשת מעבר/ליד שממתינים"
  ];

  return (
    <DashboardShell role="admin" title="Smart Engine Audit">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Internal QA</p>
          <h1>אודיט מנוע תובנות חכמות.</h1>
          <p>בדיקה פנימית של חוקים פעילים, תובנות שנוצרו, מניעת ספאם בהתראות וכיסוי לפי תפקיד.</p>
        </div>
        <span className="pill good">Rule-based active</span>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />
      <section className="grid cols-4 dashboard-panels">
        <article className="card metric-card"><span>תובנות שנוצרו</span><strong>{rows.length}</strong></article>
        <article className="card metric-card"><span>התראות dedupe</span><strong>{result.data.notificationCount}</strong></article>
        <article className="card metric-card"><span>חוקים פעילים</span><strong>{activeRules.length}</strong></article>
        <article className="card metric-card"><span>חלון dedupe</span><strong>{smartThresholds.notificationDedupeHours}ש׳</strong></article>
      </section>
      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <h2>חוקים פעילים</h2>
          <div className="tag-cloud">{activeRules.map((rule) => <span key={rule}>{rule}</span>)}</div>
        </article>
        <article className="card action-panel">
          <h2>כיסוי תפקידים</h2>
          <div className="procedure-list">
            {Object.entries(result.data.roleCoverage).map(([role, count]) => <div className="list-item" key={role}><strong>{role}</strong><span>{count} משתמשים פוטנציאליים</span></div>)}
          </div>
        </article>
      </section>
      <section className="dashboard-section">
        <div className="section-heading"><h2>תובנות אחרונות</h2><p>סטטוס, חומרה וקטגוריה לפי התובנות שנשמרו.</p></div>
        {rows.length === 0 ? <div className="empty-state"><strong>עדיין אין תובנות שמורות</strong><span>כניסה לדשבורדים או לעוזר AI תיצור תובנות מבוססות נתונים.</span></div> : <div className="procedure-list">{rows.map((row) => <article className="card procedure-card" key={row.id}><div><span className={row.severity === "urgent" || row.severity === "critical" ? "pill bad" : row.severity === "warning" ? "pill warn" : "pill good"}>{row.severity}</span><h3>{row.category}</h3><p>{row.role} · {row.status}</p></div></article>)}</div>}
      </section>
    </DashboardShell>
  );
}
