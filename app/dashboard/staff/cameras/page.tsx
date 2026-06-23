import { CameraPlaybackCard } from "@/components/camera-playback-card";
import { Camera, ShieldCheck } from "lucide-react";
import { CameraPreviewCard, StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffEmpty, StaffPageHero, StaffSection } from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffCamerasPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  if (!gardenId) {
    return (
      <StaffAppFrame active="home" mode="candidate">
        <StaffPageHero
          eyebrow="מצלמות צוות"
          title="מצלמות ייפתחו רק אחרי שיוך לגן"
          text="לפני אישור ושיוך אין גישה למצלמות, למיקומים פנימיים או למידע תפעולי של גן."
          icon={Camera}
          badge={<StatusChip tone="warning" icon={ShieldCheck}>ממתין לשיוך</StatusChip>}
        />
        <StaffSection title="אין גישה למצלמות">
          <StaffEmpty title="עדיין לא שובצת לגן" text="כאשר מנהלת תאשר את השיוך, יוצגו רק מצלמות שאושרו לצפיית צוות." icon={Camera} />
        </StaffSection>
      </StaffAppFrame>
    );
  }
  const camerasRes = await supabase
    .from("camera_streams" as any)
    .select("id, garden_id, kindergarten_id, name, area, camera_type, source_type, protocol, status, active, staff_view_allowed, hls_playback_url, sample_hls_url, webrtc_playback_url, gateway_stream_id, video_gateway_stream_id, last_health_check_at, gardens(name, city)")
    .eq("garden_id", gardenId)
    .eq("active", true)
    .eq("staff_view_allowed", true);
  const cameras = (camerasRes.data ?? []) as any[];
  const hasPlaybackSource = (camera: any) => Boolean(camera.hls_playback_url || camera.sample_hls_url || camera.webrtc_playback_url || camera.gateway_stream_id || camera.video_gateway_stream_id);
  const statusLabel: Record<string, string> = {
    online: "זמינה",
    connected: "זמינה",
    pending_gateway: "ממתינה לחיבור",
    offline: "לא זמינה",
    disabled: "כבויה",
    error: "תקלה"
  };
  return (
    <StaffAppFrame active="more">
      <StaffPageHero
        eyebrow="מצלמות צוות"
        title="צפייה במצלמות המאושרות לצוות"
        text="צוות רואה רק מצלמות של הגן המשויך אליו, ורק אם מנהלת הגן אישרה צפייה."
        icon={Camera}
        badge={<StatusChip tone="success" icon={ShieldCheck}>גן משויך בלבד</StatusChip>}
      />
      <StaffSection title="גלריית מצלמות">
        {cameras.length === 0 ? (
          <StaffEmpty title="אין מצלמות זמינות לצוות" text="צפיית צוות נפתחת רק אם מנהלת הגן אישרה זאת. כל צפייה מתועדת." icon={Camera} />
        ) : (
          <div className="camera-playback-grid">
            {cameras.map((camera) => (
              <CameraPreviewCard
                key={camera.id}
                title={camera.name}
                subtitle={`${camera.area ?? "אזור לא צוין"} · ${camera.gardens?.name ?? "גן"}`}
                live={(camera.status === "online" || camera.status === "connected") && hasPlaybackSource(camera)}
                status={<StatusChip tone={(camera.status === "online" || camera.status === "connected") && hasPlaybackSource(camera) ? "success" : "warning"}>{statusLabel[camera.status] ?? "ממתינה"}</StatusChip>}
                action={<CameraPlaybackCard camera={camera} accessReason="צפיית צוות מורשית" safeDetails />}
              />
            ))}
          </div>
        )}
      </StaffSection>
    </StaffAppFrame>
  );
}
