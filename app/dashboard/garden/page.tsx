import { DashboardShell } from "@/components/dashboard-shell";
import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenDashboard() {
  const { profile } = await requireRole(["manager"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id;
  const [{ count: children }, { count: staff }, { count: tasks }, { data: pendingChildren }] = await Promise.all([
    supabase.from("children").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? ""),
    supabase.from("staff").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? ""),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? ""),
    supabase.from("children").select("full_name, status, parent_completed").eq("garden_id", gardenId ?? "").limit(10)
  ]);

  return (
    <DashboardShell role="manager" title="ממשק גננת / מנהל גן">
      <p className="eyebrow">ניהול גן</p>
      <h1>תפעול יומי</h1>
      <div className="grid cols-3">
        <StatCard label="תלמידים" value={children ?? 0} />
        <StatCard label="צוות" value={staff ?? 0} />
        <StatCard label="משימות" value={tasks ?? 0} tone="warn" />
      </div>
      <DataTable
        headers={["ילד", "סטטוס", "הורה השלים פרטים"]}
        rows={(pendingChildren ?? []).map((child) => [child.full_name, <span className="pill">{child.status}</span>, child.parent_completed ? "כן" : "לא"])}
      />
    </DashboardShell>
  );
}
