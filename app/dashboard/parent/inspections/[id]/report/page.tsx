import { DashboardShell } from "@/components/dashboard-shell";
import { InspectionReportView } from "@/components/inspection-report-view";
import { requireRole } from "@/lib/auth";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["parent"]);
  const { id } = await params;
  return <DashboardShell role="parent" title="דוח פיקוח"><InspectionReportView id={id} role="parent" backHref="/dashboard/parent/inspections" /></DashboardShell>;
}
