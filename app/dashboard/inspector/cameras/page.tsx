import { DashboardShell } from "@/components/dashboard-shell";
import { CameraPlaybackCard } from "@/components/camera-playback-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function InspectorCamerasPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const gardensRes = await supabase.from("gardens" as any).select("id, name, city").eq("inspector_id", profile.id);
  const gardenIds = (gardensRes.data ?? []).map((garden: any) => garden.id);
  const camerasRes = gardenIds.length ? await supabase.from("camera_streams" as any).select("id, garden_id, name, area, camera_type, protocol, status, active, parent_view_allowed, hls_playback_url, webrtc_playback_url, last_health_check_at, gardens(name, city)").in("garden_id", gardenIds) : { data: [] };
  const cameras = (camerasRes.data ?? []) as any[];
  return <DashboardShell role="inspector" title="מצלמות גנים"><div className="dashboard-hero-card"><div><p className="eyebrow">Inspector scoped cameras</p><h1>תצפיתן דיגיטלי - צפייה במצלמות.</h1><p>המערכת מסננת לפי גנים שהוקצו לפקח. אין גישה לגנים אחרים.</p></div><span className="pill good">Scoped</span></div><section className="dashboard-section">{cameras.length === 0 ? <div className="empty-state"><strong>אין מצלמות בגנים המשויכים</strong><span>כאשר גן משויך יגדיר מצלמות, הן יופיעו כאן לצפייה מאובטחת.</span></div> : <div className="camera-playback-grid">{cameras.map((camera) => <CameraPlaybackCard camera={camera} key={camera.id} />)}</div>}</section></DashboardShell>;
}
