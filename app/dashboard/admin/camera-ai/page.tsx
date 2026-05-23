import { DashboardShell } from "@/components/dashboard-shell";
import { CameraAiWizard } from "@/components/camera-ai-wizard";
import { requireRole } from "@/lib/auth";

export default async function AdminCameraAiPage() {
  await requireRole(["admin"]);
  return <DashboardShell role="admin" title="מצלמות ו-AI"><CameraAiWizard gatewayConnected={Boolean(process.env.VIDEO_GATEWAY_URL)} roleLabel="אדמין" /></DashboardShell>;
}
