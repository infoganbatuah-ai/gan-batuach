import { DashboardShell } from "@/components/dashboard-shell";
import { ReportsCenter } from "@/components/reports-center";
import { requireRole } from "@/lib/auth";

export default async function ParentReportsPage() {
  const { profile } = await requireRole(["parent"]);
  return (
    <DashboardShell role="parent" title="הדוחות שלי" appHome>
      <div className="page-header">
        <div><h1>הדוחות שלי</h1><p>סיכומים רק עבור הילדים שהקשר ההורי אליהם פעיל ומורשה.</p></div>
      </div>
      <ReportsCenter role="parent" gardenId={profile.garden_id} />
    </DashboardShell>
  );
}
