import { Camera, ShieldCheck } from "lucide-react";
import { CameraPlaybackCard } from "@/components/camera-playback-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InspectorAppFrame, InspectorEmpty, InspectorHero, InspectorMetricCard, InspectorMetricGrid, InspectorSection } from "@/components/inspector-app-ui";

export default async function InspectorCamerasPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, gardensRes] = await Promise.all([
    supabase.from("inspectors" as any).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens" as any).select("id, name, city").eq("inspector_id", profile.id)
  ]);
  const gardenIds = (gardensRes.data ?? []).map((garden: any) => garden.id);
  const camerasRes = gardenIds.length
    ? await supabase
        .from("camera_streams" as any)
        .select("id, garden_id, kindergarten_id, name, area, status, active, inspector_view_allowed, inspector_access_policy, hls_playback_url, sample_hls_url, webrtc_playback_url, gateway_stream_id, video_gateway_stream_id, gardens(name, city)")
        .or(`garden_id.in.(${gardenIds.join(",")}),kindergarten_id.in.(${gardenIds.join(",")})`)
    : { data: [] };
  const seen = new Set<string>();
  const cameras = ((camerasRes.data ?? []) as any[]).filter((camera) => {
    if (seen.has(camera.id)) return false;
    seen.add(camera.id);
    return true;
  });
  const allowed = cameras.filter((camera) => camera.inspector_view_allowed !== false);
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as any)?.profile_photo_url ?? profile.profile_image_url };

  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/control-center" title="מצלמות גנים" subtitle="צפייה לצורכי פיקוח בלבד" badge="מצלמות">
      <InspectorHero eyebrow="גישה מבוקרת" title="גלריית מצלמות בגנים המשויכים" subtitle="רק מצלמות של גנים שהוקצו לך מוצגות כאן. כל פתיחת צפייה דורשת סיבה ונרשמת ביומן." artwork={<Camera />} />
      <InspectorMetricGrid columns={3}>
        <InspectorMetricCard label="גנים משויכים" value={gardenIds.length} hint="טווח הרשאה" icon={ShieldCheck} />
        <InspectorMetricCard label="מצלמות" value={cameras.length} hint="נמצאו" icon={Camera} />
        <InspectorMetricCard label="מותרות לצפייה" value={allowed.length} hint="לפי מדיניות" icon={Camera} tone="success" />
      </InspectorMetricGrid>
      <InspectorSection title="גלריית מצלמות" subtitle="אין חשיפת פרטי חיבור בדפדפן" icon={Camera}>
        {allowed.length === 0 ? (
          <InspectorEmpty title="אין מצלמות בגנים המשויכים" text="כאשר גן משויך יגדיר מצלמות מאושרות לפיקוח, הן יופיעו כאן לצפייה מאובטחת." icon={Camera} />
        ) : (
          <div className="camera-playback-grid">
            {allowed.map((camera) => <CameraPlaybackCard camera={camera} accessReason="בדיקת פיקוח/ציות בגן משויך" safeDetails key={camera.id} />)}
          </div>
        )}
      </InspectorSection>
    </InspectorAppFrame>
  );
}
