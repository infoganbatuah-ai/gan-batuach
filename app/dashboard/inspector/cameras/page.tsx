import { DashboardShell } from "@/components/dashboard-shell";
import { CameraAdminManager } from "@/components/camera-ai-admin-modules";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function InspectorCamerasPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const gardensRes = await supabase.from("gardens" as any).select("id, name, city").eq("inspector_id", profile.id);
  const gardenIds = (gardensRes.data ?? []).map((garden: any) => garden.id);
  const camerasRes = gardenIds.length ? await supabase.from("camera_streams" as any).select("id, garden_id, name, area, camera_type, protocol, status, active, parent_view_allowed, ai_enabled, last_health_check_at, gardens(name, city)").in("garden_id", gardenIds) : { data: [] };
  return <DashboardShell role="inspector" title="מצלמות גנים"><div className="dashboard-hero-card"><div><p className="eyebrow">Inspector scoped cameras</p><h1>מצלמות בגנים המשויכים אליך בלבד.</h1><p>המערכת מסננת לפי גנים שהוקצו לפקח. אין גישה לגנים אחרים.</p></div><span className="pill good">Scoped</span></div><CameraAdminManager cameras={(camerasRes.data ?? []) as any[]} gardens={(gardensRes.data ?? []) as any[]} gatewayConnected={Boolean(process.env.VIDEO_GATEWAY_URL)} /></DashboardShell>;
}
