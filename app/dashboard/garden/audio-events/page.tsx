import { Bot, Camera, Ear, ShieldAlert } from "lucide-react";
import { AudioObserverEventsPanel } from "@/components/audio-observer-events-panel";
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
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function GardenAudioEventsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  type Row = Record<string, unknown>;
  type AudioPanelProps = Parameters<typeof AudioObserverEventsPanel>[0];
  const unavailable = { rows: [[], []] as Row[][], available: [false, false] };
  const { data } = await safeAdminData("garden audio events", async () => {
    if (!gardenId) return unavailable;
    const supabase = await createClient();
    const query = async (label: string, run: () => PromiseLike<{ data: unknown; error: unknown }>) => {
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
      query("garden audio events query", () => supabase.from("audio_observer_events" as any).select("*, camera_streams(name)").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(150)),
      query("garden audio cameras query", () => supabase.from("camera_streams" as any).select("id, name, garden_id").eq("garden_id", gardenId).order("name").limit(200))
    ]);
    return { rows: results.map((result) => result.rows), available: results.map((result) => result.available) };
  }, unavailable);
  const [rows, cameraRows] = data.rows;
  const [eventsAvailable, camerasAvailable] = data.available;
  const panelAvailable = Boolean(gardenId) && eventsAvailable && camerasAvailable;

  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="תצפיתן דיגיטלי" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
      <TeacherPageTitle icon={Ear} title="אינדיקציות שמע" subtitle="אין תמלול שיחות ואין זיהוי קולי. כל סימן דורש בדיקת אדם" />
      <TeacherStatsGrid>
        <TeacherStatCard title="אינדיקציות" value={eventsAvailable ? rows.length : "לא זמין"} hint="לסקירה" icon={Ear} tone={eventsAvailable ? "purple" : "neutral"} />
        <TeacherStatCard title="מקורות" value={camerasAvailable ? cameraRows.length : "לא זמין"} hint="מצלמות/אזורים" icon={Camera} tone={camerasAvailable ? "blue" : "neutral"} />
        <TeacherStatCard title="מצב פרטיות" value="מוגבל" hint="ללא תמלול" icon={ShieldAlert} tone="green" />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות שמע">
        <TeacherActionTile title="אירועי תצפיתן" href="/dashboard/garden/ai-events" icon={Bot} tone="purple" />
        <TeacherActionTile title="מצלמות" href="/dashboard/garden/cameras" icon={Camera} tone="blue" />
        <TeacherActionTile title="בקשות מעקב" href="/dashboard/garden/observer-watch" icon={Ear} tone="orange" />
      </TeacherQuickActions>
      <TeacherSection title="אירועים לבדיקה" subtitle="שפה זהירה, ללא חשיפה להורים לפני בדיקה">
        {panelAvailable ? <div className="teacher-embedded-module">
          <AudioObserverEventsPanel role="garden" fixedKindergartenId={gardenId} events={rows} cameras={cameraRows as unknown as AudioPanelProps["cameras"]} />
        </div> : <TeacherEmptyState title="נתוני סקירת השמע אינם זמינים" text="לא ניתן לסקור אירועים עד לטעינה תקינה של האירועים ומקורות הגן." />}
      </TeacherSection>
    </TeacherAppFrame>
  );
}
