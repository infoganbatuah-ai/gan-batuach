import { DashboardShell } from "@/components/dashboard-shell";
import { AdvancedLearningDashboard } from "@/components/advanced-learning-dashboard";
import { ObserverLearningDashboard } from "@/components/observer-learning-dashboard";
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

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="למידת תצפיתן">
      <div className="dashboard-hero-card garden-hero-card">
        <div>
          <p className="eyebrow">Digital Observer Learning</p>
          <h1>פרופיל למידה של הגן.</h1>
          <p>הגדרת אזורי מצלמות ושגרת יום כ-baseline בלבד. אין למידה אמיתית, אין פרופיל ילדים ואין החלטות אוטומטיות.</p>
        </div>
        <span className="pill warn">Mock baseline</span>
      </div>
      <ObserverLearningDashboard
        role="garden"
        kindergartenId={gardenId}
        learningProfile={learning.data as any}
        routine={routine.data as any}
        zones={(zones.data ?? []) as any[]}
        signals={(signals.data ?? []) as any[]}
        riskProfile={risk.data as any}
      />
      <AdvancedLearningDashboard
        role="garden"
        kindergartenId={gardenId}
        learningProfiles={learning.data ? [learning.data as any] : []}
        baselines={(baselines.data ?? []) as any[]}
        cameraProfiles={(cameraProfiles.data ?? []) as any[]}
        zoneProfiles={(zoneProfiles.data ?? []) as any[]}
        feedbackSignals={(feedbackSignals.data ?? []) as any[]}
      />
    </DashboardShell>
  );
}
