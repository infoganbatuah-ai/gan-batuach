import { Bot, Camera, Eye, MapPinned } from "lucide-react";
import { ObserverWatchRequestsPanel } from "@/components/observer-watch-requests-panel";
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

export default async function GardenObserverWatchPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id;
  const [requests, cameras, zones] = gardenId ? await Promise.all([
    supabase.from("observer_watch_requests" as any).select("*, gardens(name), camera_streams(name), camera_zones(name, zone_type)").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(200),
    supabase.from("camera_streams" as any).select("id, name, garden_id, observer_site_id").eq("garden_id", gardenId).order("name").limit(200),
    supabase.from("camera_zones" as any).select("id, name, zone_type, kindergarten_id, observer_site_id").eq("kindergarten_id", gardenId).order("name").limit(200)
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const requestRows = (requests.data ?? []) as any[];
  const cameraRows = (cameras.data ?? []) as any[];
  const zoneRows = (zones.data ?? []) as any[];

  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "רונית"}`} subtitle="בקשות מעקב לתצפיתן" avatarUrl={(profile as any).avatar_url ?? null} active="more">
      <TeacherPageTitle icon={Eye} title="בקשות מעקב" subtitle="מה התצפיתן צריך לסמן לבדיקה אנושית" />
      <TeacherStatsGrid>
        <TeacherStatCard title="בקשות" value={requestRows.length} hint="פעילות/היסטוריה" icon={Eye} tone="purple" />
        <TeacherStatCard title="מצלמות" value={cameraRows.length} hint="מקורות זמינים" icon={Camera} tone="blue" />
        <TeacherStatCard title="אזורים" value={zoneRows.length} hint="למעקב" icon={MapPinned} tone="green" />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות מעקב">
        <TeacherActionTile title="מצלמות" href="/dashboard/garden/cameras" icon={Camera} tone="blue" />
        <TeacherActionTile title="אירועי תצפיתן" href="/dashboard/garden/ai-events" icon={Bot} tone="purple" />
        <TeacherActionTile title="צירי זמן" href="/dashboard/garden/correlated-events" icon={MapPinned} tone="orange" />
      </TeacherQuickActions>
      <TeacherSection title="ניהול בקשות מעקב" subtitle="לא מוצג להורים וללא פעולה אוטומטית">
        <div className="teacher-embedded-module">
          <ObserverWatchRequestsPanel
            role="garden"
            fixedKindergartenId={gardenId}
            requests={requestRows}
            cameras={cameraRows}
            zones={zoneRows}
          />
        </div>
      </TeacherSection>
    </TeacherAppFrame>
  );
}
