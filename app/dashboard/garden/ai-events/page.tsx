import { Bot, Camera, Eye, ShieldCheck } from "lucide-react";
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
import { AiCameraEventsReview } from "@/components/ai-camera-events-review";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function GardenAiCameraEventsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  type EventRow = Record<string, unknown> & { status?: string | null; camera_id?: unknown };
  const unavailable = { rows: [] as EventRow[], available: false };
  const { data } = await safeAdminData("garden ai events", async () => {
    if (!profile.garden_id) return unavailable;
    const supabase = await createClient();
    try {
      const events = await supabase.from("ai_camera_events" as any).select("*, gardens(name), camera_streams(name, area)").eq("kindergarten_id", profile.garden_id).order("created_at", { ascending: false }).limit(100);
      logSupabaseError("garden ai events query", events.error);
      return { rows: (events.error ? [] : events.data ?? []) as EventRow[], available: !events.error };
    } catch (error) {
      logSupabaseError("garden ai events query", error);
      return unavailable;
    }
  }, unavailable);
  const rows = data.rows;
  const eventsAvailable = Boolean(profile.garden_id) && data.available;
  const open = rows.filter((event) => ["new", "pending", "review"].includes(event.status ?? "")).length;
  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="אירועי תצפיתן לבדיקה" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
      <TeacherPageTitle icon={Bot} title="אירועי תצפיתן" subtitle="אינדיקציות לבדיקה אנושית בלבד, בלי מסקנות אוטומטיות" />
      <TeacherStatsGrid>
        <TeacherStatCard title="ממתינים לבדיקה" value={eventsAvailable ? open : "לא זמין"} hint="דורשים review" icon={Eye} tone={eventsAvailable ? open ? "orange" : "green" : "neutral"} />
        <TeacherStatCard title="אירועים" value={eventsAvailable ? rows.length : "לא זמין"} hint="100 אחרונים" icon={Bot} tone={eventsAvailable ? "purple" : "neutral"} />
        <TeacherStatCard title="מצלמות" value={eventsAvailable ? new Set(rows.map((row) => row.camera_id).filter(Boolean)).size : "לא זמין"} hint="מקורות מעורבים" icon={Camera} tone={eventsAvailable ? "blue" : "neutral"} />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות תצפיתן">
        <TeacherActionTile title="ניהול מצלמות" href="/dashboard/garden/cameras" icon={Camera} tone="blue" />
        <TeacherActionTile title="תובנות AI" href="/dashboard/garden/insights" icon={Bot} tone="purple" />
        <TeacherActionTile title="בטיחות" href="/dashboard/garden/risk" icon={ShieldCheck} tone="green" />
      </TeacherQuickActions>
      <TeacherSection title="רשימת אירועים" subtitle="כל פעולה נשארת בבדיקת אדם ומוגבלת לגן הנוכחי">
        {eventsAvailable ? <div className="teacher-embedded-module">
          <AiCameraEventsReview events={rows} role="garden" />
        </div> : <TeacherEmptyState title="נתוני האירועים אינם זמינים" text="לא ניתן לסקור אירועים עד לטעינה תקינה של נתוני הגן." />}
      </TeacherSection>
    </TeacherAppFrame>
  );
}
