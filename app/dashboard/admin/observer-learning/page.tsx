import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ObserverLearningDashboard } from "@/components/observer-learning-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function AdminObserverLearningPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin observer learning", async () => {
    const supabase = await createClient();
    const [gardens, learning, routines, zones, signals, risks] = await Promise.all([
      supabase.from("gardens" as any).select("id, name").order("name").limit(200),
      supabase.from("kindergarten_learning_profiles" as any).select("*").order("updated_at", { ascending: false }).limit(200),
      supabase.from("kindergarten_routine_configs" as any).select("*").order("updated_at", { ascending: false }).limit(200),
      supabase.from("camera_zones" as any).select("*, camera_streams(name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("kindergarten_learning_signals" as any).select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("kindergarten_risk_profiles" as any).select("*").order("calculated_at", { ascending: false }).limit(200)
    ].map(async (query, index) => {
      try {
        const response = await query;
        if (response.error) {
          logSupabaseError(`admin observer learning ${index}`, response.error);
          return { data: [], available: false };
        }
        return { data: response.data ?? [], available: true };
      } catch (error) {
        logSupabaseError(`admin observer learning ${index}`, error);
        return { data: [], available: false };
      }
    }));
    return {
      gardens: gardens.data ?? [],
      learningProfiles: learning.data ?? [],
      routines: routines.data ?? [],
      zones: zones.data ?? [],
      signals: signals.data ?? [],
      risks: risks.data ?? [],
      availability: { gardens: gardens.available, learningProfiles: learning.available, routines: routines.available, zones: zones.available, signals: signals.available, risks: risks.available },
      queryError: [gardens, learning, routines, zones, signals, risks].some((query) => !query.available) ? "חלק מנתוני הלמידה אינם זמינים כרגע" : null
    };
  }, { gardens: [] as any[], learningProfiles: [] as any[], routines: [] as any[], zones: [] as any[], signals: [] as any[], risks: [] as any[], availability: { gardens: false, learningProfiles: false, routines: false, zones: false, signals: false, risks: false }, queryError: null as string | null });
  const firstGardenId = result.data.gardens[0]?.id ?? null;
  return (
    <DashboardShell role="admin" title="למידת תצפיתן">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Learning engine foundation</p>
          <h1>פרופילי למידה, אזורים ושגרות גן.</h1>
          <p>מסך QA ותשתית בלבד. אין למידת AI אמיתית, אין פרופיל ילדים ואין החלטות אוטומטיות.</p>
        </div>
        <span className="pill warn">Foundation</span>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />
      <ObserverLearningDashboard
        role="admin"
        kindergartenId={firstGardenId}
        gardens={result.data.gardens as any[]}
        learningProfiles={result.data.learningProfiles as any[]}
        routines={result.data.routines as any[]}
        zones={result.data.zones as any[]}
        signals={result.data.signals as any[]}
        riskProfiles={result.data.risks as any[]}
        availability={result.data.availability}
      />
    </DashboardShell>
  );
}
