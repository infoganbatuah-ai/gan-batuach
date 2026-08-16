import { redirect } from "next/navigation";
import { israelTodayDateKey } from "@/lib/domain/israel-date";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Baby,
  Bell,
  Camera,
  ClipboardCheck,
  CreditCard,
  FileText,
  HeartPulse,
  MessageSquare,
  Plus,
  ShieldCheck,
  UsersRound,
  WalletCards
} from "lucide-react";
import {
  TeacherActionTile,
  TeacherAiInsight,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

export const dynamic = "force-dynamic";

export default async function ManagerCommandCenterPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  if (!gardenId) redirect("/onboarding/kindergarten");

  const supabase = await createClient();
  const today = israelTodayDateKey();
  const [childrenRes, attendanceRes, staffRes, requestsRes, camerasRes, messagesRes] = await Promise.all([
    supabase.from("children" as any).select("id, payment_status", { count: "exact" }).eq("garden_id", gardenId),
    supabase.from("attendance" as any).select("child_id,status").eq("garden_id", gardenId).eq("attendance_date", today),
    supabase.from("staff" as any).select("id,approved_to_work", { count: "exact" }).eq("garden_id", gardenId),
    supabase.from("parent_child_requests" as any).select("id,status", { count: "exact" }).eq("garden_id", gardenId).in("status", ["new", "viewed", "in_progress"]),
    supabase.from("camera_streams" as any).select("id,status,active", { count: "exact" }).eq("garden_id", gardenId),
    supabase.from("messages" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).is("read_at", null)
  ]);

  const childCount = childrenRes.count ?? (childrenRes.data ?? []).length;
  const presentCount = (attendanceRes.data ?? []).filter((row: any) => row.status === "present").length;
  const staffCount = staffRes.count ?? (staffRes.data ?? []).length;
  const pendingRequests = requestsRes.count ?? (requestsRes.data ?? []).length;
  const cameraIssues = (camerasRes.data ?? []).filter((camera: any) => camera.active === false || !["online", "connected"].includes(String(camera.status))).length;
  const unreadMessages = messagesRes.count ?? 0;

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="ניהול הגן" appHome>
      <TeacherAppFrame
        title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`}
        subtitle="מרכז פעולות הגן"
        avatarUrl={(profile as any).profile_image_url ?? null}
        active="more"
      >
        <TeacherPageTitle icon={ShieldCheck} title="ניהול הגן" subtitle="כל הפעולות החשובות במקום אחד, באותה חוויית אפליקציה" />

        <TeacherStatsGrid>
          <TeacherStatCard title="ילדים" value={childCount} hint={`${presentCount} נוכחים היום`} icon={Baby} tone="purple" href="/dashboard/garden/children" />
          <TeacherStatCard title="צוות" value={staffCount} hint="ניהול ושיבוצים" icon={UsersRound} tone="blue" href="/dashboard/garden/staff" />
          <TeacherStatCard title="בקשות" value={pendingRequests} hint="ממתינות לטיפול" icon={Bell} tone={pendingRequests ? "orange" : "green"} href="/dashboard/garden/enrollment-requests" />
          <TeacherStatCard title="מצלמות" value={cameraIssues} hint="דורשות בדיקה" icon={Camera} tone={cameraIssues ? "red" : "green"} href="/dashboard/garden/cameras" />
        </TeacherStatsGrid>

        <TeacherQuickActions title="פעולות מרכזיות">
          <TeacherActionTile title="הוסף ילד" href="/dashboard/garden/children?new=1#new-child" icon={Plus} tone="purple" />
          <TeacherActionTile title="הוספת מצלמה" href="/dashboard/garden/cameras?add=1#camera-management" icon={Camera} tone="blue" />
          <TeacherActionTile title="בקשות הצטרפות" href="/dashboard/garden/enrollment-requests" icon={UsersRound} tone="orange" />
          <TeacherActionTile title="יעד תשלום" href="/dashboard/garden/finance?payout=1#payout-settings" icon={WalletCards} tone="green" />
          <TeacherActionTile title="חידוש מנוי" href="/dashboard/garden/subscription" icon={CreditCard} tone="purple" />
        </TeacherQuickActions>

        <section className="teacher-dashboard-grid">
          <TeacherSection title="ניהול יומי" subtitle="פעולות תפעול שוטפות">
            <TeacherCompactList>
              <TeacherCompactItem title="נוכחות וצ׳ק אין" subtitle="סימון הגעה, איחור ואיסוף" tone="green" href="/dashboard/garden/attendance" meta="פתיחה" />
              <TeacherCompactItem title="לוח יום ופעילויות" subtitle="יומן, ארוחות, שינה ועדכונים" tone="blue" href="/dashboard/garden/daily-journal" meta="יומן" />
              <TeacherCompactItem title="הודעות הורים" subtitle={`${unreadMessages} הודעות שלא נקראו`} tone={unreadMessages ? "orange" : "purple"} href="/dashboard/garden/messages" meta="הודעות" />
            </TeacherCompactList>
          </TeacherSection>

          <TeacherSection title="ניהול מתקדם" subtitle="כספים, צוות, מסמכים ודוחות">
            <TeacherCompactList>
              <TeacherCompactItem title="ניהול כספי הגן" subtitle="שכר לימוד הורים ויעד תשלום של הגן" tone="green" href="/dashboard/garden/finance" meta="כספים" />
              <TeacherCompactItem title="מסמכים ואישורים" subtitle="מסמכי גן, צוות ועמידה בדרישות" tone="purple" href="/dashboard/garden/documents" meta={<FileText size={16} />} />
              <TeacherCompactItem title="דיווחים ודוחות" subtitle="תמונת מצב ודוחות תפעול" tone="blue" href="/dashboard/garden/reports" meta={<ClipboardCheck size={16} />} />
            </TeacherCompactList>
          </TeacherSection>
        </section>

        <TeacherAiInsight metric={cameraIssues || pendingRequests ? "לטיפול" : "תקין"}>
          {cameraIssues ? "יש מצלמות שממתינות לבדיקה. מומלץ לפתוח את אזור המצלמות לפני פתיחת צפייה." : pendingRequests ? "יש בקשות הצטרפות חדשות שממתינות להחלטה." : "הפעולות המרכזיות נראות מסודרות כרגע."}
        </TeacherAiInsight>

        <TeacherQuickActions title="קיצורים נוספים">
          <TeacherActionTile title="בריאות ילדים" href="/dashboard/garden/health" icon={HeartPulse} tone="red" />
          <TeacherActionTile title="צוות ושכר" href="/dashboard/garden/staff" icon={UsersRound} tone="blue" />
          <TeacherActionTile title="תשלומי הורים" href="/dashboard/garden/finance" icon={WalletCards} tone="green" />
          <TeacherActionTile title="מנוי גן בטוח" href="/dashboard/garden/subscription" icon={CreditCard} tone="purple" />
          <TeacherActionTile title="תקשורת" href="/dashboard/garden/communication" icon={MessageSquare} tone="orange" />
        </TeacherQuickActions>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
