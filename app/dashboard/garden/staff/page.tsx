import { DashboardShell } from "@/components/dashboard-shell";
import { israelTodayDateKey } from "@/lib/domain/israel-date";
import { StaffProfileCards } from "@/components/people-profile-cards";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClipboardCheck, ShieldCheck, UserCheck, UsersRound } from "lucide-react";
import {
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherPageTitle,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

export default async function GardenStaffPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const today = israelTodayDateKey();
  const [staffRes, docsRes, tasksRes, shiftsRes, certsRes, anomaliesRes, scoresRes] = await Promise.all([
    supabase.from("staff" as any).select("id, profile_id, full_name, role_title, phone, email, approved_to_work, background_check_status, police_clearance_status, class_group, profile_photo_url, manager_approved_at, inspector_verified_at, created_at").eq("garden_id", gardenId).order("full_name"),
    supabase.from("documents" as any).select("staff_id, id, status").eq("garden_id", gardenId),
    supabase.from("tasks" as any).select("assigned_to, id, status").eq("garden_id", gardenId).neq("status", "done"),
    supabase.from("staff_shifts" as any).select("staff_id, actual_start, actual_end, shift_date, attendance_confidence, confidence_score, total_minutes, status").eq("garden_id", gardenId).eq("shift_date", today),
    supabase.from("staff_certificates" as any).select("staff_id, id").eq("garden_id", gardenId),
    supabase.from("staff_workforce_anomalies" as any).select("staff_id, id, anomaly_type, severity, status").eq("garden_id", gardenId).in("status", ["requires_review", "reviewing"]),
    supabase.from("staff_workforce_scores" as any).select("staff_id, readiness_score, attendance_score, document_score, compliance_score").eq("garden_id", gardenId).eq("score_date", today)
  ]);
  const countBy = (rows: any[], key: string, predicate = (_row: any) => true) => rows.reduce((map, row) => predicate(row) ? map.set(row[key], (map.get(row[key]) ?? 0) + 1) : map, new Map<string, number>());
  const missingDocs = countBy((docsRes.data ?? []) as any[], "staff_id", (row) => ["missing", "expired", "rejected"].includes(row.status));
  const certs = countBy((certsRes.data ?? []) as any[], "staff_id");
  const tasks = countBy((tasksRes.data ?? []) as any[], "assigned_to");
  const anomalies = countBy((anomaliesRes.data ?? []) as any[], "staff_id");
  const shifts = new Map(((shiftsRes.data ?? []) as any[]).map((row) => [row.staff_id, row]));
  const scores = new Map(((scoresRes.data ?? []) as any[]).map((row) => [row.staff_id, row]));
  const rows = ((staffRes.data ?? []) as any[]).map((member) => {
    const missing = missingDocs.get(member.id) ?? 0;
    const compliance = Math.max(0, 100 - missing * 25 - (member.approved_to_work ? 0 : 35) - (member.background_check_status === "valid" ? 0 : 20) - (member.police_clearance_status === "valid" ? 0 : 20));
    const shift = shifts.get(member.id) as any;
    const score = scores.get(member.id) as any;
    return {
      ...member,
      approval_status: member.approved_to_work ? "active" : "pending",
      missing_documents: missing,
      certificate_count: certs.get(member.id) ?? 0,
      task_count: tasks.get(member.profile_id) ?? 0,
      anomaly_count: anomalies.get(member.id) ?? 0,
      compliance_score: score?.readiness_score ?? compliance,
      attendance_confidence: shift?.attendance_confidence ?? "requires_review",
      shift_today: shift?.actual_start ? `זוהה/תה ${new Date(shift.actual_start).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` : null
    };
  });
  const activeToday = rows.filter((row) => row.shift_today).length;
  const reviewNeeded = rows.reduce((sum, row) => sum + Number(row.anomaly_count ?? 0), 0) + rows.filter((row) => row.attendance_confidence === "requires_review" && row.shift_today).length;

  return (
    <DashboardShell role="manager" title="צוות" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="ניהול צוות ושכר" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
        <TeacherPageTitle icon={UsersRound} title="ניהול צוות" subtitle="מי נמצא בגן, מי חסר ומה דורש בדיקה" />
        <TeacherStatsGrid>
          <TeacherStatCard title="אנשי צוות" value={rows.length} hint="משויכים לגן" icon={UsersRound} tone="purple" />
          <TeacherStatCard title="זוהו היום" value={activeToday} hint="נוכחים" icon={UserCheck} tone="green" />
          <TeacherStatCard title="דורש בדיקה" value={reviewNeeded} hint="חריגות / GPS" icon={ShieldCheck} tone={reviewNeeded ? "red" : "green"} />
          <TeacherStatCard title="מוכנות ממוצעת" value={`${Math.round(rows.reduce((sum, row) => sum + Number(row.compliance_score), 0) / Math.max(rows.length, 1))}%`} hint="מסמכים ותעודות" icon={ClipboardCheck} tone="blue" />
        </TeacherStatsGrid>

        <section className="teacher-dashboard-grid">
          <TeacherSection title="צוות בתפקיד" action={<a href="/dashboard/garden/staff-applications">מועמדויות</a>}>
            {rows.length ? (
              <TeacherCompactList>
                {rows.slice(0, 8).map((member) => (
                  <TeacherCompactItem
                    key={member.id}
                    title={member.full_name ?? "איש צוות"}
                    subtitle={`${member.role_title ?? "צוות"} · ${member.class_group ?? "כל הגן"}`}
                    avatar={member.profile_photo_url}
                    tone={member.approved_to_work ? "green" : "orange"}
                    meta={member.shift_today ?? (member.approved_to_work ? "מאושר" : "ממתין")}
                  />
                ))}
              </TeacherCompactList>
            ) : (
              <TeacherEmptyState title="עדיין אין צוות משויך" text="אפשר להזמין איש צוות או לאשר מועמדות קיימת." />
            )}
          </TeacherSection>

          <TeacherSection title="מסמכים ותעודות" subtitle="בדיקת כשירות לפני עבודה עם ילדים">
            <TeacherCompactList>
              <TeacherCompactItem title="תעודות חסרות" subtitle="אישורי הכשרה / עזרה ראשונה" tone={rows.filter((row) => !row.certificate_count).length ? "orange" : "green"} meta={rows.filter((row) => !row.certificate_count).length} />
              <TeacherCompactItem title="משימות פתוחות" subtitle="משימות שהוקצו לצוות" tone="blue" meta={rows.reduce((sum, row) => sum + Number(row.task_count ?? 0), 0)} />
              <TeacherCompactItem title="בדיקות רקע" subtitle="אישור עבודה ומסמכים רגישים" tone={reviewNeeded ? "red" : "green"} meta={reviewNeeded ? "בדיקה" : "תקין"} />
            </TeacherCompactList>
          </TeacherSection>
        </section>

        <details className="teacher-management-details">
          <summary>ניהול מלא</summary>
          <StaffProfileCards staff={rows} />
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
