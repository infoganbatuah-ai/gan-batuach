import Link from "next/link";
import { Brain, Camera, ClipboardCheck, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ObserverIntelligencePanel } from "@/components/observer-intelligence-panel";
import {
  TeacherActionTile,
  TeacherAppFrame,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

type ObserverRow = Record<string, unknown>;

export default async function GardenObserverIntelligencePage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  const unavailableData = {
    summaries: [] as ObserverRow[], correlated: [] as ObserverRow[], cameras: [] as ObserverRow[], learning: null as ObserverRow | null,
    available: [false, false, false, false]
  };
  const result = await safeAdminData("garden observer intelligence", async () => {
    if (!gardenId) return unavailableData;
    const supabase = await createClient();
    const query = async <T,>(label: string, run: () => PromiseLike<{ data: T | null; error: unknown }>) => {
      try {
        const response = await run();
        logSupabaseError(label, response.error);
        return { data: response.error ? null : response.data, available: !response.error };
      } catch (error) {
        logSupabaseError(label, error);
        return { data: null, available: false };
      }
    };
    const [summaries, correlated, cameras, learning] = await Promise.all([
      query("garden observer summaries", () => supabase.from("observer_situation_summaries" as any).select("*").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(150)),
      query("garden observer correlated events", () => supabase.from("observer_correlated_events" as any).select("id,kindergarten_id,status,severity,confidence").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(100)),
      query("garden observer cameras", () => supabase.from("camera_streams" as any).select("id,status,stream_status,health_status,gateway_registration_status,active").or(`garden_id.eq.${gardenId},kindergarten_id.eq.${gardenId}`).limit(250)),
      query("garden observer learning", () => supabase.from("kindergarten_learning_profiles" as any).select("*").eq("kindergarten_id", gardenId).maybeSingle())
    ]);
    return {
      summaries: (summaries.data ?? []) as ObserverRow[], correlated: (correlated.data ?? []) as ObserverRow[],
      cameras: (cameras.data ?? []) as ObserverRow[], learning: learning.data as ObserverRow | null,
      available: [summaries.available, correlated.available, cameras.available, learning.available]
    };
  }, unavailableData);
  const data = result.data;
  const cameraWarnings = data.cameras.filter((camera) => camera.active === false || ["offline", "failed", "error", "disabled", "pending_gateway"].includes(String(camera.status ?? camera.stream_status ?? camera.health_status ?? camera.gateway_registration_status ?? ""))).length;
  const panelAvailable = Boolean(gardenId) && data.available.every(Boolean);

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="סיכומי תצפיתן" appHome>
      <TeacherAppFrame
        title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`}
        subtitle="תצפיתן בטיחות"
        avatarUrl={(profile as any).profile_image_url ?? null}
        active="more"
      >
        <TeacherPageTitle
          icon={Brain}
          title="מה כדאי לבדוק עכשיו"
          subtitle="סיכום זהיר למנהלת. שום דבר לא נשלח להורים בלי אישור."
          action={<Link className="teacher-soft-button purple" href="/dashboard/garden/observer-network">תקציר בטיחות</Link>}
        />
        <TeacherStatsGrid>
          <TeacherStatCard title="סיכומים" value={data.available[0] ? data.summaries.length : "לא זמין"} hint="לבדיקה" icon={Brain} tone={!data.available[0] ? "neutral" : data.summaries.length ? "orange" : "green"} />
          <TeacherStatCard title="אירועים מקושרים" value={data.available[1] ? data.correlated.length : "לא זמין"} icon={ClipboardCheck} tone={!data.available[1] ? "neutral" : data.correlated.length ? "orange" : "green"} />
          <TeacherStatCard title="מצלמות דורשות טיפול" value={data.available[2] ? cameraWarnings : "לא זמין"} icon={Camera} tone={!data.available[2] ? "neutral" : cameraWarnings ? "orange" : "green"} />
          <TeacherStatCard title="בדיקה אנושית" value="פעיל" icon={ShieldCheck} tone="purple" />
        </TeacherStatsGrid>
        <TeacherQuickActions title="פעולות תצפיתן">
          <TeacherActionTile title="מצלמות" href="/dashboard/garden/cameras" icon={Camera} tone="blue" />
          <TeacherActionTile title="תקציר בטיחות" href="/dashboard/garden/observer-network" icon={ShieldCheck} tone="purple" />
          <TeacherActionTile title="פיילוט" href="/dashboard/garden/observer-pilot" icon={Brain} tone="orange" />
        </TeacherQuickActions>
        <div className="ganenet-embedded-panel">
          {panelAvailable ? <ObserverIntelligencePanel
            role="garden"
            fixedKindergartenId={gardenId}
            summaries={data.summaries}
            correlatedEvents={data.correlated}
            cameraWarnings={cameraWarnings}
            learningProfiles={data.learning ? [data.learning] : []}
          /> : <div className="empty-state" role="status"><strong>סיכומי התצפיתן אינם זמינים כרגע</strong><span>לא ניתן לטעון את כל הנתונים הדרושים. נסו שוב מאוחר יותר.</span></div>}
        </div>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
