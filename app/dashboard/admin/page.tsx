import { DashboardShell } from "@/components/dashboard-shell";
import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const [{ count: gardens }, { count: leads }, { count: complaints }, { count: violations }] = await Promise.all([
    supabase.from("gardens").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("complaints").select("*", { count: "exact", head: true }),
    supabase.from("violations").select("*", { count: "exact", head: true })
  ]);
  const { data: recentGardens } = await supabase.from("gardens").select("name, city, status, safe_status").limit(8);
  const { data: redViolations } = await supabase
    .from("violations")
    .select("title, category, severity, status, score, correction_due_at, gardens(name, city)")
    .neq("status", "done")
    .order("created_at", { ascending: false })
    .limit(10);
  const { data: unsafeGardens } = await supabase.from("unsafe_gardens" as any).select("name, city, last_inspection_score, safe_status, open_violations_count").limit(10);
  const { data: aiAlerts } = await supabase
    .from("ai_alerts")
    .select("title, body, recipient_role, created_at, ai_events(event_type, severity)")
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <DashboardShell role="admin" title="אדמין ראשי">
      <p className="eyebrow">מרכז שליטה</p>
      <h1>תמונת מצב ארצית</h1>
      <div className="grid cols-4">
        <StatCard label="גנים" value={gardens ?? 0} />
        <StatCard label="לידים" value={leads ?? 0} />
        <StatCard label="תלונות" value={complaints ?? 0} tone="warn" />
        <StatCard label="ליקויים" value={violations ?? 0} tone="bad" />
      </div>
      <h2>גנים אחרונים</h2>
      <DataTable
        headers={["גן", "עיר", "סטטוס", "גן בטוח"]}
        rows={(recentGardens ?? []).map((garden) => [garden.name, garden.city, <span className="pill">{garden.status}</span>, <span className="pill">{garden.safe_status}</span>])}
      />
      <h2>רשימת ליקויים אדומה</h2>
      <DataTable
        headers={["גן", "עיר", "ליקוי", "קטגוריה", "ציון", "חומרה", "יעד תיקון"]}
        rows={(redViolations ?? []).map((violation: any) => [
          violation.gardens?.name,
          violation.gardens?.city,
          violation.title,
          violation.category,
          violation.score ?? "-",
          <span className="pill bad">{violation.severity}</span>,
          violation.correction_due_at ? new Date(violation.correction_due_at).toLocaleDateString("he-IL") : "-"
        ])}
      />
      <h2>גנים לא בטוחים / דורשים תיקון</h2>
      <DataTable
        headers={["גן", "עיר", "ציון אחרון", "סטטוס", "ליקויים פתוחים"]}
        rows={((unsafeGardens as any[]) ?? []).map((garden) => [
          garden.name,
          garden.city,
          garden.last_inspection_score ?? "-",
          <span className="pill bad">{garden.safe_status}</span>,
          garden.open_violations_count
        ])}
      />
      <h2>התראות AI אחרונות</h2>
      <DataTable
        headers={["התראה", "אירוע", "חומרה", "נמען", "זמן"]}
        rows={(aiAlerts ?? []).map((alert: any) => [
          alert.title,
          alert.ai_events?.event_type ?? alert.body,
          <span className="pill bad">{alert.ai_events?.severity ?? "-"}</span>,
          alert.recipient_role,
          new Date(alert.created_at).toLocaleString("he-IL")
        ])}
      />
    </DashboardShell>
  );
}
