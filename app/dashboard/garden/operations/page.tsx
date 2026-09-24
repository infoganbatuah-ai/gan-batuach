import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { ManagerOverviewDashboard } from "@/components/manager-overview-dashboard";
import { TeacherAppFrame } from "@/components/teacher-app-ui";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel, isSyntheticLabel } from "@/lib/domain/display-label";
import { israelTodayDateKey } from "@/lib/domain/israel-date";
import { deriveAttendanceSummary, deriveTuitionSummary, safetyCapabilityState } from "@/lib/management/dashboard-read-model";
import { createClient } from "@/lib/supabase/server";

function timeText(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }).format(new Date(value));
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency }).format(value);
}

export default async function GardenOperationsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  if (!gardenId) redirect("/dashboard/garden");
  const supabase = await createClient();
  const today = israelTodayDateKey();
  const start = `${today}T00:00:00.000Z`;
  const end = `${today}T23:59:59.999Z`;
  const results = await Promise.all([
    supabase.from("gardens" as never).select("id,name,city,approval_flow_status,final_approval_status,operational_timezone" as never).eq("id", gardenId).maybeSingle(),
    supabase.from("child_kindergarten_enrollments" as never).select("id,child_id" as never, { count: "exact" }).eq("garden_id", gardenId).eq("status", "active").limit(500),
    supabase.from("attendance" as never).select("id,child_id,status" as never).eq("garden_id", gardenId).eq("attendance_date", today).limit(500),
    supabase.from("staff_kindergarten_employments" as never).select("id,staff_id" as never, { count: "exact" }).eq("garden_id", gardenId).eq("status", "active").limit(500),
    supabase.from("staff_shifts" as never).select("staff_id,actual_start,actual_end,status" as never).eq("garden_id", gardenId).eq("shift_date", today).limit(500),
    supabase.from("schedule_items" as never).select("id,title,starts_at,ends_at" as never).eq("garden_id", gardenId).gte("starts_at", start).lte("starts_at", end).order("starts_at").limit(8),
    supabase.from("tasks" as never).select("id,title,status,due_at,source_entity_type" as never, { count: "exact" }).eq("garden_id", gardenId).not("status", "in", "(done,completed,closed,cancelled)").order("created_at", { ascending: false }).limit(8),
    supabase.from("notifications" as never).select("id,title,source_domain,created_at" as never, { count: "exact" }).eq("garden_id", gardenId).eq("recipient_id", profile.id).is("read_at", null).is("archived_at", null).order("created_at", { ascending: false }).limit(6),
    supabase.from("tuition_billing_periods" as never).select("base_amount,adjustment_total,settled_total,status,due_at,currency" as never).eq("garden_id", gardenId).not("status", "in", "(paid,waived,cancelled)").limit(500),
    supabase.from("kindergarten_subscriptions" as never).select("status,billing_status,current_period_end,currency_snapshot" as never).eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("documents" as never).select("id,status,expires_at" as never, { count: "exact" }).eq("garden_id", gardenId).is("deleted_at", null).in("status", ["pending_review", "rejected", "expired"]).limit(100),
    supabase.from("complaints" as never).select("id,status,severity,created_at" as never, { count: "exact" }).eq("garden_id", gardenId).not("status", "in", "(resolved,closed,cancelled)").limit(100),
    supabase.from("required_inspections" as never).select("id,title,status,due_at" as never, { count: "exact" }).eq("garden_id", gardenId).neq("status", "done").order("due_at").limit(8),
    supabase.from("violations" as never).select("id,title,status,correction_due_at" as never, { count: "exact" }).eq("garden_id", gardenId).not("status", "in", "(closed,resolved,accepted)").limit(100),
    supabase.from("camera_streams" as never).select("id,status,active" as never).eq("garden_id", gardenId).limit(100),
    supabase.from("classrooms" as never).select("id,name,capacity_limit,status,child_classroom_assignments(id,is_current)" as never).eq("garden_id", gardenId).eq("status", "active").order("sort_order").limit(100),
    supabase.from("kindergarten_enrollment_requests" as never).select("id,status" as never).eq("garden_id", gardenId).in("status", ["submitted", "resubmitted", "under_review", "information_required", "awaiting_payment", "waitlisted"]).limit(200),
    supabase.from("messages" as never).select("id" as never, { count: "exact", head: true }).eq("garden_id", gardenId).is("read_at", null)
  ]);
  const [gardenRes, enrollmentRes, attendanceRes, employmentRes, shiftsRes, scheduleRes, tasksRes, notificationsRes, tuitionRes, subscriptionRes, documentsRes, complaintsRes, inspectionsRes, correctiveRes, camerasRes, classroomsRes, enrollmentRequestsRes, messagesRes] = results;
  const garden = gardenRes.data as Record<string, unknown> | null;
  const onboardingStatus = String(garden?.approval_flow_status ?? garden?.final_approval_status ?? "");
  if (["admin_approved", "credentials_sent", "activation_in_progress", "payment_pending", "onboarding_in_progress", "onboarding_submitted", "pending_final_approval", "pending_final_admin_approval", "correction_required"].includes(onboardingStatus)) redirect("/onboarding/kindergarten");

  const attendance = deriveAttendanceSummary((attendanceRes.data ?? []) as never[], enrollmentRes.count ?? 0);
  const shifts = (shiftsRes.data ?? []) as Array<{ actual_start?: unknown; actual_end?: unknown; status?: unknown }>;
  const tuition = deriveTuitionSummary((tuitionRes.data ?? []) as never[], today);
  const cameras = (camerasRes.data ?? []) as Array<{ active?: unknown; status?: unknown }>;
  const verifiedCameras = cameras.filter(camera => camera.active === true && ["online", "active", "verified"].includes(String(camera.status))).length;
  const safety = safetyCapabilityState({ configuredCameraCount: cameras.length, verifiedOperationalCount: verifiedCameras, providerReady: verifiedCameras > 0 });
  const sourceErrors = results.filter(result => result.error).length;
  const schedule = (scheduleRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const tasks = (tasksRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const notifications = (notificationsRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const subscription = subscriptionRes.data as Record<string, unknown> | null;
  const classroomRows = (classroomsRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const enrollmentRequests = (enrollmentRequestsRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const syntheticSession = [profile.full_name, String(garden?.name ?? "")].some(isSyntheticLabel);
  const dateLabel = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jerusalem" }).format(new Date());

  return <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="מרכז תפעול" appHome>
    <TeacherAppFrame role={profile.role === "owner" ? "owner" : "manager"} title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle={`מרכז התפעול של ${cleanSyntheticLabel(String(garden?.name ?? ""), "הגן")}`} avatarUrl={(profile as { profile_image_url?: string | null }).profile_image_url ?? null} active="home">
      {syntheticSession ? <div className="dashboard-environment-notice manager-demo-notice" role="status">סביבת בדיקה · נתונים סינתטיים בלבד</div> : null}
      {sourceErrors ? <div className="error-banner" role="alert">{sourceErrors} מקורות נתונים אינם זמינים כרגע. הכרטיסים האחרים ממשיכים להציג מידע מאומת.</div> : null}
      <ManagerOverviewDashboard
        garden={{ name: cleanSyntheticLabel(String(garden?.name ?? ""), "הגן"), city: cleanSyntheticLabel(String(garden?.city ?? ""), ""), dateLabel }}
        attendance={{ present: attendance.present, absent: attendance.absent, departed: attendance.departed, total: attendance.expected, notRecorded: Math.max(0, attendance.expected - attendance.recorded), completion: attendance.completion }}
        staff={{ active: employmentRes.count ?? 0, scheduled: shifts.length, present: shifts.filter(row => row.actual_start && !row.actual_end).length, missingClockOut: shifts.filter(row => ["missing_clock_out", "correction_required"].includes(String(row.status))).length }}
        safety={{ state: safety.state, label: safety.label, detail: safety.state === "verified" ? "יכולת תפעולית מאומתת" : "אין הצגה של ניטור או אירועי AI לא מאומתים", cameras: cameras.length, operationalCameras: verifiedCameras }}
        classrooms={classroomRows.map((room) => ({ id: String(room.id), name: cleanSyntheticLabel(String(room.name ?? ""), "כיתה"), capacity: room.capacity_limit == null ? null : Number(room.capacity_limit), assigned: Array.isArray(room.child_classroom_assignments) ? room.child_classroom_assignments.filter((assignment: Record<string, unknown>) => assignment.is_current === true).length : 0 }))}
        enrollment={{ open: enrollmentRequests.length, informationRequired: enrollmentRequests.filter(row => row.status === "information_required").length, waitlisted: enrollmentRequests.filter(row => row.status === "waitlisted").length, awaitingPayment: enrollmentRequests.filter(row => row.status === "awaiting_payment").length }}
        finance={{ outstanding: money(tuition.outstanding, tuition.currency), overdue: tuition.overdue, reconciliation: tuition.reconciliation, subscription: String(subscription?.billing_status ?? subscription?.status ?? "לא הוגדר") }}
        operations={{ tasks: tasksRes.count ?? tasks.length, complaints: complaintsRes.count ?? 0, documents: documentsRes.count ?? 0, inspections: inspectionsRes.count ?? 0, correctiveActions: correctiveRes.count ?? 0 }}
        schedule={schedule.map(item => ({ id: String(item.id), title: cleanSyntheticLabel(String(item.title ?? ""), "פעילות"), time: `${timeText(item.starts_at as string)}${item.ends_at ? ` – ${timeText(item.ends_at as string)}` : ""}` }))}
        updates={notifications.map(item => ({ id: String(item.id), title: cleanSyntheticLabel(String(item.title ?? ""), "עדכון"), subtitle: "עדכון חדש במערכת", time: timeText(item.created_at as string), tone: "purple" as const }))}
        tasks={tasks.map(task => ({ id: String(task.id), title: cleanSyntheticLabel(String(task.title ?? ""), "משימה"), subtitle: task.due_at ? `לביצוע עד ${new Date(String(task.due_at)).toLocaleDateString("he-IL")}` : "ממתינה לטיפול", href: "/dashboard/garden/tasks" }))}
        unreadMessages={messagesRes.count ?? notifications.filter(item => item.source_domain === "messaging").length}
      />
      <p className="dashboard-source-note">הכרטיסים נגזרים ממקורות הנוכחות, שעות הצוות, שכר הלימוד, המנוי, המסמכים והפיקוח הקנוניים. <Link href="/dashboard/garden/reports">פתיחת דוחות</Link></p>
    </TeacherAppFrame>
  </DashboardShell>;
}
