import { Bot, Camera, GitBranch, MapPinned } from "lucide-react";
import { CorrelatedEventsPanel } from "@/components/correlated-events-panel";
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

export default async function GardenCorrelatedEventsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [events, links, cameras, zones] = gardenId ? await Promise.all([
    supabase.from("observer_correlated_events" as any).select("*").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(150),
    supabase.from("observer_correlated_event_links" as any).select("*, camera_streams(name), camera_zones(name, zone_type)").eq("kindergarten_id", gardenId).order("sequence_order", { ascending: true }).limit(500),
    supabase.from("camera_streams" as any).select("id, name, garden_id, kindergarten_id").or(`garden_id.eq.${gardenId},kindergarten_id.eq.${gardenId}`).order("name").limit(200),
    supabase.from("camera_zones" as any).select("id, name, kindergarten_id, camera_id").eq("kindergarten_id", gardenId).order("name").limit(200)
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const eventRows = (events.data ?? []) as any[];
  const linkRows = (links.data ?? []) as any[];
  const cameraRows = (cameras.data ?? []) as any[];
  const zoneRows = (zones.data ?? []) as any[];

  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "רונית"}`} subtitle="צירי זמן תצפיתן" avatarUrl={(profile as any).avatar_url ?? null} active="more">
      <TeacherPageTitle icon={GitBranch} title="צירי זמן" subtitle="קישור אירועים בין מצלמות ואזורים לבדיקה אנושית" />
      <TeacherStatsGrid>
        <TeacherStatCard title="אירועים" value={eventRows.length} hint="מקושרים" icon={GitBranch} tone="purple" />
        <TeacherStatCard title="קישורים" value={linkRows.length} hint="בין מקורות" icon={Bot} tone="blue" />
        <TeacherStatCard title="אזורים" value={zoneRows.length} hint="לניתוח" icon={MapPinned} tone="green" />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות ציר זמן">
        <TeacherActionTile title="בקשות מעקב" href="/dashboard/garden/observer-watch" icon={MapPinned} tone="purple" />
        <TeacherActionTile title="אירועי AI" href="/dashboard/garden/ai-events" icon={Bot} tone="blue" />
        <TeacherActionTile title="מצלמות" href="/dashboard/garden/cameras" icon={Camera} tone="green" />
      </TeacherQuickActions>
      <TeacherSection title="צירי זמן לבדיקה" subtitle="אין זיהוי זהות ואין התראות הורים אוטומטיות">
        <div className="teacher-embedded-module">
          <CorrelatedEventsPanel
            role="garden"
            fixedKindergartenId={gardenId}
            events={eventRows}
            links={linkRows}
            cameras={cameraRows}
            zones={zoneRows}
          />
        </div>
      </TeacherSection>
    </TeacherAppFrame>
  );
}
