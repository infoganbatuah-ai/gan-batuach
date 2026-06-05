import { Brain } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ObserverIntelligencePanel } from "@/components/observer-intelligence-panel";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenObserverIntelligencePage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [summaries, correlated, cameras, learning] = gardenId ? await Promise.all([
    supabase.from("observer_situation_summaries" as any).select("*").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(150),
    supabase.from("observer_correlated_events" as any).select("id,kindergarten_id,status,severity,confidence").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(100),
    supabase.from("camera_streams" as any).select("id,status,stream_status,health_status,gateway_registration_status,active").or(`garden_id.eq.${gardenId},kindergarten_id.eq.${gardenId}`).limit(250),
    supabase.from("kindergarten_learning_profiles" as any).select("*").eq("kindergarten_id", gardenId).maybeSingle()
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: null }];
  const cameraWarnings = ((cameras.data ?? []) as any[]).filter((camera) => camera.active === false || ["offline", "failed", "error", "disabled", "pending_gateway"].includes(String(camera.status ?? camera.stream_status ?? camera.health_status ?? camera.gateway_registration_status ?? ""))).length;

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="סיכומי תצפיתן">
      <div className="dashboard-hero-card garden-hero-card">
        <div>
          <p className="eyebrow">תצפיתן דיגיטלי</p>
          <h1>מה התצפיתן מציע לבדוק עכשיו.</h1>
          <p>סיכום זהיר של מצלמות, שמע, צירי זמן, איסוף ולמידה. אין מסקנות אוטומטיות ואין הודעות הורים ללא אישור.</p>
        </div>
        <span className="pill warn"><Brain size={15} /> בדיקת אדם</span>
      </div>
      <ObserverIntelligencePanel
        role="garden"
        fixedKindergartenId={gardenId}
        summaries={(summaries.data ?? []) as any[]}
        correlatedEvents={(correlated.data ?? []) as any[]}
        cameraWarnings={cameraWarnings}
        learningProfiles={learning.data ? [learning.data as any] : []}
      />
    </DashboardShell>
  );
}
