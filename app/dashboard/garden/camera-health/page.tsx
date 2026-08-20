import Link from "next/link";
import { Camera, CameraOff, HardDrive, RadioTower, ShieldCheck, Video } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildCameraInfrastructureSummary, cameraDiagnosticsFor } from "@/lib/domain/real-camera-infrastructure";
import { CAMERA_BROWSER_SAFE_SELECT } from "@/lib/domain/camera-safe-columns";
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

export default async function GardenCameraHealthPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  const result = await safeAdminData("garden camera health", async () => {
    const supabase = await createClient();
    const [camerasRes, validationsRes, healthRes, recordingRes, storageRes] = await Promise.all([
      supabase.from("camera_streams" as any).select(CAMERA_BROWSER_SAFE_SELECT).eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(200),
      supabase.from("camera_stream_validations" as any).select("*").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(100),
      supabase.from("camera_health_history" as any).select("*").eq("garden_id", gardenId).order("checked_at", { ascending: false }).limit(100),
      supabase.from("camera_recording_readiness" as any).select("*").eq("garden_id", gardenId).order("updated_at", { ascending: false }).limit(100),
      supabase.from("camera_storage_readiness" as any).select("*").eq("garden_id", gardenId).order("updated_at", { ascending: false }).limit(20)
    ]);
    [camerasRes, validationsRes, healthRes, recordingRes, storageRes].forEach((query, index) => logSupabaseError(`garden camera health query ${index}`, (query as any).error));
    const cameras = (camerasRes.data ?? []) as any[];
    return {
      cameras,
      validations: validationsRes.data ?? [],
      healthHistory: healthRes.data ?? [],
      recording: recordingRes.data ?? [],
      storage: storageRes.data ?? [],
      summary: buildCameraInfrastructureSummary(cameras, (validationsRes.data ?? []) as any[]),
      queryError: [camerasRes.error, validationsRes.error, healthRes.error, recordingRes.error, storageRes.error].some(Boolean) ? "חלק מנתוני בריאות המצלמות לא נטענו" : null
    };
  }, { cameras: [] as any[], validations: [] as any[], healthHistory: [] as any[], recording: [] as any[], storage: [] as any[], summary: buildCameraInfrastructureSummary([]), queryError: null as string | null });

  const diagnostics = result.data.cameras.map((camera: any) => ({ camera, diagnostics: cameraDiagnosticsFor(camera) }));
  const { summary } = result.data;

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="בריאות מצלמות" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="מצלמות וניטור" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
        <TeacherPageTitle icon={Camera} title="בריאות מצלמות" subtitle="חיבור, צפייה ומוכנות בלי לחשוף כתובות או סיסמאות" action={<Link className="button primary" href="/dashboard/garden/cameras">ניהול מצלמות</Link>} />
        <AdminDataError message={result.error ?? result.data.queryError} />

        <TeacherStatsGrid>
          <TeacherStatCard title="מצלמות" value={summary.total} hint="מוגדרות" icon={Camera} tone="purple" />
          <TeacherStatCard title="Online" value={summary.online} hint="מחוברות" icon={Video} tone={summary.online ? "green" : "orange"} />
          <TeacherStatCard title="Offline" value={summary.offline} hint="דורש בדיקה" icon={CameraOff} tone={summary.offline ? "red" : "green"} />
          <TeacherStatCard title="Gateway" value={summary.gatewayConfigured ? "מחובר" : "ממתין"} hint="מצב ספק" icon={RadioTower} tone={summary.gatewayConfigured ? "green" : "orange"} />
        </TeacherStatsGrid>

        <TeacherSection title="אבחון מצלמות" action={<Link href="/dashboard/garden/cameras?add=1#camera-management">הוספת מצלמה ›</Link>}>
          {diagnostics.length === 0 ? (
            <TeacherEmptyState title="אין מצלמות עדיין" text="הוסיפו מצלמה ראשונה במסך ניהול מצלמות." action={<Link className="button primary" href="/dashboard/garden/cameras?add=1#camera-management">הוספת מצלמה</Link>} />
          ) : (
            <TeacherCompactList>
              {diagnostics.slice(0, 8).map(({ camera, diagnostics: item }: any) => (
                <TeacherCompactItem
                  key={camera.id}
                  title={camera.name ?? "מצלמה"}
                  subtitle={`${camera.area ?? "אזור לא צוין"} · ${item.providerName} · צפייה ${item.playback.hlsReady || item.playback.webrtcReady ? "מוכנה" : "ממתינה"}`}
                  tone={["offline", "failed", "error"].includes(item.healthStatus) ? "red" : ["online", "connected", "ready"].includes(item.healthStatus) ? "green" : "orange"}
                  meta={item.healthStatus}
                  href="/dashboard/garden/cameras"
                />
              ))}
            </TeacherCompactList>
          )}
        </TeacherSection>

        <TeacherSection title="מוכנות צפייה ואחסון">
          <TeacherCompactList>
            <TeacherCompactItem title="מקורות צפייה" subtitle="HLS/WebRTC דרך Gateway או Sample HLS בלבד" tone="blue" meta={`${summary.playbackReady}/${summary.total}`} />
            <TeacherCompactItem title="הקלטה עתידית" subtitle="מוכנות בלבד. אין הקלטה אמיתית בשלב הזה." tone="purple" meta={`${summary.recordingReady}/${summary.total}`} />
            <TeacherCompactItem title="אחסון" subtitle="מוכנות תשתית ללא חשיפת secrets" tone="green" meta={`${summary.storageReady}/${summary.total}`} />
          </TeacherCompactList>
        </TeacherSection>

        <TeacherAiInsight metric={summary.gatewayConfigured ? "בטוח" : "ממתין"}>
          אין חשיפת RTSP, סיסמאות או מפתחות בדפדפן. צפייה מתבצעת רק דרך gateway או מקור בדיקה מאושר.
        </TeacherAiInsight>

        <TeacherQuickActions title="פעולות מצלמות">
          <TeacherActionTile title="הוספת מצלמה" href="/dashboard/garden/cameras?add=1#camera-management" icon={Camera} tone="purple" />
          <TeacherActionTile title="ניהול מצלמות" href="/dashboard/garden/cameras" icon={Video} tone="blue" />
          <TeacherActionTile title="מסמכי בטיחות" href="/dashboard/garden/documents" icon={ShieldCheck} tone="green" />
          <TeacherActionTile title="דוחות" href="/dashboard/garden/reports" icon={HardDrive} tone="orange" />
        </TeacherQuickActions>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
