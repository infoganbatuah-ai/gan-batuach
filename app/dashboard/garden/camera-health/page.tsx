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

type HealthCamera = Parameters<typeof cameraDiagnosticsFor>[0] & { id: string; name?: string | null; area?: string | null };
type HealthValidation = NonNullable<Parameters<typeof buildCameraInfrastructureSummary>[1]>;

async function cameraHealthQuery(label: string, query: () => PromiseLike<{ data: unknown; error: unknown }>) {
  try {
    const result = await query();
    logSupabaseError(label, result.error);
    return result.error ? { data: null, error: true } : { data: result.data, error: false };
  } catch {
    logSupabaseError(label, true);
    return { data: null, error: true };
  }
}

export default async function GardenCameraHealthPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  if (!gardenId) {
    return <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="בריאות מצלמות" appHome><AdminDataError message="לא ניתן לטעון בריאות מצלמות ללא שיוך לגן" /></DashboardShell>;
  }
  const result = await safeAdminData("garden camera health", async () => {
    const supabase = await createClient();
    const [camerasRes, validationsRes, healthRes, recordingRes, storageRes] = await Promise.all([
      cameraHealthQuery("garden camera health cameras", () => supabase.from("camera_streams" as any).select(CAMERA_BROWSER_SAFE_SELECT).eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(200)),
      cameraHealthQuery("garden camera health validations", () => supabase.from("camera_stream_validations" as any).select("*").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(100)),
      cameraHealthQuery("garden camera health history", () => supabase.from("camera_health_history" as any).select("*").eq("garden_id", gardenId).order("checked_at", { ascending: false }).limit(100)),
      cameraHealthQuery("garden camera health recording", () => supabase.from("camera_recording_readiness" as any).select("*").eq("garden_id", gardenId).order("updated_at", { ascending: false }).limit(100)),
      cameraHealthQuery("garden camera health storage", () => supabase.from("camera_storage_readiness" as any).select("*").eq("garden_id", gardenId).order("updated_at", { ascending: false }).limit(20))
    ]);
    const available = [camerasRes, validationsRes, healthRes, recordingRes, storageRes].map((query) => !query.error);
    const cameras = (camerasRes.data ?? []) as HealthCamera[];
    return {
      cameras,
      validations: (validationsRes.data ?? []) as HealthValidation,
      healthHistory: (healthRes.data ?? []) as unknown[],
      recording: (recordingRes.data ?? []) as unknown[],
      storage: (storageRes.data ?? []) as unknown[],
      summary: buildCameraInfrastructureSummary(cameras, (validationsRes.data ?? []) as HealthValidation),
      available,
      queryError: available.some((value) => !value) ? "חלק מנתוני בריאות המצלמות לא נטענו" : null
    };
  }, { cameras: [] as HealthCamera[], validations: [] as HealthValidation, healthHistory: [] as unknown[], recording: [] as unknown[], storage: [] as unknown[], summary: null as ReturnType<typeof buildCameraInfrastructureSummary> | null, available: [false, false, false, false, false], queryError: null as string | null });

  const diagnostics = result.data.available[0] ? result.data.cameras.map((camera) => ({ camera, diagnostics: cameraDiagnosticsFor(camera) })) : [];
  const { summary } = result.data;
  const cameraSummary = result.data.available[0] ? summary : null;

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="בריאות מצלמות" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="מצלמות וניטור" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
        <TeacherPageTitle icon={Camera} title="בריאות מצלמות" subtitle="חיבור, צפייה ומוכנות בלי לחשוף כתובות או סיסמאות" action={<Link className="button primary" href="/dashboard/garden/cameras">ניהול מצלמות</Link>} />
        <AdminDataError message={result.error ?? result.data.queryError} />

        <TeacherStatsGrid>
          <TeacherStatCard title="מצלמות" value={cameraSummary ? cameraSummary.total : "לא זמין"} hint="מוגדרות" icon={Camera} tone={cameraSummary ? "purple" : "neutral"} />
          <TeacherStatCard title="Online" value={cameraSummary ? cameraSummary.online : "לא זמין"} hint="מחוברות" icon={Video} tone={!cameraSummary ? "neutral" : cameraSummary.online ? "green" : "orange"} />
          <TeacherStatCard title="Offline" value={cameraSummary ? cameraSummary.offline : "לא זמין"} hint="דורש בדיקה" icon={CameraOff} tone={!cameraSummary ? "neutral" : cameraSummary.offline ? "red" : "green"} />
          <TeacherStatCard title="Gateway" value={summary ? summary.gatewayConfigured ? "מוגדר" : "לא מוגדר" : "לא זמין"} hint="הגדרה בלבד — החיבור לא אומת" icon={RadioTower} tone="neutral" />
        </TeacherStatsGrid>

        <TeacherSection title="אבחון מצלמות" action={<Link href="/dashboard/garden/cameras?add=1#camera-management">הוספת מצלמה ›</Link>}>
          {!cameraSummary ? <TeacherEmptyState title="נתוני המצלמות לא זמינים" text="לא ניתן לטעון את אבחון המצלמות כרגע." /> : diagnostics.length === 0 ? (
            <TeacherEmptyState title="אין מצלמות עדיין" text="הוסיפו מצלמה ראשונה במסך ניהול מצלמות." action={<Link className="button primary" href="/dashboard/garden/cameras?add=1#camera-management">הוספת מצלמה</Link>} />
          ) : (
            <TeacherCompactList>
              {diagnostics.slice(0, 8).map(({ camera, diagnostics: item }) => (
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
            <TeacherCompactItem title="מקורות צפייה" subtitle="HLS/WebRTC דרך Gateway או Sample HLS בלבד" tone={cameraSummary ? "blue" : "neutral"} meta={cameraSummary ? `${cameraSummary.playbackReady}/${cameraSummary.total}` : "לא זמין"} />
            <TeacherCompactItem title="הקלטה עתידית" subtitle="מוכנות בלבד. אין הקלטה אמיתית בשלב הזה." tone={cameraSummary ? "purple" : "neutral"} meta={cameraSummary ? `${cameraSummary.recordingReady}/${cameraSummary.total}` : "לא זמין"} />
            <TeacherCompactItem title="אחסון" subtitle="מוכנות תשתית ללא חשיפת secrets" tone={cameraSummary ? "green" : "neutral"} meta={cameraSummary ? `${cameraSummary.storageReady}/${cameraSummary.total}` : "לא זמין"} />
          </TeacherCompactList>
        </TeacherSection>

        <TeacherAiInsight metric={summary ? summary.gatewayConfigured ? "Gateway מוגדר" : "Gateway לא מוגדר" : "לא זמין"}>
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
