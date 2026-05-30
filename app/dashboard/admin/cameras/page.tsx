import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { CameraAdminManager } from "@/components/camera-ai-admin-modules";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function AdminCamerasPage() {
  await requireRole(["admin"]);
  const debugAllowedGardenId = "825b4b81-6838-46df-9d11-6c8c167b1b8d";
  const result = await safeAdminData("admin cameras", async () => {
    const supabase = await createClient();
    const safeCameraColumns = "id, garden_id, kindergarten_id, name, area, camera_type, source_type, protocol, status, active, parent_view_allowed, parent_viewing_allowed, last_health_check_at, hls_playback_url, sample_hls_url, webrtc_playback_url, video_gateway_stream_id, gateway_stream_id, viewing_hours";
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
    const debugGardenIdMatches = cameraRows.filter((camera: any) => camera.garden_id === debugAllowedGardenId);
    const debugKindergartenIdMatches = cameraRows.filter((camera: any) => camera.kindergarten_id === debugAllowedGardenId);
    console.info("Admin cameras loaded", {
      count: cameraRows.length,
      secondaryWarning: Boolean(secondaryWarning),
      debugAllowedGardenId,
      gardenIdQueryReturned: debugGardenIdMatches.length,
      kindergartenIdQueryReturned: debugKindergartenIdMatches.length,
      rawCameraValues: cameraRows.map((camera: any) => ({
        id: camera.id,
        name: camera.name,
        garden_id: camera.garden_id,
        kindergarten_id: camera.kindergarten_id,
        active: camera.active,
        status: camera.status
      }))
    });

    return {
      cameras: cameraRows,
      gardens: gardens.data ?? [],
      queryError: null as string | null,
      secondaryWarning,
      debugAllowedGardenId,
      debugGardenIdMatches,
      debugKindergartenIdMatches
    };
  }, { cameras: [] as any[], gardens: [] as any[], queryError: null as string | null, secondaryWarning: null as string | null, debugAllowedGardenId, debugGardenIdMatches: [] as any[], debugKindergartenIdMatches: [] as any[] });

  const showDebugPanel = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SANDBOX_MODE === "true";
  return <DashboardShell role="admin" title="מצלמות"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Camera Management</p><h1>תצפיתן דיגיטלי - צפייה במצלמות.</h1><p>DVR/NVR/IP/RTSP/ONVIF נשמרים במערכת, Live דורש Video Gateway או Sample HLS לבדיקה.</p></div><span className={process.env.VIDEO_GATEWAY_URL ? "pill good" : "pill warn"}>{process.env.VIDEO_GATEWAY_URL ? "Gateway connected" : "Gateway missing"}</span></div><AdminDataError message={result.error ?? result.data.queryError} />{showDebugPanel ? <div className="gateway-setup-state"><strong>Cameras loaded: {(result.data.cameras as any[]).length}</strong><p>Debug panel visible only in development/sandbox.</p></div> : null}<section className="dashboard-section"><article className="card camera-debug-card"><div className="section-heading"><h2>אבחון זמני - ערכי מצלמות במסד</h2><p>השוואה מול Allowed kindergarten id: {result.data.debugAllowedGardenId}</p></div><div className="access-debug-grid"><span>garden_id query returned: {(result.data.debugGardenIdMatches as any[]).length}</span><span>garden_id camera ids: {(result.data.debugGardenIdMatches as any[]).map((camera: any) => camera.id).join(", ") || "-"}</span><span>kindergarten_id query returned: {(result.data.debugKindergartenIdMatches as any[]).length}</span><span>kindergarten_id camera ids: {(result.data.debugKindergartenIdMatches as any[]).map((camera: any) => camera.id).join(", ") || "-"}</span></div>{(result.data.cameras as any[]).length === 0 ? <div className="empty-mini">אין מצלמות בטבלת camera_streams לפי שאילתת האדמין.</div> : (result.data.cameras as any[]).map((camera: any) => <article className="camera-debug-row" key={camera.id}><strong>{camera.name ?? "מצלמה ללא שם"}</strong><div className="access-debug-grid"><span>camera id: {camera.id}</span><span>camera name: {camera.name ?? "-"}</span><span>garden_id: {camera.garden_id ?? "-"}</span><span>kindergarten_id: {camera.kindergarten_id ?? "-"}</span><span>active: {String(camera.active)}</span><span>status: {camera.status ?? "-"}</span><span>matches allowed garden_id: {String(camera.garden_id === result.data.debugAllowedGardenId)}</span><span>matches allowed kindergarten_id: {String(camera.kindergarten_id === result.data.debugAllowedGardenId)}</span></div></article>)}</article></section>{result.data.secondaryWarning ? <div className="gateway-setup-state"><strong>{result.data.secondaryWarning}</strong><p>כרטיסי המצלמות והצפייה נשארים זמינים. פרטי גן/יחסים משניים נטענים בנפרד כדי לא להפיל את המסך.</p></div> : null}<CameraAdminManager cameras={result.data.cameras as any[]} gardens={result.data.gardens as any[]} gatewayConnected={Boolean(process.env.VIDEO_GATEWAY_URL)} /></DashboardShell>;
}
