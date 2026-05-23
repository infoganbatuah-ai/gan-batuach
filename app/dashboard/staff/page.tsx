import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";

export default async function StaffDashboard() {
  await requireRole(["staff"]);
  return (
    <DashboardShell role="staff" title="ממשק צוות">
      <p className="eyebrow">צוות גן</p>
      <h1>נוכחות, הודעות ומשימות</h1>
      <div className="grid cols-3">
        <StatCard label="כניסה לעבודה" value="GPS" />
        <StatCard label="משימות פתוחות" value="API" />
        <StatCard label="הודעות" value="API" />
      </div>
    </DashboardShell>
  );
}
