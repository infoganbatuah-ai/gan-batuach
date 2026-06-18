import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { CameraAdminManager } from "@/components/camera-ai-admin-modules";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { Camera, CameraOff, Eye, Plus, ShieldCheck, Video } from "lucide-react";
import {
  TeacherActionTile,
  TeacherAiInsight,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

export default async function GardenCameraSetupPage({ searchParams }: { searchParams: Promise<{ filter?: string; camera?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const gardenId = profile.garden_id ?? "";
  const result = await safeAdminData("garden cameras", async () => {
    const supabase = await createClient();
    const [cameras, garden] = await Promise.all([
      supabase.from("camera_streams" as any).select("id, garden_id, kindergarten_id, name, area, camera_type, source_type,source_category,camera_zone_label,system_type,deployment_scope,test_site_type,camera_provider_key,gateway_provider_preference,live_preview_status,clip_readiness_status,snapshot_readiness_status,permission_model, stream_status, health_status, last_seen, connection_method, protocol, status, active, parent_view_allowed, parent_viewing_allowed,parent_visibility_status,parent_blocked_reason,staff_view_allowed,inspector_view_allowed,inspector_access_policy,observer_enabled,observer_review_required,observer_confidence_threshold, last_health_check_at, last_test_status, last_test_message, last_test_at, gateway_registration_status, gateway_last_error, masked_connection_summary, hls_playback_url, sample_hls_url, webrtc_playback_url, video_gateway_stream_id, gateway_stream_id, viewing_hours,operating_hours, recording_enabled, retention_days, archive_policy").eq("garden_id", gardenId),
      supabase.from("gardens" as any).select("id, name, city").eq("id", gardenId).maybeSingle()
    ]);
    logSupabaseError("garden cameras", cameras.error); logSupabaseError("garden camera garden", garden.error);
    const rawCameras = (cameras.data ?? []) as any[];
    const filtered = rawCameras.filter((camera) => {
      if (params.filter === "offline" || params.filter === "issues" || params.camera === "issue") return !camera.active || !["online", "connected"].includes(camera.status);
      if (params.filter === "pending") return camera.status === "pending_gateway";
      return true;
    });
    return { cameras: filtered, gardens: garden.data ? [garden.data] : [], queryError: cameras.error || garden.error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { cameras: [] as any[], gardens: [] as any[], queryError: null as string | null });
  const filterLabel = params.filter === "offline" || params.filter === "issues" || params.camera === "issue" ? "מצלמות לא מחוברות" : params.filter === "pending" ? "מצלמות שממתינות לחיבור" : null;
  const cameras = result.data.cameras as any[];
  const online = cameras.filter((camera) => camera.active && ["online", "connected"].includes(camera.status)).length;
  const issues = cameras.filter((camera) => !camera.active || !["online", "connected"].includes(camera.status)).length;
  const parentAllowed = cameras.filter((camera) => camera.parent_view_allowed || camera.parent_viewing_allowed).length;
  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="מצלמות" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "מאיה"}`} subtitle="אזור מצלמות גננת" avatarUrl={(profile as any).avatar_url ?? null} active="more">
        <TeacherPageTitle icon={Camera} title="אזור מצלמות" subtitle="צפייה, חיבור והרשאות צפייה בטוחות" action={<a className="button primary" href="/dashboard/garden/cameras?add=1"><Plus size={18} /> הוספת מצלמה</a>} />
        <TeacherStatsGrid>
          <TeacherStatCard title="מצלמות" value={cameras.length} hint="בגן" icon={Video} tone="blue" />
          <TeacherStatCard title="מחוברות" value={online} hint="פעילות" icon={ShieldCheck} tone="green" />
          <TeacherStatCard title="דורשות טיפול" value={issues} hint="בדיקה" icon={CameraOff} tone={issues ? "red" : "green"} href="/dashboard/garden/cameras?filter=issues" />
          <TeacherStatCard title="צפיית הורים" value={parentAllowed} hint="מאושרות" icon={Eye} tone="purple" />
        </TeacherStatsGrid>
        <DashboardFilterChip label={filterLabel} clearHref="/dashboard/garden/cameras" isEmpty={cameras.length === 0} emptyTitle={filterLabel ? `אין כרגע ${filterLabel}` : undefined} emptyText="כל המצלמות במסנן הזה תקינות או שאין מצלמות מתאימות." />
        <AdminDataError message={result.error ?? result.data.queryError} />

        <TeacherSection title="מצלמות הגן" subtitle={process.env.VIDEO_GATEWAY_URL ? "Gateway מחובר" : "ממתין לחיבור Gateway"}>
          {cameras.length ? (
            <TeacherCompactList>
              {cameras.slice(0, 8).map((camera) => (
                <TeacherCompactItem key={camera.id} title={camera.name ?? camera.area ?? "מצלמה"} subtitle={`${camera.area ?? "אזור לא צוין"} · ${camera.masked_connection_summary ?? camera.protocol ?? "חיבור מוסתר"}`} tone={camera.active && ["online", "connected"].includes(camera.status) ? "green" : "orange"} meta={camera.status ?? "ממתין"} />
              ))}
            </TeacherCompactList>
          ) : <TeacherEmptyState title="עדיין אין מצלמות מחוברות" text="אפשר להכין חיבור מצלמה בלי לחשוף כתובת RTSP או סיסמאות בדפדפן." />}
        </TeacherSection>

        <TeacherQuickActions title="פעולות מצלמה">
          <TeacherActionTile title="הוספת מצלמה" href="/dashboard/garden/cameras?add=1" icon={Plus} tone="purple" />
          <TeacherActionTile title="מצלמות תקולות" href="/dashboard/garden/cameras?filter=issues" icon={CameraOff} tone="orange" />
          <TeacherActionTile title="הרשאות צפייה" href="/dashboard/garden/camera-health" icon={ShieldCheck} tone="green" />
        </TeacherQuickActions>

        <TeacherAiInsight>
          אין חשיפת RTSP או סיסמאות במסך הגננת. צפייה להורים נפתחת רק לפי מדיניות והרשאה.
        </TeacherAiInsight>

        <details className="teacher-management-details">
          <summary>ניהול מצלמות מלא</summary>
          <CameraAdminManager cameras={cameras} gardens={result.data.gardens as any[]} gatewayConnected={Boolean(process.env.VIDEO_GATEWAY_URL)} />
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
