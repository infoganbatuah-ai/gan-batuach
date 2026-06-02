import { DashboardShell } from "@/components/dashboard-shell";
import { CameraPlaybackCard } from "@/components/camera-playback-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function InspectorCamerasPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const gardensRes = await supabase.from("gardens" as any).select("id, name, city").eq("inspector_id", profile.id);
  const gardenIds = (gardensRes.data ?? []).map((garden: any) => garden.id);
  const camerasRes = gardenIds.length
    ? await supabase
        .from("camera_streams" as any)
        .select("id, garden_id, kindergarten_id, name, area, status, active, hls_playback_url, sample_hls_url, webrtc_playback_url, gateway_stream_id, video_gateway_stream_id, gardens(name, city)")
        .or(`garden_id.in.(${gardenIds.join(",")}),kindergarten_id.in.(${gardenIds.join(",")})`)
    : { data: [] };
  const seen = new Set<string>();
  const cameras = ((camerasRes.data ?? []) as any[]).filter((camera) => {
    if (seen.has(camera.id)) return false;
    seen.add(camera.id);
    return true;
  });
  return <DashboardShell role="inspector" title="מצלמות גנים"><div className="dashboard-hero-card"><div><p className="eyebrow">מצלמות משויכות</p><h1>תצפיתן דיגיטלי - צפייה במצלמות.</h1><p>רק מצלמות של גנים שהוקצו לך מוצגות כאן. פרטי חיבור טכניים אינם מוצגים במסך הצפייה.</p></div><span className="pill good">{gardenIds.length} גנים משויכים</span></div><section className="dashboard-section">{cameras.length === 0 ? <div className="empty-state"><strong>אין מצלמות בגנים המשויכים</strong><span>כאשר גן משויך יגדיר מצלמות, הן יופיעו כאן לצפייה מאובטחת.</span></div> : <div className="camera-playback-grid">{cameras.map((camera) => <CameraPlaybackCard camera={camera} parentView key={camera.id} />)}</div>}</section></DashboardShell>;
}
