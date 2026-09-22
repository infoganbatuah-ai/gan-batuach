import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  FileText,
  MessageCircle,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ReportsCenter } from "@/components/reports-center";
import { requireRole } from "@/lib/auth";
import { resolveReportRange } from "@/lib/management/reporting";
import { createClient } from "@/lib/supabase/server";
import {
  TeacherActionTile,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

export default async function GardenReportsPage({ searchParams }: { searchParams: Promise<{ manage?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const gardenRes = await supabase.from("gardens" as never).select("operational_timezone" as never).eq("id", gardenId).maybeSingle();
  const garden = gardenRes.data as unknown as { operational_timezone?: string | null } | null;
  const timezone = String(garden?.operational_timezone ?? "Asia/Jerusalem");
  const today = resolveReportRange(new URLSearchParams("range=today"), timezone).from;

  const [childrenRes, attendanceRes, incidentsRes, messagesRes, inspectionsRes] = await Promise.all([
    supabase.from("children" as never).select("id" as never, { count: "exact", head: true }).eq("garden_id", gardenId).in("status", ["active", "approved"]),
    supabase.from("attendance" as never).select("id,status" as never, { count: "exact" }).eq("garden_id", gardenId).eq("attendance_date", today),
    supabase.from("incident_reports" as never).select("id,status,created_at" as never, { count: "exact" }).eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(5),
    supabase.from("messages" as never).select("id,created_at" as never, { count: "exact" }).eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(5),
    supabase.from("required_inspections" as never).select("id,title,status,due_at" as never, { count: "exact" }).eq("garden_id", gardenId).order("due_at", { ascending: true }).limit(5)
  ]);

  type AttendanceRow = { status?: string | null };
  type IncidentRow = { id: string; status?: string | null; created_at?: string | null };
  type MessageRow = { id: string; created_at?: string | null };
  type InspectionRow = { id: string; title?: string | null; status?: string | null; due_at?: string | null };
  const attendance = (attendanceRes.data ?? []) as unknown as AttendanceRow[];
  const present = attendance.filter((row) => ["present", "checked_in", "checked_out"].includes(String(row.status))).length;
  const incidents = (incidentsRes.data ?? []) as unknown as IncidentRow[];
  const messages = (messagesRes.data ?? []) as unknown as MessageRow[];
  const inspections = (inspectionsRes.data ?? []) as unknown as InspectionRow[];
  const attendanceRate = Math.round((present / Math.max(childrenRes.count ?? 0, 1)) * 100);

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="דוחות" appHome>
      <TeacherAppFrame
        title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`}
        subtitle="דיווחים ודוחות גננת"
        avatarUrl={(profile as { profile_image_url?: string | null }).profile_image_url ?? null}
        active="more"
      >
        <TeacherPageTitle icon={BarChart3} title="דיווחים ודוחות" subtitle="תמונת מצב יומית מהנתונים הקיימים בגן" />

        <TeacherStatsGrid>
          <TeacherStatCard title="נוכחות היום" value={`${attendanceRate}%`} hint={`${present} נוכחים`} icon={UsersRound} tone="purple" href="/dashboard/garden/attendance" />
          <TeacherStatCard title="אירועים" value={incidentsRes.count ?? 0} hint="דיווחים" icon={ShieldCheck} tone={(incidentsRes.count ?? 0) ? "orange" : "green"} href="/dashboard/garden/incidents" />
          <TeacherStatCard title="הודעות" value={messagesRes.count ?? 0} hint="תקשורת" icon={MessageCircle} tone="blue" href="/dashboard/garden/messages" />
          <TeacherStatCard title="פיקוחים" value={inspectionsRes.count ?? 0} hint="משימות" icon={ClipboardCheck} tone="green" href="/dashboard/garden/inspections" />
        </TeacherStatsGrid>

        <section className="teacher-dashboard-grid">
          <TeacherSection title="דוחות זמינים" subtitle="קיצורי דרך לדוחות המרכזיים">
            <TeacherCompactList>
              <TeacherCompactItem title="דוח נוכחות יומי" subtitle="סיכום הגעה, איחורים וחוסרים" tone="purple" meta={`${attendanceRate}%`} href="/dashboard/garden/attendance" />
              <TeacherCompactItem title="דוח אירועים" subtitle="אירועים פתוחים וסגורים" tone={(incidentsRes.count ?? 0) ? "orange" : "green"} meta={incidentsRes.count ?? 0} href="/dashboard/garden/incidents" />
              <TeacherCompactItem title="דוח תקשורת" subtitle="הודעות ופניות הורים" tone="blue" meta={messagesRes.count ?? 0} href="/dashboard/garden/messages" />
            </TeacherCompactList>
          </TeacherSection>

          <TeacherSection title="עדכונים אחרונים" subtitle="מידע שמזין את הדוחות">
            {incidents.length || messages.length || inspections.length ? (
              <TeacherCompactList>
                {incidents.slice(0, 2).map((incident) => (
                  <TeacherCompactItem key={`incident-${incident.id}`} title="דיווח אירוע" subtitle={incident.created_at ? new Date(incident.created_at).toLocaleString("he-IL") : "תאריך לא ידוע"} tone="orange" meta={incident.status ?? "פתוח"} />
                ))}
                {messages.slice(0, 2).map((message) => (
                  <TeacherCompactItem key={`message-${message.id}`} title="הודעה חדשה" subtitle={message.created_at ? new Date(message.created_at).toLocaleString("he-IL") : "תאריך לא ידוע"} tone="blue" meta="תקשורת" />
                ))}
                {inspections.slice(0, 2).map((inspection) => (
                  <TeacherCompactItem key={`inspection-${inspection.id}`} title={inspection.title ?? "פיקוח"} subtitle={inspection.due_at ? new Date(inspection.due_at).toLocaleDateString("he-IL") : "תאריך לא נקבע"} tone="green" meta={inspection.status ?? "מעקב"} />
                ))}
              </TeacherCompactList>
            ) : (
              <TeacherEmptyState title="אין עדיין נתונים לדוחות" text="כאשר יתווספו נוכחות, הודעות, אירועים או פיקוחים, הם יופיעו כאן." />
            )}
          </TeacherSection>
        </section>

        <TeacherQuickActions title="פעולות דוחות">
          <TeacherActionTile title="דוח נוכחות" href="/dashboard/garden/attendance" icon={UsersRound} tone="purple" />
          <TeacherActionTile title="לוח יום" href="/dashboard/garden/daily-journal" icon={CalendarDays} tone="blue" />
          <TeacherActionTile title="אירועים" href="/dashboard/garden/incidents" icon={ShieldCheck} tone="orange" />
          <TeacherActionTile title="ייצוא וניהול" href="/dashboard/garden/reports?manage=1#reports-workbench" icon={FileText} tone="green" />
        </TeacherQuickActions>

        <details className="teacher-management-details" id="reports-workbench" open={params.manage === "1"}>
          <summary>מרכז דוחות מלא</summary>
          <ReportsCenter role={profile.role === "owner" ? "owner" : "manager"} gardenId={gardenId} />
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
