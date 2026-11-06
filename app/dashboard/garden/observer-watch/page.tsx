import { Bot, Camera, Eye, MapPinned } from "lucide-react";
import { ObserverWatchRequestsPanel } from "@/components/observer-watch-requests-panel";
import {
  TeacherAppFrame,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherActionTile,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid,
  TeacherEmptyState
} from "@/components/teacher-app-ui";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenObserverWatchPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id;
  type Row = Record<string, unknown>;
  type WatchPanelProps = Parameters<typeof ObserverWatchRequestsPanel>[0];
  const unavailable = { rows: [[], [], []] as Row[][], available: [false, false, false] };
  const { data } = await safeAdminData("garden observer watch", async () => {
    if (!gardenId) return unavailable;
    const supabase = await createClient();
    const query = async <T,>(label: string, run: () => PromiseLike<{ data: T | null; error: unknown }>) => {
      try {
        const result = await run();
        logSupabaseError(label, result.error);
        return { rows: (result.error ? [] : result.data ?? []) as Row[], available: !result.error };
      } catch (error) {
        logSupabaseError(label, error);
        return { rows: [] as Row[], available: false };
      }
    };
    const results = await Promise.all([
      query("garden watch requests", () => supabase.from("observer_watch_requests" as any).select("*, gardens(name), camera_streams(name), camera_zones(name, zone_type)").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(200)),
      query("garden watch cameras", () => supabase.from("camera_streams" as any).select("id, name, garden_id, observer_site_id").eq("garden_id", gardenId).order("name").limit(200)),
      query("garden watch zones", () => supabase.from("camera_zones" as any).select("id, name, zone_type, kindergarten_id, observer_site_id").eq("kindergarten_id", gardenId).order("name").limit(200))
    ]);
    return { rows: results.map((result) => result.rows), available: results.map((result) => result.available) };
  }, unavailable);
  const [requestRows, cameraRows, zoneRows] = data.rows;
  const [requestsAvailable, camerasAvailable, zonesAvailable] = data.available;
  const panelAvailable = Boolean(gardenId) && data.available.every(Boolean);

  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="בקשות מעקב לתצפיתן" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
      <TeacherPageTitle icon={Eye} title="בקשות מעקב" subtitle="מה התצפיתן צריך לסמן לבדיקה אנושית" />
      <TeacherStatsGrid>
        <TeacherStatCard title="בקשות" value={requestsAvailable ? requestRows.length : "לא זמין"} hint="פעילות/היסטוריה" icon={Eye} tone={requestsAvailable ? "purple" : "neutral"} />
        <TeacherStatCard title="מצלמות" value={camerasAvailable ? cameraRows.length : "לא זמין"} hint="מקורות זמינים" icon={Camera} tone={camerasAvailable ? "blue" : "neutral"} />
        <TeacherStatCard title="אזורים" value={zonesAvailable ? zoneRows.length : "לא זמין"} hint="למעקב" icon={MapPinned} tone={zonesAvailable ? "green" : "neutral"} />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות מעקב">
        <TeacherActionTile title="מצלמות" href="/dashboard/garden/cameras" icon={Camera} tone="blue" />
        <TeacherActionTile title="אירועי תצפיתן" href="/dashboard/garden/ai-events" icon={Bot} tone="purple" />
        <TeacherActionTile title="צירי זמן" href="/dashboard/garden/correlated-events" icon={MapPinned} tone="orange" />
      </TeacherQuickActions>
      <TeacherSection title="ניהול בקשות מעקב" subtitle="לא מוצג להורים וללא פעולה אוטומטית">
        {panelAvailable ? <div className="teacher-embedded-module">
          <ObserverWatchRequestsPanel
            role="garden"
            fixedKindergartenId={gardenId}
            requests={requestRows as unknown as WatchPanelProps["requests"]}
            cameras={cameraRows as unknown as WatchPanelProps["cameras"]}
            zones={zoneRows as unknown as WatchPanelProps["zones"]}
          />
        </div> : <TeacherEmptyState title="נתוני בקשות המעקב אינם זמינים" text="לא ניתן לנהל בקשות עד לטעינה תקינה של הבקשות, המצלמות והאזורים בגן." />}
      </TeacherSection>
    </TeacherAppFrame>
  );
}
