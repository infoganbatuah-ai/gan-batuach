import { DashboardShell } from "@/components/dashboard-shell";
import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function InspectorDashboard() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const { data: inspections } = await supabase
    .from("inspections")
    .select("id, status, weighted_score, completed_at, gardens(name, city)")
    .eq("inspector_id", profile.id)
    .limit(20);

  return (
    <DashboardShell role="inspector" title="דשבורד פקח">
      <p className="eyebrow">פיקוח חודשי</p>
      <h1>ביקורות ומשימות פקח</h1>
      <div className="grid cols-3">
        <StatCard label="ביקורות פתוחות" value={(inspections ?? []).filter((item) => item.status !== "done").length} />
        <StatCard label="ביקורות שבוצעו" value={(inspections ?? []).filter((item) => item.status === "done").length} tone="good" />
        <StatCard label="ממוצע אחרון" value={String((inspections ?? [])[0]?.weighted_score ?? "-")} />
      </div>
      <DataTable
        headers={["גן", "עיר", "סטטוס", "ציון"]}
        rows={(inspections ?? []).map((inspection: any) => [inspection.gardens?.name, inspection.gardens?.city, <span className="pill">{inspection.status}</span>, inspection.weighted_score ?? "-"])}
      />
    </DashboardShell>
  );
}
