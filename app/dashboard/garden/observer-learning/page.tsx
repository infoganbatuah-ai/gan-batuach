import { DashboardShell } from "@/components/dashboard-shell";
import { ObserverLearningDashboard } from "@/components/observer-learning-dashboard";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenObserverLearningPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id;
  const [learning, routine, zones, signals, risk] = gardenId ? await Promise.all([
    supabase.from("kindergarten_learning_profiles" as any).select("*").eq("kindergarten_id", gardenId).maybeSingle(),
    supabase.from("kindergarten_routine_configs" as any).select("*").eq("kindergarten_id", gardenId).maybeSingle(),
    supabase.from("camera_zones" as any).select("*, camera_streams(name)").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(100),
    supabase.from("kindergarten_learning_signals" as any).select("*").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(80),
    supabase.from("kindergarten_risk_profiles" as any).select("*").eq("kindergarten_id", gardenId).maybeSingle()
  ]) : [{ data: null }, { data: null }, { data: [] }, { data: [] }, { data: null }];

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
    </DashboardShell>
  );
}
