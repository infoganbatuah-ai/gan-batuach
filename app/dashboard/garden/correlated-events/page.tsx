import { Bot, Camera, GitBranch, MapPinned } from "lucide-react";
import { CorrelatedEventsPanel } from "@/components/correlated-events-panel";
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

export default async function GardenCorrelatedEventsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  type Row = Record<string, unknown>;
  type TimelinePanelProps = Parameters<typeof CorrelatedEventsPanel>[0];
  const unavailable = { rows: [[], [], [], []] as Row[][], available: [false, false, false, false] };
  const { data } = await safeAdminData("garden correlated events", async () => {
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
      query("garden timeline events", () => supabase.from("observer_correlated_events" as any).select("*").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(150)),
      query("garden timeline links", () => supabase.from("observer_correlated_event_links" as any).select("*, camera_streams(name), camera_zones(name, zone_type)").eq("kindergarten_id", gardenId).order("sequence_order", { ascending: true }).limit(500)),
      query("garden timeline cameras", () => supabase.from("camera_streams" as any).select("id, name, garden_id, kindergarten_id").or(`garden_id.eq.${gardenId},kindergarten_id.eq.${gardenId}`).order("name").limit(200)),
      query("garden timeline zones", () => supabase.from("camera_zones" as any).select("id, name, kindergarten_id, camera_id").eq("kindergarten_id", gardenId).order("name").limit(200))
    ]);
    return { rows: results.map((result) => result.rows), available: results.map((result) => result.available) };
  }, unavailable);
  const [eventRows, linkRows, cameraRows, zoneRows] = data.rows;
  const [eventsAvailable, linksAvailable, , zonesAvailable] = data.available;
  const panelAvailable = Boolean(gardenId) && data.available.every(Boolean);

  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="צירי זמן תצפיתן" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
      <TeacherPageTitle icon={GitBranch} title="צירי זמן" subtitle="קישור אירועים בין מצלמות ואזורים לבדיקה אנושית" />
      <TeacherStatsGrid>
        <TeacherStatCard title="אירועים" value={eventsAvailable ? eventRows.length : "לא זמין"} hint="מקושרים" icon={GitBranch} tone={eventsAvailable ? "purple" : "neutral"} />
        <TeacherStatCard title="קישורים" value={linksAvailable ? linkRows.length : "לא זמין"} hint="בין מקורות" icon={Bot} tone={linksAvailable ? "blue" : "neutral"} />
        <TeacherStatCard title="אזורים" value={zonesAvailable ? zoneRows.length : "לא זמין"} hint="לניתוח" icon={MapPinned} tone={zonesAvailable ? "green" : "neutral"} />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות ציר זמן">
        <TeacherActionTile title="בקשות מעקב" href="/dashboard/garden/observer-watch" icon={MapPinned} tone="purple" />
        <TeacherActionTile title="אירועי AI" href="/dashboard/garden/ai-events" icon={Bot} tone="blue" />
        <TeacherActionTile title="מצלמות" href="/dashboard/garden/cameras" icon={Camera} tone="green" />
      </TeacherQuickActions>
      <TeacherSection title="צירי זמן לבדיקה" subtitle="אין זיהוי זהות ואין התראות הורים אוטומטיות">
        {panelAvailable ? <div className="teacher-embedded-module">
          <CorrelatedEventsPanel
            role="garden"
            fixedKindergartenId={gardenId}
            events={eventRows}
            links={linkRows}
            cameras={cameraRows as unknown as TimelinePanelProps["cameras"]}
            zones={zoneRows as unknown as TimelinePanelProps["zones"]}
          />
        </div> : <TeacherEmptyState title="נתוני צירי הזמן אינם זמינים" text="לא ניתן לנהל צירי זמן עד לטעינה תקינה של האירועים, הקישורים, המצלמות והאזורים בגן." />}
      </TeacherSection>
    </TeacherAppFrame>
  );
}
