import { Bell, CheckCircle2, MessageSquareText, ShieldAlert } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import {
  TeacherAppFrame,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherActionTile,
  TeacherEmptyState,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";
import { NotificationCenter } from "@/components/notification-center";
import { NotificationPreferencesPanel, type NotificationPreferences } from "@/components/parent-notification-preferences";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { managementDeliveryCapability } from "@/lib/management/external-delivery";

type GardenNotification = { read_at?: unknown; severity?: string | null };
type NotificationCenterProps = Parameters<typeof NotificationCenter>[0];
async function notificationQuery(label: string, query: () => PromiseLike<{ data: unknown; error: unknown }>) {
  try {
    const result = await query();
    logSupabaseError(label, result.error);
    return result.error ? { data: null, error: true } : { data: result.data, error: false };
  } catch {
    logSupabaseError(label, true);
    return { data: null, error: true };
  }
}

export default async function GardenNotificationsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const avatarUrl = (profile as any).profile_image_url ?? null;
  if (!profile.id || !profile.garden_id) {
    return <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="מרכז התראות הגן" avatarUrl={avatarUrl} active="messages"><AdminDataError message="לא ניתן לטעון התראות ללא פרופיל ושיוך לגן" /></TeacherAppFrame>;
  }
  const result = await safeAdminData("garden notifications", async () => {
    const supabase = await createClient();
    const [notificationsRes, preferencesRes, pushPreferencesRes] = await Promise.all([
      notificationQuery("garden notifications list", () => supabase.from("notifications" as any).select("*").or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id},garden_id.eq.${profile.garden_id},kindergarten_id.eq.${profile.garden_id}`).order("created_at", { ascending: false }).limit(120)),
      notificationQuery("garden notifications preferences", () => supabase.from("communication_preferences" as never).select("*").eq("profile_id", profile.id).maybeSingle()),
      notificationQuery("garden notifications categories", () => supabase.from("push_category_preferences" as never).select("category,enabled").eq("profile_id", profile.id))
    ]);
    const available = [!notificationsRes.error, !preferencesRes.error, !pushPreferencesRes.error];
    return { notifications: (notificationsRes.data ?? []) as GardenNotification[], preferences: preferencesRes.data as NotificationPreferences | null, pushPreferences: (pushPreferencesRes.data ?? []) as Array<{ category: string; enabled: boolean }>, available, queryError: available.some((value) => !value) ? "חלק מנתוני ההתראות לא נטענו" : null };
  }, { notifications: [] as GardenNotification[], preferences: null as NotificationPreferences | null, pushPreferences: [] as Array<{ category: string; enabled: boolean }>, available: [false, false, false], queryError: null as string | null });
  const { notifications, preferences, pushPreferences, available } = result.data;
  const preferencesAvailable = available[1] && available[2];
  const pushCategoryPreferences = Object.fromEntries(pushPreferences.map((row) => [row.category, row.enabled]));
  const unread = notifications.filter((item) => !item.read_at).length;
  const urgent = notifications.filter((item) => ["urgent", "critical"].includes(item.severity ?? "")).length;
  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="מרכז התראות הגן" avatarUrl={avatarUrl} active="messages">
      <TeacherPageTitle icon={Bell} title="מרכז ההתראות" subtitle="כל מה שדורש תשומת לב במקום אחד" />
      <AdminDataError message={result.error ?? result.data.queryError} />
      <TeacherStatsGrid>
        <TeacherStatCard title="התראות חדשות" value={available[0] ? unread : "לא זמין"} hint="ממתינות לקריאה" icon={Bell} tone={available[0] ? "purple" : "neutral"} />
        <TeacherStatCard title="דחופות" value={available[0] ? urgent : "לא זמין"} hint="לטיפול היום" icon={ShieldAlert} tone={!available[0] ? "neutral" : urgent ? "red" : "green"} />
        <TeacherStatCard title="סך הכל" value={available[0] ? notifications.length : "לא זמין"} hint="התראות אחרונות" icon={CheckCircle2} tone={available[0] ? "blue" : "neutral"} />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות התראה">
        <TeacherActionTile title="הודעות להורים" href="/dashboard/garden/messages" icon={MessageSquareText} tone="purple" />
        <TeacherActionTile title="בקשות הצטרפות" href="/dashboard/garden/enrollment-requests" icon={Bell} tone="blue" />
        <TeacherActionTile title="אירועים" href="/dashboard/garden/incidents" icon={ShieldAlert} tone="orange" />
      </TeacherQuickActions>
      <TeacherSection title="כל ההתראות" subtitle="הצגה מלאה עם פעולות קריאה ופתיחה">
        <div className="teacher-embedded-module">
          {available[0] ? <NotificationCenter notifications={notifications as NotificationCenterProps["notifications"]} /> : <TeacherEmptyState title="ההתראות לא זמינות" text="לא ניתן לטעון את רשימת ההתראות כרגע." />}
        </div>
      </TeacherSection>
      <TeacherSection title="העדפות ושעות שקט" subtitle="הערוצים מוצגים לפי מוכנות אמיתית של הספק.">
        {preferencesAvailable ? <NotificationPreferencesPanel preferences={preferences} pushCategoryPreferences={pushCategoryPreferences} capability={managementDeliveryCapability()} audienceLabel="עדכוני הניהול שלך" /> : <TeacherEmptyState title="ההעדפות לא זמינות" text="נדרשים נתוני העדפות וקטגוריות מלאים לפני ניהול ועדכון." />}
      </TeacherSection>
    </TeacherAppFrame>
  );
}
