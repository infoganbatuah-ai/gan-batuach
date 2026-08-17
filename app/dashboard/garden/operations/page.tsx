import { israelTodayDateKey } from "@/lib/domain/israel-date";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { ManagerOverviewDashboard } from "@/components/manager-overview-dashboard";
import { TeacherAppFrame } from "@/components/teacher-app-ui";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel, isSyntheticLabel } from "@/lib/domain/display-label";
import { createClient } from "@/lib/supabase/server";
import { buildOperationalHealthScore } from "@/lib/domain/kindergarten-operating-system";

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function safeScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function statusFromScore(score: number) {
  if (score >= 85) return "healthy";
  if (score >= 65) return "needs_attention";
  if (score >= 45) return "at_risk";
  return "blocked";
}

function statusText(value: string) {
  const map: Record<string, string> = {
    healthy: "יום יציב",
    needs_attention: "דורש תשומת לב",
    at_risk: "סיכון תפעולי",
    blocked: "חסום"
  };
  return map[value] ?? "דורש תשומת לב";
}

function timeText(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }).format(new Date(value));
}

export default async function GardenOperationsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  if (!gardenId) redirect("/dashboard/garden");

  const supabase = await createClient();
  const today = israelTodayDateKey();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [
    gardenRes,
    childrenRes,
    attendanceRes,
    journalsRes,
    staffRes,
    shiftsRes,
    scheduleRes,
    tasksRes,
    notificationsRes,
    messagesRes,
    documentsRes,
    pendingDocsRes,
    inspectionsRes,
    incidentsRes,
    complaintsRes,
    camerasRes,
    observerRes,
    paymentsRes,
    dailyOpsRes,
    healthScoreRes,
    workflowRes,
    complianceActionsRes,
    preventionActionsRes
  ] = await Promise.all([
    supabase.from("gardens" as any).select("id,name,city,approval_flow_status,final_approval_status,safe_status,last_inspection_score").eq("id", gardenId).maybeSingle(),
    supabase.from("children" as any).select("id,full_name,allergies,medical_notes,regular_medications,status,payment_status,monthly_fee", { count: "exact" }).eq("garden_id", gardenId),
    supabase.from("attendance" as any).select("id,child_id,status", { count: "exact" }).eq("garden_id", gardenId).eq("attendance_date", today),
    supabase.from("child_daily_journals" as any).select("child_id,meals,sleep_summary,health_notes,mood").eq("garden_id", gardenId).eq("journal_date", today),
    supabase.from("staff" as any).select("id,full_name,role_title,approved_to_work,onboarding_status", { count: "exact" }).eq("garden_id", gardenId),
    supabase.from("staff_shifts" as any).select("staff_id,clock_in_at,clock_out_at", { count: "exact" }).eq("garden_id", gardenId).eq("shift_date", today),
    supabase.from("schedule_items" as any).select("id,title,description,starts_at,ends_at").eq("garden_id", gardenId).gte("starts_at", dayStart.toISOString()).lt("starts_at", dayEnd.toISOString()).order("starts_at", { ascending: true }).limit(8),
    supabase.from("tasks" as any).select("id,title,status,task_type,due_at,source_entity_type,source_entity_id", { count: "exact" }).eq("garden_id", gardenId).neq("status", "done").order("created_at", { ascending: false }).limit(12),
    supabase.from("notifications" as any).select("id,title,body,status,entity_type,created_at", { count: "exact" }).eq("garden_id", gardenId).in("status", ["pending", "sent"]).is("read_at", null).order("created_at", { ascending: false }).limit(10),
    supabase.from("messages" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).is("read_at", null),
    supabase.from("documents" as any).select("id,status,expires_at", { count: "exact" }).eq("garden_id", gardenId).in("status", ["missing", "expired", "rejected", "pending_review"]).limit(30),
    supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).eq("status", "pending_review"),
    supabase.from("required_inspections" as any).select("id,title,status,due_at", { count: "exact" }).eq("garden_id", gardenId).neq("status", "done").order("due_at", { ascending: true }).limit(8),
    supabase.from("incident_reports" as any).select("id,title,severity,status,created_at", { count: "exact" }).eq("garden_id", gardenId).neq("status", "closed").order("created_at", { ascending: false }).limit(8),
    supabase.from("complaints" as any).select("id,status,severity,subject,created_at", { count: "exact" }).eq("garden_id", gardenId).neq("status", "closed").order("created_at", { ascending: false }).limit(8),
    supabase.from("camera_streams" as any).select("id,name,status,active", { count: "exact" }).eq("garden_id", gardenId),
    supabase.from("observer_intelligence_signals" as any).select("id,signal_type,severity,review_status,recommended_action,created_at", { count: "exact" }).eq("kindergarten_id", gardenId).in("review_status", ["needs_review", "reviewing", "escalated"]).order("created_at", { ascending: false }).limit(8),
    supabase.from("children" as any).select("id,payment_status,monthly_fee").eq("garden_id", gardenId).in("payment_status", ["overdue", "unpaid", "partial", "failed", "not_transferred"]),
    supabase.from("daily_operations" as any).select("*").eq("garden_id", gardenId).eq("operation_date", today).maybeSingle(),
    supabase.from("kindergarten_operational_health_scores" as any).select("*").eq("garden_id", gardenId).order("snapshot_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("operational_workflow_events" as any).select("*").eq("garden_id", gardenId).neq("event_status", "completed").order("created_at", { ascending: false }).limit(12),
    supabase.from("compliance_corrective_actions" as any).select("id,title,status,priority,due_date").eq("garden_id", gardenId).in("status", ["open", "in_progress", "overdue"]).order("created_at", { ascending: false }).limit(8),
    supabase.from("prevention_recommendation_actions" as any).select("id,title,status,priority,recommendation_type").eq("garden_id", gardenId).in("status", ["open", "in_progress", "approved"]).order("created_at", { ascending: false }).limit(8)
  ]);

  const garden = gardenRes.data as any;
  const onboardingStatus = String(garden?.approval_flow_status ?? garden?.final_approval_status ?? "");
  if ([
    "lead_approved_credentials_sent",
    "admin_approved",
    "profile_incomplete",
    "credentials_sent",
    "activation_in_progress",
    "payment_pending",
    "onboarding_in_progress",
    "onboarding_submitted",
    "pending_final_approval",
    "pending_final_admin_approval",
    "correction_required"
  ].includes(onboardingStatus)) redirect("/onboarding/kindergarten");

  const children = (childrenRes.data ?? []) as any[];
  const staff = (staffRes.data ?? []) as any[];
  const attendance = (attendanceRes.data ?? []) as any[];
  const journals = (journalsRes.data ?? []) as any[];
  const cameras = (camerasRes.data ?? []) as any[];
  const tasks = (tasksRes.data ?? []) as any[];
  const schedule = (scheduleRes.data ?? []) as any[];
  const workflows = (workflowRes.data ?? []) as any[];
  const docs = (documentsRes.data ?? []) as any[];
  const inspections = (inspectionsRes.data ?? []) as any[];
  const incidents = (incidentsRes.data ?? []) as any[];
  const complaints = (complaintsRes.data ?? []) as any[];
  const observerSignals = (observerRes.data ?? []) as any[];
  const complianceActions = (complianceActionsRes.data ?? []) as any[];
  const preventionActions = (preventionActionsRes.data ?? []) as any[];
  const unreadNotifications = (notificationsRes.data ?? []) as any[];
  const payments = (paymentsRes.data ?? []) as any[];

  const childCount = childrenRes.count ?? children.length;
  const staffCount = staffRes.count ?? staff.length;
  const presentChildren = attendance.filter((row) => row.status === "present").length;
  const attendanceCompletion = pct(attendance.length, childCount);
  const mealCompletion = pct(journals.filter((row) => Array.isArray(row.meals) && row.meals.length > 0).length, childCount);
  const sleepCompletion = pct(journals.filter((row) => row.sleep_summary).length, childCount);
  const healthCompletion = pct(journals.filter((row) => row.health_notes || row.mood).length, childCount);
  const childUpdatesCompletion = safeScore((mealCompletion + sleepCompletion + healthCompletion) / 3);
  const staffReady = staff.filter((row) => row.approved_to_work).length;
  const staffPresent = ((shiftsRes.data ?? []) as any[]).filter((row) => row.clock_in_at && !row.clock_out_at).length;
  const staffReadiness = staffCount ? pct(staffReady, staffCount) : 0;
  const cameraIssues = cameras.filter((camera) => camera.active === false || ["offline", "failed", "error", "disabled", "pending_gateway"].includes(String(camera.status))).length;
  const complianceIssues = docs.length + complianceActions.length;
  const openIncidents = incidents.length + complaints.length;
  const communicationItems = (messagesRes.count ?? 0) + unreadNotifications.length;
  const observerIssues = observerSignals.length + preventionActions.length + cameraIssues;
  const paymentIssues = payments.length;
  const syntheticSession = [profile.full_name, garden?.name].some(isSyntheticLabel);

  const liveHealth = buildOperationalHealthScore({
    attendanceCompletion,
    complianceReadiness: safeScore(100 - complianceIssues * 8),
    inspectionReadiness: safeScore(100 - inspections.length * 10),
    incidentReadiness: safeScore(100 - openIncidents * 10),
    communicationReadiness: safeScore(100 - communicationItems * 5),
    observerReadiness: safeScore(100 - observerIssues * 8)
  });

  const savedHealth = healthScoreRes.data as any;
  const healthScore = Number(savedHealth?.kindergarten_operational_health_score ?? liveHealth.score);
  const operationStatus = String((dailyOpsRes.data as any)?.operational_status ?? statusFromScore(healthScore));

  const unifiedTasks = [
    ...workflows.map((item) => ({
      id: item.id,
      title: item.event_title,
      source: item.source_type,
      status: item.event_status,
      href: item.task_id ? "/dashboard/garden/tasks" : "/dashboard/garden/operations",
      due: item.due_at
    })),
    ...tasks.map((item) => ({
      id: item.id,
      title: item.title,
      source: item.source_entity_type ?? item.task_type ?? "communications",
      status: item.status,
      href: "/dashboard/garden/tasks",
      due: item.due_at
    })),
    ...complianceActions.map((item) => ({
      id: item.id,
      title: item.title ?? "פעולת ציות",
      source: "compliance",
      status: item.status,
      href: "/dashboard/garden/compliance",
      due: item.due_date
    })),
    ...preventionActions.map((item) => ({
      id: item.id,
      title: item.title ?? "פעולת מניעה",
      source: "observer",
      status: item.status,
      href: "/dashboard/garden/risk",
      due: null
    }))
  ].slice(0, 12);

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="מערכת הפעלה" appHome>
      <TeacherAppFrame
        title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`}
        subtitle={`ברוכה הבאה ל${cleanSyntheticLabel(garden?.name, "הגן")}`}
        avatarUrl={(profile as any).profile_image_url ?? null}
        active="home"
      >
        {syntheticSession ? <div className="dashboard-environment-notice manager-demo-notice" role="status">סביבת בדיקה · נתונים סינתטיים בלבד</div> : null}
        <ManagerOverviewDashboard
          attendance={{ present: presentChildren, total: childCount, completion: attendanceCompletion }}
          staff={{ ready: staffReady, total: staffCount, present: staffPresent, names: staff.map((row) => cleanSyntheticLabel(row.full_name, "צוות")) }}
          safety={{ score: healthScore, label: statusText(operationStatus), detail: complianceIssues || openIncidents ? `${complianceIssues + openIncidents} פריטים דורשים טיפול` : "אין התראות פעילות" }}
          schedule={schedule.map((item) => ({ id: item.id, title: cleanSyntheticLabel(item.title, "פעילות"), time: `${timeText(item.starts_at)}${item.ends_at ? ` – ${timeText(item.ends_at)}` : ""}` }))}
          updates={unreadNotifications.map((item) => ({ id: item.id, title: cleanSyntheticLabel(item.title, "עדכון"), subtitle: cleanSyntheticLabel(item.body), time: timeText(item.created_at), tone: item.entity_type === "incident" ? "orange" as const : "purple" as const }))}
          tasks={unifiedTasks.map((task) => ({ id: `${task.source}-${task.id}`, title: cleanSyntheticLabel(task.title, "משימה"), subtitle: task.due ? `לביצוע עד ${timeText(task.due)}` : "ממתינה לטיפול", href: task.href }))}
          unreadMessages={messagesRes.count ?? 0}
        />
      </TeacherAppFrame>
    </DashboardShell>
  );
}
