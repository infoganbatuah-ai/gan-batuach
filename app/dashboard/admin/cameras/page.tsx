import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { CameraAdminManager } from "@/components/camera-ai-admin-modules";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { buildCameraAuditSummary } from "@/lib/domain/camera-diagnostics";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminCamerasPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin cameras", async () => {
    const supabase = await createClient();
    const safeCameraColumns = "id, garden_id, kindergarten_id, name, area, camera_type, source_type, stream_status, health_status, last_seen, connection_method, protocol, status, active, parent_view_allowed, parent_viewing_allowed, last_health_check_at, hls_playback_url, sample_hls_url, webrtc_playback_url, video_gateway_stream_id, gateway_stream_id, viewing_hours, recording_enabled, retention_days, archive_policy, is_demo, demo_batch_id";
    let cameras = await supabase.from("camera_streams" as any).select(safeCameraColumns).limit(100);
    let secondaryWarning: string | null = null;

    if (cameras.error) {
      logSupabaseError("admin cameras primary safe columns", cameras.error);
      secondaryWarning = "חלק מהנתונים המשניים לא נטענו";
      cameras = await supabase.from("camera_streams" as any).select("id, garden_id, name, area, camera_type, protocol, status, active, parent_view_allowed, last_health_check_at, hls_playback_url, webrtc_playback_url, video_gateway_stream_id, viewing_hours").limit(100);
    }

    if (cameras.error) {
      logSupabaseError("admin cameras fallback direct query", cameras.error);
      return { cameras: [] as any[], gardens: [] as any[], queryError: "לא ניתן לטעון את הנתונים כרגע", secondaryWarning: null as string | null };
    }

    const gardens = await supabase.from("gardens" as any).select("id, name, city").limit(200);
    logSupabaseError("admin camera gardens secondary query", gardens.error);
    if (gardens.error) secondaryWarning = "חלק מהנתונים המשניים לא נטענו";
    const cameraGardenIds = Array.from(new Set(((cameras.data ?? []) as any[]).map((camera) => camera.garden_id ?? camera.kindergarten_id).filter(Boolean)));
    const childrenByGardenId = cameraGardenIds.length ? await supabase.from("children" as any).select("garden_id, kindergarten_id, primary_parent_id").in("garden_id", cameraGardenIds) : { data: [] };
    const childrenByKindergartenId = cameraGardenIds.length ? await supabase.from("children" as any).select("garden_id, kindergarten_id, primary_parent_id").in("kindergarten_id", cameraGardenIds) : { data: [] };
    const parentsByGardenId = cameraGardenIds.length ? await supabase.from("parents" as any).select("id, garden_id").in("garden_id", cameraGardenIds) : { data: [] };
    const parentsByKindergartenId = cameraGardenIds.length ? await supabase.from("parents" as any).select("id, kindergarten_id").in("kindergarten_id", cameraGardenIds) : { data: [] };
    logSupabaseError("admin camera expected parents garden_id", (childrenByGardenId as any).error);
    logSupabaseError("admin camera expected parents kindergarten_id", (childrenByKindergartenId as any).error);
    logSupabaseError("admin camera expected direct parents garden_id", (parentsByGardenId as any).error);
    logSupabaseError("admin camera expected direct parents kindergarten_id", (parentsByKindergartenId as any).error);
    if ((childrenByGardenId as any).error || (childrenByKindergartenId as any).error || (parentsByGardenId as any).error || (parentsByKindergartenId as any).error) secondaryWarning = "חלק מהנתונים המשניים לא נטענו";
    const expectedParentsByGarden = new Map<string, Set<string>>();
    const childRows = [...(((childrenByGardenId as any).data ?? []) as any[]), ...(((childrenByKindergartenId as any).data ?? []) as any[])]
      .filter((child, index, all) => child?.primary_parent_id && all.findIndex((item) => item?.primary_parent_id === child.primary_parent_id && (item?.garden_id ?? item?.kindergarten_id) === (child.garden_id ?? child.kindergarten_id)) === index);
    for (const child of childRows) {
      const gardenId = child.garden_id ?? child.kindergarten_id;
      if (!gardenId || !child.primary_parent_id) continue;
      const set = expectedParentsByGarden.get(gardenId) ?? new Set<string>();
      set.add(child.primary_parent_id);
      expectedParentsByGarden.set(gardenId, set);
    }
    const directParentRows = [...(((parentsByGardenId as any).data ?? []) as any[]), ...(((parentsByKindergartenId as any).data ?? []) as any[])]
      .filter((parent, index, all) => parent?.id && all.findIndex((item) => item?.id === parent.id) === index);
    for (const parent of directParentRows) {
      const gardenId = parent.garden_id ?? parent.kindergarten_id;
      if (!gardenId || !parent.id) continue;
      const set = expectedParentsByGarden.get(gardenId) ?? new Set<string>();
      set.add(parent.id);
      expectedParentsByGarden.set(gardenId, set);
    }

    const gardenById = new Map((gardens.data ?? []).map((garden: any) => [garden.id, garden]));
    const cameraRows = (cameras.data ?? []).map((camera: any) => {
      const gardenId = camera.garden_id ?? camera.kindergarten_id;
      const parentViewing = camera.parent_viewing_allowed === true || camera.parent_view_allowed === true;
      return { ...camera, gardens: gardenById.get(gardenId) ?? null, expected_parent_count: expectedParentsByGarden.get(gardenId)?.size ?? 0, visibility_status: parentViewing ? "גלויה להורים משויכים" : "צפיית הורים כבויה" };
    });
    return {
      cameras: cameraRows,
      gardens: gardens.data ?? [],
      queryError: null as string | null,
      secondaryWarning,
      summary: buildCameraAuditSummary(cameraRows)
    };
  }, { cameras: [] as any[], gardens: [] as any[], queryError: null as string | null, secondaryWarning: null as string | null, summary: buildCameraAuditSummary([]) });

  const summary = result.data.summary ?? buildCameraAuditSummary([]);
  return <DashboardShell role="admin" title="מצלמות"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Camera Management</p><h1>תצפיתן דיגיטלי - צפייה במצלמות.</h1><p>DVR/NVR/IP/RTSP/ONVIF נשמרים במערכת, Live דורש Video Gateway או Sample HLS לבדיקה.</p></div><div className="profile-actions"><span className={process.env.VIDEO_GATEWAY_URL ? "pill good" : "pill warn"}>{process.env.VIDEO_GATEWAY_URL ? "Gateway connected" : "Gateway missing"}</span><Link className="button secondary" href="/dashboard/admin/camera-audit">Camera Audit</Link></div></div><AdminDataError message={result.error ?? result.data.queryError} /><section className="grid cols-4 dashboard-panels"><article className="card metric-card"><span>מצלמות פעילות</span><strong>{summary.online}</strong></article><article className="card metric-card"><span>אופליין / תקלה</span><strong>{summary.offline}</strong></article><article className="card metric-card"><span>חסר מקור צפייה</span><strong>{summary.missingPlaybackSource}</strong></article><article className="card metric-card"><span>מצלמות דמו</span><strong>{summary.demo}</strong></article></section>{result.data.secondaryWarning ? <div className="gateway-setup-state"><strong>{result.data.secondaryWarning}</strong><p>כרטיסי המצלמות והצפייה נשארים זמינים. פרטי גן/יחסים משניים נטענים בנפרד כדי לא להפיל את המסך.</p></div> : null}<CameraAdminManager cameras={result.data.cameras as any[]} gardens={result.data.gardens as any[]} gatewayConnected={Boolean(process.env.VIDEO_GATEWAY_URL)} /></DashboardShell>;
}
