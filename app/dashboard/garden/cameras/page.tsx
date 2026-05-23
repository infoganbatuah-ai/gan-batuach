import { DashboardShell } from "@/components/dashboard-shell";
import { CameraAiWizard } from "@/components/camera-ai-wizard";
import { requireRole } from "@/lib/auth";

export default async function CameraSetupWizardPage() {
  await requireRole(["manager", "owner"]);
  return <DashboardShell role="manager" title="מצלמות ו-AI"><CameraAiWizard gatewayConnected={Boolean(process.env.VIDEO_GATEWAY_URL)} roleLabel="מנהלת הגן" /></DashboardShell>;
}
