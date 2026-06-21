import { Bot, Camera, MapPinned, TrendingUp } from "lucide-react";
import { AdvancedLearningDashboard } from "@/components/advanced-learning-dashboard";
import { ObserverLearningDashboard } from "@/components/observer-learning-dashboard";
import {
  TeacherAppFrame,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherActionTile,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenObserverLearningPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id;
  const [learning, routine, zones, signals, risk, baselines, cameraProfiles, zoneProfiles, feedbackSignals] = gardenId ? await Promise.all([
    supabase.from("kindergarten_learning_profiles" as any).select("*").eq("kindergarten_id", gardenId).maybeSingle(),
    supabase.from("kindergarten_routine_configs" as any).select("*").eq("kindergarten_id", gardenId).maybeSingle(),
    supabase.from("camera_zones" as any).select("*, camera_streams(name)").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(100),
    supabase.from("kindergarten_learning_signals" as any).select("*").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(80),
    supabase.from("kindergarten_risk_profiles" as any).select("*").eq("kindergarten_id", gardenId).maybeSingle(),
    supabase.from("site_behavior_baselines" as any).select("*").eq("kindergarten_id", gardenId).order("updated_at", { ascending: false }).limit(100),
    supabase.from("camera_learning_profiles" as any).select("*, camera_streams(name)").eq("kindergarten_id", gardenId).order("updated_at", { ascending: false }).limit(100),
    supabase.from("zone_learning_profiles" as any).select("*, camera_zones(name, zone_type)").eq("kindergarten_id", gardenId).order("updated_at", { ascending: false }).limit(100),
    supabase.from("learning_feedback_signals" as any).select("*").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(100)
  ]) : [{ data: null }, { data: null }, { data: [] }, { data: [] }, { data: null }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const zoneRows = (zones.data ?? []) as any[];
  const signalRows = (signals.data ?? []) as any[];
  const baselineRows = (baselines.data ?? []) as any[];

  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "רונית"}`} subtitle="למידת תצפיתן" avatarUrl={(profile as any).avatar_url ?? null} active="more">
      <TeacherPageTitle icon={TrendingUp} title="למידת תצפיתן" subtitle="Baseline תפעולי בלבד. אין פרופיל ילדים ואין החלטות אוטומטיות" />
      <TeacherStatsGrid>
        <TeacherStatCard title="אזורים" value={zoneRows.length} hint="מוגדרים" icon={MapPinned} tone="blue" />
        <TeacherStatCard title="סימנים" value={signalRows.length} hint="ללמידה מבוקרת" icon={Bot} tone="purple" />
        <TeacherStatCard title="Baseline" value={baselineRows.length} hint="פרופילי התנהגות" icon={TrendingUp} tone="green" />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות למידה">
        <TeacherActionTile title="מצלמות" href="/dashboard/garden/cameras" icon={Camera} tone="blue" />
        <TeacherActionTile title="צירי זמן" href="/dashboard/garden/correlated-events" icon={MapPinned} tone="purple" />
        <TeacherActionTile title="תובנות" href="/dashboard/garden/insights" icon={Bot} tone="green" />
      </TeacherQuickActions>
      <TeacherSection title="למידה בסיסית" subtitle="מוגדר לפי שגרת גן, בלי החלטות אוטומטיות">
        <div className="teacher-embedded-module">
          <ObserverLearningDashboard
            role="garden"
            kindergartenId={gardenId}
            learningProfile={learning.data as any}
            routine={routine.data as any}
            zones={zoneRows}
            signals={signalRows}
            riskProfile={risk.data as any}
          />
        </div>
      </TeacherSection>
      <TeacherSection title="למידה מתקדמת" subtitle="פרופילים ומדדי feedback לבדיקה פנימית">
        <div className="teacher-embedded-module">
          <AdvancedLearningDashboard
            role="garden"
            kindergartenId={gardenId}
            learningProfiles={learning.data ? [learning.data as any] : []}
            baselines={baselineRows}
            cameraProfiles={(cameraProfiles.data ?? []) as any[]}
            zoneProfiles={(zoneProfiles.data ?? []) as any[]}
            feedbackSignals={(feedbackSignals.data ?? []) as any[]}
          />
        </div>
      </TeacherSection>
    </TeacherAppFrame>
  );
}
