import { Bell, CheckCircle2, MessageSquareText, ShieldAlert } from "lucide-react";
import {
  TeacherAppFrame,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherActionTile,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";
import { NotificationCenter } from "@/components/notification-center";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenNotificationsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications" as any)
    .select("*")
    .or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id},garden_id.eq.${profile.garden_id},kindergarten_id.eq.${profile.garden_id}`)
    .order("created_at", { ascending: false })
    .limit(120);
  const notifications = (data ?? []) as any[];
  const unread = notifications.filter((item) => !item.read_at).length;
  const urgent = notifications.filter((item) => ["urgent", "critical"].includes(item.severity ?? "")).length;
  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="מרכז התראות הגן" avatarUrl={(profile as any).profile_image_url ?? null} active="messages">
      <TeacherPageTitle icon={Bell} title="מרכז ההתראות" subtitle="כל מה שדורש תשומת לב במקום אחד" />
      <TeacherStatsGrid>
        <TeacherStatCard title="התראות חדשות" value={unread} hint="ממתינות לקריאה" icon={Bell} tone="purple" />
        <TeacherStatCard title="דחופות" value={urgent} hint="לטיפול היום" icon={ShieldAlert} tone={urgent ? "red" : "green"} />
        <TeacherStatCard title="סך הכל" value={notifications.length} hint="התראות אחרונות" icon={CheckCircle2} tone="blue" />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות התראה">
        <TeacherActionTile title="הודעות להורים" href="/dashboard/garden/messages" icon={MessageSquareText} tone="purple" />
        <TeacherActionTile title="בקשות הצטרפות" href="/dashboard/garden/enrollment-requests" icon={Bell} tone="blue" />
        <TeacherActionTile title="אירועים" href="/dashboard/garden/incidents" icon={ShieldAlert} tone="orange" />
      </TeacherQuickActions>
      <TeacherSection title="כל ההתראות" subtitle="הצגה מלאה עם פעולות קריאה ופתיחה">
        <div className="teacher-embedded-module">
          <NotificationCenter notifications={notifications} />
        </div>
      </TeacherSection>
    </TeacherAppFrame>
  );
}
