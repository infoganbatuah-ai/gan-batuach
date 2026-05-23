import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";

export default async function ParentDashboard() {
  await requireRole(["parent"]);
  return (
    <DashboardShell role="parent" title="אזור הורים">
      <p className="eyebrow">הורה</p>
      <h1>ילדים, נוכחות, הודעות, תלונות וצפייה מורשית</h1>
      <div className="grid cols-3">
        <StatCard label="כרטיס ילד" value="פעיל" tone="good" />
        <StatCard label="נוכחות היום" value="API" />
        <StatCard label="מצלמות מורשות" value="Token" />
      </div>
    </DashboardShell>
  );
}
