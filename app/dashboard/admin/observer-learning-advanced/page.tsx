import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { AdvancedLearningDashboard } from "@/components/advanced-learning-dashboard";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminObserverLearningAdvancedPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("advanced observer learning", async () => {
    const supabase = await createClient();
    const [gardens, learning, baselines, cameraProfiles, zoneProfiles, feedbackSignals] = await Promise.all([
      async () => supabase.from("gardens" as any).select("id, name").order("name").limit(300),
      async () => supabase.from("kindergarten_learning_profiles" as any).select("*").order("updated_at", { ascending: false }).limit(300),
      async () => supabase.from("site_behavior_baselines" as any).select("*").order("updated_at", { ascending: false }).limit(800),
      async () => supabase.from("camera_learning_profiles" as any).select("*, camera_streams(name)").order("updated_at", { ascending: false }).limit(500),
      async () => supabase.from("zone_learning_profiles" as any).select("*, camera_zones(name, zone_type)").order("updated_at", { ascending: false }).limit(500),
      async () => supabase.from("learning_feedback_signals" as any).select("*").order("created_at", { ascending: false }).limit(500)
    ].map(async (query, index) => {
      try {
        const result = await query();
        logSupabaseError(`advanced observer learning ${index}`, result.error);
        return { data: result.error ? [] : result.data ?? [], available: !result.error };
      } catch {
        logSupabaseError(`advanced observer learning ${index}`, true);
        return { data: [], available: false };
      }
    }));
    return {
      gardens: gardens.data ?? [],
      learningProfiles: learning.data ?? [],
      baselines: baselines.data ?? [],
      cameraProfiles: cameraProfiles.data ?? [],
      zoneProfiles: zoneProfiles.data ?? [],
      feedbackSignals: feedbackSignals.data ?? [],
      availability: { gardens: gardens.available, learningProfiles: learning.available, baselines: baselines.available, cameraProfiles: cameraProfiles.available, zoneProfiles: zoneProfiles.available, feedbackSignals: feedbackSignals.available },
      queryError: [gardens, learning, baselines, cameraProfiles, zoneProfiles, feedbackSignals].some((query) => !query.available) ? "חלק מנתוני הלמידה המתקדמת לא נטענו" : null
    };
  }, { gardens: [] as any[], learningProfiles: [] as any[], baselines: [] as any[], cameraProfiles: [] as any[], zoneProfiles: [] as any[], feedbackSignals: [] as any[], availability: { gardens: false, learningProfiles: false, baselines: false, cameraProfiles: false, zoneProfiles: false, feedbackSignals: false }, queryError: null as string | null });

  return (
    <DashboardShell role="admin" title="Advanced Learning">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Advanced learning engine</p>
          <h1>Baselines, maturity, anomaly readiness.</h1>
          <p>Mock learning only. Site-level patterns, no child profiling, no staff scoring and no autonomous enforcement.</p>
        </div>
        <span className="pill warn">Human review required</span>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />
      <AdvancedLearningDashboard
        role="admin"
        gardens={result.data.gardens}
        learningProfiles={result.data.learningProfiles}
        baselines={result.data.baselines}
        cameraProfiles={result.data.cameraProfiles}
        zoneProfiles={result.data.zoneProfiles}
        feedbackSignals={result.data.feedbackSignals}
        availability={result.data.availability}
      />
    </DashboardShell>
  );
}
