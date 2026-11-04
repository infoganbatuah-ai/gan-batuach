import { Brain } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ObserverIntelligencePanel } from "@/components/observer-intelligence-panel";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminObserverIntelligencePage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("observer intelligence", async () => {
    const supabase = await createClient();
    const [gardens, summaries, correlated, cameras, learning] = await Promise.all([
      supabase.from("gardens" as any).select("id, name").order("name").limit(300),
      supabase.from("observer_situation_summaries" as any).select("*, gardens(name), observer_sites(name, site_type)").order("created_at", { ascending: false }).limit(500),
      supabase.from("observer_correlated_events" as any).select("id,kindergarten_id,status,severity,confidence").order("created_at", { ascending: false }).limit(500),
      supabase.from("camera_streams" as any).select("id,garden_id,kindergarten_id,status,stream_status,health_status,gateway_registration_status,active").limit(1000),
      supabase.from("kindergarten_learning_profiles" as any).select("*").order("updated_at", { ascending: false }).limit(500)
    ].map(async (query, index) => {
      try {
        const response = await query;
        if (response.error) {
          logSupabaseError(`observer intelligence ${index}`, response.error);
          return { data: [], available: false };
        }
        return { data: response.data ?? [], available: true };
      } catch (error) {
        logSupabaseError(`observer intelligence ${index}`, error);
        return { data: [], available: false };
      }
    }));
    return {
      gardens: gardens.data ?? [],
      summaries: summaries.data ?? [],
      correlatedEvents: correlated.data ?? [],
      cameras: cameras.data ?? [],
      learningProfiles: learning.data ?? [],
      availability: { gardens: gardens.available, summaries: summaries.available, correlatedEvents: correlated.available, cameras: cameras.available, learningProfiles: learning.available },
      queryError: [gardens, summaries, correlated, cameras, learning].some((query) => !query.available) ? "חלק מנתוני observer intelligence אינם זמינים כרגע" : null
    };
  }, { gardens: [] as any[], summaries: [] as any[], correlatedEvents: [] as any[], cameras: [] as any[], learningProfiles: [] as any[], availability: { gardens: false, summaries: false, correlatedEvents: false, cameras: false, learningProfiles: false }, queryError: null as string | null });
  const firstGardenId = result.data.gardens[0]?.id ?? "";
  const cameraWarnings = (result.data.cameras as any[]).filter((camera) => {
    const status = String(camera.status ?? camera.stream_status ?? camera.health_status ?? camera.gateway_registration_status ?? "");
    return camera.active === false || ["offline", "failed", "error", "disabled", "pending_gateway"].includes(status);
  }).length;

  return (
    <DashboardShell role="admin" title="סיכומי תצפיתן">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">תצפיתן דיגיטלי</p>
          <h1>כל סיכומי התצפיתן במקום אחד.</h1>
          <p>מבט ניהולי על אירועים, מגמות ונושאים פתוחים. אין האשמות אוטומטיות ואין גישה גולמית להורים.</p>
        </div>
        <span className="pill warn"><Brain size={15} /> בדיקת אדם</span>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />
      <ObserverIntelligencePanel
        role="admin"
        fixedKindergartenId={firstGardenId}
        gardens={result.data.gardens}
        summaries={result.data.summaries}
        correlatedEvents={result.data.correlatedEvents}
        cameraWarnings={cameraWarnings}
        learningProfiles={result.data.learningProfiles}
        availability={result.data.availability}
      />
    </DashboardShell>
  );
}
