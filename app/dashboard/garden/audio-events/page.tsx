import { Bot, Camera, Ear, ShieldAlert } from "lucide-react";
import { AudioObserverEventsPanel } from "@/components/audio-observer-events-panel";
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

export default async function GardenAudioEventsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [events, cameras] = await Promise.all([
    supabase.from("audio_observer_events" as any).select("*, camera_streams(name)").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(150),
    supabase.from("camera_streams" as any).select("id, name, garden_id").eq("garden_id", gardenId).order("name").limit(200)
  ]);
  const rows = (events.data ?? []) as any[];
  const cameraRows = (cameras.data ?? []) as any[];

  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="תצפיתן דיגיטלי" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
      <TeacherPageTitle icon={Ear} title="אינדיקציות שמע" subtitle="אין תמלול שיחות ואין זיהוי קולי. כל סימן דורש בדיקת אדם" />
      <TeacherStatsGrid>
        <TeacherStatCard title="אינדיקציות" value={rows.length} hint="לסקירה" icon={Ear} tone="purple" />
        <TeacherStatCard title="מקורות" value={cameraRows.length} hint="מצלמות/אזורים" icon={Camera} tone="blue" />
        <TeacherStatCard title="מצב פרטיות" value="מוגבל" hint="ללא תמלול" icon={ShieldAlert} tone="green" />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות שמע">
        <TeacherActionTile title="אירועי תצפיתן" href="/dashboard/garden/ai-events" icon={Bot} tone="purple" />
        <TeacherActionTile title="מצלמות" href="/dashboard/garden/cameras" icon={Camera} tone="blue" />
        <TeacherActionTile title="בקשות מעקב" href="/dashboard/garden/observer-watch" icon={Ear} tone="orange" />
      </TeacherQuickActions>
      <TeacherSection title="אירועים לבדיקה" subtitle="שפה זהירה, ללא חשיפה להורים לפני בדיקה">
        <div className="teacher-embedded-module">
          <AudioObserverEventsPanel role="garden" fixedKindergartenId={gardenId} events={rows} cameras={cameraRows} />
        </div>
      </TeacherSection>
    </TeacherAppFrame>
  );
}
