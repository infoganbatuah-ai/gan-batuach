import { DashboardShell } from "@/components/dashboard-shell";
import { InspectionReportView } from "@/components/inspection-report-view";
import { requireRole } from "@/lib/auth";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["manager", "owner"]);
  const { id } = await params;
  return <DashboardShell role="manager" title="דוח פיקוח"><InspectionReportView id={id} role="garden" backHref="/dashboard/garden/inspections" /></DashboardShell>;
}
