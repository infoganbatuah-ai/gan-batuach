import { CameraPlaybackCard } from "@/components/camera-playback-card";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffCamerasPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const camerasRes = await supabase
    .from("camera_streams" as any)
    .select("id, garden_id, kindergarten_id, name, area, camera_type, source_type, protocol, status, active, parent_view_allowed, parent_viewing_allowed, hls_playback_url, sample_hls_url, webrtc_playback_url, last_health_check_at, gardens(name, city)")
    .eq("garden_id", gardenId)
    .eq("active", true);
  const cameras = (camerasRes.data ?? []) as any[];
  return (
    <DashboardShell role="staff" title="מצלמות צוות">
      <div className="dashboard-hero-card staff-hero-card">
        <div><p className="eyebrow">Staff scoped cameras</p><h1>תצפיתן דיגיטלי - צפייה במצלמות.</h1><p>צוות רואה רק מצלמות של הגן המשויך אליו. אין חשיפה ל־RTSP או סיסמאות.</p></div>
        <span className="pill good">גן משויך בלבד</span>
      </div>
      <section className="dashboard-section">
        {cameras.length === 0 ? <div className="empty-state"><strong>אין מצלמות זמינות לצוות</strong><span>כאשר מנהלת הגן תגדיר מצלמה פעילה, היא תופיע כאן לצפייה מאובטחת.</span></div> : <div className="camera-playback-grid">{cameras.map((camera) => <CameraPlaybackCard camera={camera} key={camera.id} />)}</div>}
      </section>
    </DashboardShell>
  );
}
