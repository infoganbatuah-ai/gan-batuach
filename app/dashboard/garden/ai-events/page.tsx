import { Bot, Camera, Eye, ShieldCheck } from "lucide-react";
import {
  TeacherAppFrame,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherActionTile,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";
import { AiCameraEventsReview } from "@/components/ai-camera-events-review";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenAiCameraEventsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const events = profile.garden_id
    ? await supabase.from("ai_camera_events" as any).select("*, gardens(name), camera_streams(name, area)").eq("kindergarten_id", profile.garden_id).order("created_at", { ascending: false }).limit(100)
    : { data: [] };
  const rows = (events.data ?? []) as any[];
  const open = rows.filter((event) => ["new", "pending", "review"].includes(event.status ?? "")).length;
  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="אירועי תצפיתן לבדיקה" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
      <TeacherPageTitle icon={Bot} title="אירועי תצפיתן" subtitle="אינדיקציות לבדיקה אנושית בלבד, בלי מסקנות אוטומטיות" />
      <TeacherStatsGrid>
        <TeacherStatCard title="ממתינים לבדיקה" value={open} hint="דורשים review" icon={Eye} tone={open ? "orange" : "green"} />
        <TeacherStatCard title="אירועים" value={rows.length} hint="100 אחרונים" icon={Bot} tone="purple" />
        <TeacherStatCard title="מצלמות" value={new Set(rows.map((row) => row.camera_id).filter(Boolean)).size} hint="מקורות מעורבים" icon={Camera} tone="blue" />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות תצפיתן">
        <TeacherActionTile title="ניהול מצלמות" href="/dashboard/garden/cameras" icon={Camera} tone="blue" />
        <TeacherActionTile title="תובנות AI" href="/dashboard/garden/insights" icon={Bot} tone="purple" />
        <TeacherActionTile title="בטיחות" href="/dashboard/garden/risk" icon={ShieldCheck} tone="green" />
      </TeacherQuickActions>
      <TeacherSection title="רשימת אירועים" subtitle="כל פעולה נשארת בבדיקת אדם ומוגבלת לגן הנוכחי">
        <div className="teacher-embedded-module">
          <AiCameraEventsReview events={rows} role="garden" />
        </div>
      </TeacherSection>
    </TeacherAppFrame>
  );
}
