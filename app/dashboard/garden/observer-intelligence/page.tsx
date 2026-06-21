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
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="סיכומי תצפיתן" appHome>
      <TeacherAppFrame
        title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "רונית"}`}
        subtitle="תצפיתן בטיחות"
        avatarUrl={(profile as any).avatar_url ?? null}
        active="more"
      >
        <TeacherPageTitle
          icon={Brain}
          title="מה כדאי לבדוק עכשיו"
          subtitle="סיכום זהיר למנהלת. שום דבר לא נשלח להורים בלי אישור."
          action={<Link className="teacher-soft-button purple" href="/dashboard/garden/observer-network">תקציר בטיחות</Link>}
        />
        <TeacherStatsGrid>
          <TeacherStatCard title="סיכומים" value={(summaries.data ?? []).length} hint="לבדיקה" icon={Brain} tone={(summaries.data ?? []).length ? "orange" : "green"} />
          <TeacherStatCard title="אירועים מקושרים" value={(correlated.data ?? []).length} icon={ClipboardCheck} tone={(correlated.data ?? []).length ? "orange" : "green"} />
          <TeacherStatCard title="מצלמות דורשות טיפול" value={cameraWarnings} icon={Camera} tone={cameraWarnings ? "orange" : "green"} />
          <TeacherStatCard title="בדיקה אנושית" value="פעיל" icon={ShieldCheck} tone="purple" />
        </TeacherStatsGrid>
        <TeacherQuickActions title="פעולות תצפיתן">
          <TeacherActionTile title="מצלמות" href="/dashboard/garden/cameras" icon={Camera} tone="blue" />
          <TeacherActionTile title="תקציר בטיחות" href="/dashboard/garden/observer-network" icon={ShieldCheck} tone="purple" />
          <TeacherActionTile title="פיילוט" href="/dashboard/garden/observer-pilot" icon={Brain} tone="orange" />
        </TeacherQuickActions>
        <div className="ganenet-embedded-panel">
          <ObserverIntelligencePanel
            role="garden"
            fixedKindergartenId={gardenId}
            summaries={(summaries.data ?? []) as any[]}
            correlatedEvents={(correlated.data ?? []) as any[]}
            cameraWarnings={cameraWarnings}
            learningProfiles={learning.data ? [learning.data as any] : []}
          />
        </div>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
