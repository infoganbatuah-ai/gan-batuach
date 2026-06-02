import { DashboardShell } from "@/components/dashboard-shell";
import { InspectionReportView } from "@/components/inspection-report-view";
import { requireRole } from "@/lib/auth";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  return <DashboardShell role="admin" title="דוח פיקוח"><InspectionReportView id={id} role="admin" backHref="/dashboard/admin/inspections" /></DashboardShell>;
}
