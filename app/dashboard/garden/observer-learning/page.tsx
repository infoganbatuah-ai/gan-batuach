import { Bot, Camera, MapPinned, TrendingUp } from "lucide-react";
import { AdvancedLearningDashboard } from "@/components/advanced-learning-dashboard";
import { ObserverLearningDashboard } from "@/components/observer-learning-dashboard";
import {
  TeacherAppFrame,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherActionTile,
  TeacherEmptyState,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

type ObserverRow = Record<string, unknown>;

export default async function GardenObserverLearningPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id;
  const unavailableData = {
    learningProfile: null as ObserverRow | null, routine: null as ObserverRow | null, riskProfile: null as ObserverRow | null,
    zones: [] as ObserverRow[], signals: [] as ObserverRow[], baselines: [] as ObserverRow[],
    cameraProfiles: [] as ObserverRow[], zoneProfiles: [] as ObserverRow[], feedbackSignals: [] as ObserverRow[],
    available: Array<boolean>(9).fill(false)
  };
  const result = await safeAdminData("garden observer learning", async () => {
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
    const [learning, routine, zones, signals, risk, baselines, cameraProfiles, zoneProfiles, feedbackSignals] = await Promise.all([
      query("garden learning profile", () => supabase.from("kindergarten_learning_profiles" as any).select("*").eq("kindergarten_id", gardenId).maybeSingle()),
      query("garden learning routine", () => supabase.from("kindergarten_routine_configs" as any).select("*").eq("kindergarten_id", gardenId).maybeSingle()),
      query("garden learning zones", () => supabase.from("camera_zones" as any).select("*, camera_streams(name)").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(100)),
      query("garden learning signals", () => supabase.from("kindergarten_learning_signals" as any).select("*").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(80)),
      query("garden learning risk", () => supabase.from("kindergarten_risk_profiles" as any).select("*").eq("kindergarten_id", gardenId).maybeSingle()),
      query("garden learning baselines", () => supabase.from("site_behavior_baselines" as any).select("*").eq("kindergarten_id", gardenId).order("updated_at", { ascending: false }).limit(100)),
      query("garden learning camera profiles", () => supabase.from("camera_learning_profiles" as any).select("*, camera_streams(name)").eq("kindergarten_id", gardenId).order("updated_at", { ascending: false }).limit(100)),
      query("garden learning zone profiles", () => supabase.from("zone_learning_profiles" as any).select("*, camera_zones(name, zone_type)").eq("kindergarten_id", gardenId).order("updated_at", { ascending: false }).limit(100)),
      query("garden learning feedback", () => supabase.from("learning_feedback_signals" as any).select("*").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(100))
    ]);
    return {
      learningProfile: learning.data as ObserverRow | null, routine: routine.data as ObserverRow | null, riskProfile: risk.data as ObserverRow | null,
      zones: (zones.data ?? []) as ObserverRow[], signals: (signals.data ?? []) as ObserverRow[], baselines: (baselines.data ?? []) as ObserverRow[],
      cameraProfiles: (cameraProfiles.data ?? []) as ObserverRow[], zoneProfiles: (zoneProfiles.data ?? []) as ObserverRow[], feedbackSignals: (feedbackSignals.data ?? []) as ObserverRow[],
      available: [learning, routine, zones, signals, risk, baselines, cameraProfiles, zoneProfiles, feedbackSignals].map((source) => source.available)
    };
  }, unavailableData);
  const data = result.data;
  const basicAvailable = Boolean(gardenId) && [0, 1, 2, 3, 4].every((index) => data.available[index]);
  const advancedAvailable = Boolean(gardenId) && [0, 5, 6, 7, 8].every((index) => data.available[index]);

  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="למידת תצפיתן" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
      <TeacherPageTitle icon={TrendingUp} title="למידת תצפיתן" subtitle="Baseline תפעולי בלבד. אין פרופיל ילדים ואין החלטות אוטומטיות" />
      <TeacherStatsGrid>
        <TeacherStatCard title="אזורים" value={data.available[2] ? data.zones.length : "לא זמין"} hint="מוגדרים" icon={MapPinned} tone={data.available[2] ? "blue" : "neutral"} />
        <TeacherStatCard title="סימנים" value={data.available[3] ? data.signals.length : "לא זמין"} hint="ללמידה מבוקרת" icon={Bot} tone={data.available[3] ? "purple" : "neutral"} />
        <TeacherStatCard title="Baseline" value={data.available[5] ? data.baselines.length : "לא זמין"} hint="פרופילי התנהגות" icon={TrendingUp} tone={data.available[5] ? "green" : "neutral"} />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות למידה">
        <TeacherActionTile title="מצלמות" href="/dashboard/garden/cameras" icon={Camera} tone="blue" />
        <TeacherActionTile title="צירי זמן" href="/dashboard/garden/correlated-events" icon={MapPinned} tone="purple" />
        <TeacherActionTile title="תובנות" href="/dashboard/garden/insights" icon={Bot} tone="green" />
      </TeacherQuickActions>
      <TeacherSection title="למידה בסיסית" subtitle="מוגדר לפי שגרת גן, בלי החלטות אוטומטיות">
        <div className="teacher-embedded-module">
          {basicAvailable ? <ObserverLearningDashboard
            role="garden"
            kindergartenId={gardenId}
            learningProfile={data.learningProfile}
            routine={data.routine}
            zones={data.zones}
            signals={data.signals}
            riskProfile={data.riskProfile}
          /> : <TeacherEmptyState title="הלמידה הבסיסית אינה זמינה כרגע" text="לא ניתן לטעון את כל הנתונים הדרושים ללמידה הבסיסית." />}
        </div>
      </TeacherSection>
      <TeacherSection title="למידה מתקדמת" subtitle="פרופילים ומדדי feedback לבדיקה פנימית">
        <div className="teacher-embedded-module">
          {advancedAvailable ? <AdvancedLearningDashboard
            role="garden"
            kindergartenId={gardenId}
            learningProfiles={data.learningProfile ? [data.learningProfile] : []}
            baselines={data.baselines}
            cameraProfiles={data.cameraProfiles}
            zoneProfiles={data.zoneProfiles}
            feedbackSignals={data.feedbackSignals}
          /> : <TeacherEmptyState title="הלמידה המתקדמת אינה זמינה כרגע" text="לא ניתן לטעון את כל הנתונים הדרושים ללמידה המתקדמת." />}
        </div>
      </TeacherSection>
    </TeacherAppFrame>
  );
}
