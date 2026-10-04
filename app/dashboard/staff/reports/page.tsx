import { DashboardShell } from "@/components/dashboard-shell";
import { ReportsCenter } from "@/components/reports-center";
import { requireOperationalRole } from "@/lib/management/operational-role";

export default async function StaffReportsPage() {
  const { profile } = await requireOperationalRole(["staff"]);
  return (
    <DashboardShell role="staff" title="הדוחות שלי" appHome>
      <div className="page-header">
        <div><h1>הדוחות שלי</h1><p>שעות, משמרות ומשימות אישיות בהקשר הגן הפעיל.</p></div>
      </div>
      <ReportsCenter role="staff" gardenId={profile.garden_id} />
    </DashboardShell>
  );
}
