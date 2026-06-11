import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Baby,
  Bot,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  ListChecks,
  MessageSquare,
  ShieldCheck,
  UsersRound,
  WalletCards
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { buildOperationalHealthScore, kosTone, sourceLabel, statusLabel } from "@/lib/domain/kindergarten-operating-system";
import { createClient } from "@/lib/supabase/server";

function pct(done: number, total: number) {
  return total ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 100;
}

function score(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function dateText(value?: string | null) {
  if (!value) return "לא נקבע";
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function timeText(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function money(value: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(value);
}

export default async function ManagerCommandCenterPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  if (!gardenId) redirect("/dashboard/garden");

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  const [
    gardenRes,
    childrenRes,
    attendanceRes,
    journalsRes,
    staffRes,
    shiftsRes,
    tasksRes,
    workflowRes,
    documentsRes,
    inspectionsRes,
    findingsRes,
    complianceActionsRes,
    incidentsRes,
    complaintsRes,
    parentRequestsRes,
    camerasRes,
    observerRes,
    preventionRes,
    messagesRes,
    notificationsRes,
    paymentsRes,
    healthScoreRes,
    dailyOperationRes,
    checklistRes,
    lastInspectionRes
  ] = await Promise.all([
    supabase.from("gardens" as any).select("id,name,city,logo_url,image_url,approval_flow_status,final_approval_status,last_inspection_score,safe_status").eq("id", gardenId).maybeSingle(),
    supabase.from("children" as any).select("id,full_name,allergies,medical_notes,regular_medications,payment_status,monthly_fee", { count: "exact" }).eq("garden_id", gardenId),
    supabase.from("attendance" as any).select("child_id,status,check_in_at,check_out_at,pickup_name,created_at,updated_at", { count: "exact" }).eq("garden_id", gardenId).eq("attendance_date", today),
    supabase.from("child_daily_journals" as any).select("child_id,meals,sleep_summary,health_notes,mood,incidents").eq("garden_id", gardenId).eq("journal_date", today),
    supabase.from("staff" as any).select("id,full_name,role_title,approved_to_work,onboarding_status,background_check_status,police_clearance_status", { count: "exact" }).eq("garden_id", gardenId),
    supabase.from("staff_shifts" as any).select("staff_id,actual_start,actual_end,status").eq("garden_id", gardenId).eq("shift_date", today),
    supabase.from("tasks" as any).select("id,title,status,task_type,source_entity_type,due_at", { count: "exact" }).eq("garden_id", gardenId).neq("status", "done").order("created_at", { ascending: false }).limit(12),
    supabase.from("operational_workflow_events" as any).select("id,event_title,event_status,source_type,due_at,task_id").eq("garden_id", gardenId).neq("event_status", "completed").order("created_at", { ascending: false }).limit(12),
    supabase.from("documents" as any).select("id,name,document_type,status,expires_at", { count: "exact" }).eq("garden_id", gardenId).or(`status.in.(missing,expired,rejected,pending_review),expires_at.lte.${soon}`).order("expires_at", { ascending: true }).limit(12),
    supabase.from("required_inspections" as any).select("id,title,status,due_at", { count: "exact" }).eq("garden_id", gardenId).neq("status", "done").order("due_at", { ascending: true }).limit(8),
    supabase.from("national_compliance_findings" as any).select("id,title,resolution_status,due_at,severity").eq("garden_id", gardenId).in("resolution_status", ["open", "in_progress"]).order("due_at", { ascending: true }).limit(8),
    supabase.from("compliance_corrective_actions" as any).select("id,action_title,status,priority,due_at").eq("garden_id", gardenId).in("status", ["identified", "assigned", "in_progress", "ready_for_verification"]).order("created_at", { ascending: false }).limit(8),
    supabase.from("incident_reports" as any).select("id,title,severity,status,created_at", { count: "exact" }).eq("garden_id", gardenId).neq("status", "closed").order("created_at", { ascending: false }).limit(8),
    supabase.from("complaints" as any).select("id,subject,severity,status,created_at", { count: "exact" }).eq("garden_id", gardenId).neq("status", "closed").order("created_at", { ascending: false }).limit(8),
    supabase.from("parent_child_requests" as any).select("id,request_type,content,status,created_at", { count: "exact" }).eq("garden_id", gardenId).in("status", ["new", "viewed", "in_progress"]).order("created_at", { ascending: false }).limit(8),
    supabase.from("camera_streams" as any).select("id,name,status,active", { count: "exact" }).eq("garden_id", gardenId),
    supabase.from("observer_intelligence_signals" as any).select("id,signal_type,severity,review_status,recommended_action,created_at", { count: "exact" }).eq("kindergarten_id", gardenId).in("review_status", ["needs_review", "reviewing", "escalated"]).order("created_at", { ascending: false }).limit(8),
    supabase.from("prevention_recommendation_actions" as any).select("id,title,status,priority,recommendation_type").eq("garden_id", gardenId).in("status", ["open", "in_progress", "approved"]).order("created_at", { ascending: false }).limit(8),
    supabase.from("messages" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).is("read_at", null),
    supabase.from("notifications" as any).select("id,title,body,entity_type,created_at", { count: "exact" }).eq("garden_id", gardenId).in("status", ["pending", "sent"]).is("read_at", null).order("created_at", { ascending: false }).limit(8),
    supabase.from("children" as any).select("id,payment_status,monthly_fee").eq("garden_id", gardenId),
    supabase.from("kindergarten_operational_health_scores" as any).select("*").eq("garden_id", gardenId).order("snapshot_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("daily_operations" as any).select("*").eq("garden_id", gardenId).eq("operation_date", today).maybeSingle(),
    supabase.from("manager_daily_checklist_status" as any).select("*").eq("garden_id", gardenId).eq("checklist_date", today),
    supabase.from("inspections" as any).select("id,completed_at,weighted_score,violation_count,status").eq("garden_id", gardenId).eq("status", "done").order("completed_at", { ascending: false }).limit(1).maybeSingle()
  ]);

  const garden = gardenRes.data as any;
  const onboardingStatus = String(garden?.approval_flow_status ?? garden?.final_approval_status ?? "");
  if (["credentials_sent", "onboarding_in_progress", "onboarding_submitted", "pending_final_approval", "pending_final_admin_approval", "correction_required", "profile_incomplete"].includes(onboardingStatus)) redirect("/onboarding/kindergarten");

  const children = (childrenRes.data ?? []) as any[];
  const attendance = (attendanceRes.data ?? []) as any[];
  const journals = (journalsRes.data ?? []) as any[];
  const staff = (staffRes.data ?? []) as any[];
  const shifts = (shiftsRes.data ?? []) as any[];
  const tasks = (tasksRes.data ?? []) as any[];
  const workflows = (workflowRes.data ?? []) as any[];
  const documents = (documentsRes.data ?? []) as any[];
  const inspections = (inspectionsRes.data ?? []) as any[];
  const findings = (findingsRes.data ?? []) as any[];
  const complianceActions = (complianceActionsRes.data ?? []) as any[];
  const incidents = (incidentsRes.data ?? []) as any[];
  const complaints = (complaintsRes.data ?? []) as any[];
  const parentRequests = (parentRequestsRes.data ?? []) as any[];
  const cameras = (camerasRes.data ?? []) as any[];
  const observerSignals = (observerRes.data ?? []) as any[];
  const prevention = (preventionRes.data ?? []) as any[];
  const notices = (notificationsRes.data ?? []) as any[];
  const payments = (paymentsRes.data ?? []) as any[];
  const checklistRows = (checklistRes.data ?? []) as any[];
  const dailyOperation = dailyOperationRes.data as any;
  const lastInspection = lastInspectionRes.data as any;

  const childCount = childrenRes.count ?? children.length;
  const presentChildren = attendance.filter((row) => row.status === "present").length;
  const absentChildren = attendance.filter((row) => row.status === "absent").length;
  const missingAttendance = Math.max(0, childCount - attendance.length);
  const updatedChildren = new Set(journals.map((row) => row.child_id)).size;
  const missingChildUpdates = Math.max(0, childCount - updatedChildren);
  const healthChildren = children.filter((child) => child.allergies || child.medical_notes || child.regular_medications);
  const staffCount = staffRes.count ?? staff.length;
  const activeStaff = shifts.filter((row) => row.actual_start && !row.actual_end).length;
  const staffAbsent = Math.max(0, staffCount - activeStaff);
  const staffGaps = staff.filter((member) => !member.approved_to_work || member.onboarding_status !== "active" || member.background_check_status === "missing" || member.police_clearance_status === "missing").length;
  const cameraIssues = cameras.filter((camera) => camera.active === false || ["offline", "failed", "error", "disabled", "pending_gateway"].includes(String(camera.status))).length;
  const complianceIssues = documents.length + findings.length + complianceActions.length;
  const unresolvedIncidents = incidents.length + complaints.length;
  const observerAlerts = observerSignals.length + prevention.length;
  const communicationItems = (messagesRes.count ?? 0) + notices.length + parentRequests.length;
  const expectedPayments = payments.reduce((sum, child) => sum + Number(child.monthly_fee ?? 0), 0);
  const overduePayments = payments.filter((child) => ["overdue", "unpaid", "partial", "failed", "not_transferred"].includes(String(child.payment_status))).length;
  const receivedPayments = payments.filter((child) => child.payment_status === "paid").reduce((sum, child) => sum + Number(child.monthly_fee ?? 0), 0);

  const liveHealth = buildOperationalHealthScore({
    attendanceCompletion: pct(attendance.length, childCount),
    complianceReadiness: score(100 - complianceIssues * 7),
    inspectionReadiness: score(100 - inspections.length * 10 - findings.length * 8),
    incidentReadiness: score(100 - unresolvedIncidents * 10),
    communicationReadiness: score(100 - communicationItems * 5),
    observerReadiness: score(100 - observerAlerts * 8 - cameraIssues * 6)
  });
  const savedHealth = healthScoreRes.data as any;
  const healthScore = Number(savedHealth?.kindergarten_operational_health_score ?? liveHealth.score);
  const healthTone = kosTone(healthScore);

  const unifiedQueue = [
    ...workflows.map((item) => ({ id: item.id, title: item.event_title, source: item.source_type, status: item.event_status, due: item.due_at, href: item.task_id ? "/dashboard/garden/tasks" : "/dashboard/garden/command-center" })),
    ...tasks.map((item) => ({ id: item.id, title: item.title, source: item.source_entity_type ?? item.task_type ?? "communications", status: item.status, due: item.due_at, href: "/dashboard/garden/tasks" })),
    ...complianceActions.map((item) => ({ id: item.id, title: item.action_title ?? "פעולת ציות", source: "compliance", status: item.status, due: item.due_at, href: "/dashboard/garden/compliance" })),
    ...prevention.map((item) => ({ id: item.id, title: item.title ?? "פעולת מניעה", source: "observer", status: item.status, due: null, href: "/dashboard/garden/risk" }))
  ].slice(0, 12);

  const briefing = [
    { text: `${missingChildUpdates} ילדים בלי עדכון`, href: "/dashboard/garden/child-journal", tone: missingChildUpdates ? "warn" as const : "good" as const },
    { text: `${staffGaps} פערי צוות`, href: "/dashboard/garden/staff", tone: staffGaps ? "warn" as const : "good" as const },
    { text: `${documents.length} מסמכים/תעודות לבדיקה`, href: "/dashboard/garden/compliance", tone: documents.length ? "warn" as const : "good" as const },
    { text: `${inspections.length} ביקורות או פעולות פיקוח`, href: "/dashboard/garden/inspections", tone: inspections.length ? "warn" as const : "good" as const },
    { text: `${communicationItems} הודעות והתראות`, href: "/dashboard/garden/notifications", tone: communicationItems ? "warn" as const : "good" as const }
  ];
  const dailyFocus = [
    inspections.length ? { title: "ביקורת או פעולת פיקוח ממתינה", text: `${inspections.length} פריטים פתוחים`, href: "/dashboard/garden/inspections", priority: 88, tone: "warn" as const } : null,
    documents.length ? { title: "מסמכים דורשים טיפול", text: `${documents.length} חסרים, פגי תוקף או לבדיקה`, href: "/dashboard/garden/compliance", priority: 84, tone: "warn" as const } : null,
    parentRequests.length || (messagesRes.count ?? 0) ? { title: "הורים מחכים לתשובה", text: `${parentRequests.length + (messagesRes.count ?? 0)} פניות/הודעות`, href: "/dashboard/garden/communication", priority: 80, tone: "warn" as const } : null,
    healthChildren.length ? { title: "דגשי בריאות לילדים", text: `${healthChildren.length} ילדים עם אלרגיה או הערה רפואית`, href: "/dashboard/garden/children?view=attention", priority: 76, tone: "warn" as const } : null,
    staffGaps || staffAbsent ? { title: "צוות דורש בדיקה", text: `${staffGaps} פערי אישור · ${staffAbsent} לא במשמרת`, href: "/dashboard/garden/staff", priority: 72, tone: "warn" as const } : null,
    overduePayments ? { title: "תשלום דורש טיפול", text: `${overduePayments} יתרות או תשלומים פתוחים`, href: "/dashboard/garden/finance", priority: 68, tone: "warn" as const } : null,
    observerAlerts ? { title: "אירוע תצפיתן לבדיקה", text: `${observerAlerts} סימנים ממתינים לבדיקה אנושית`, href: "/dashboard/garden/observer-intelligence", priority: 64, tone: "warn" as const } : null
  ].filter(Boolean).sort((a: any, b: any) => b.priority - a.priority).slice(0, 5) as Array<{ title: string; text: string; href: string; tone: "good" | "warn" | "bad" | "default" }>;
  const smartAlerts = [
    ...incidents.map((item) => ({ id: `incident-${item.id}`, category: "critical", title: item.title ?? "אירוע פתוח", text: statusLabel(item.status), href: "/dashboard/garden/incidents", time: item.created_at })),
    ...complaints.map((item) => ({ id: `complaint-${item.id}`, category: item.severity === "critical" ? "critical" : "important", title: item.subject ?? "פניית הורה", text: statusLabel(item.status), href: "/dashboard/garden/parents", time: item.created_at })),
    ...observerSignals.map((item) => ({ id: `observer-${item.id}`, category: item.severity === "critical" ? "critical" : "important", title: item.recommended_action ?? "סימן תצפיתן לבדיקה", text: sourceLabel(item.signal_type), href: "/dashboard/garden/observer-intelligence", time: item.created_at })),
    ...notices.map((item) => ({ id: `notice-${item.id}`, category: "information", title: item.title ?? "התראה", text: item.body ?? "עדכון חדש", href: "/dashboard/garden/notifications", time: item.created_at }))
  ].sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime()).slice(0, 9);
  const gardenTimeline = [
    ...attendance.filter((item) => item.check_in_at || item.check_out_at).map((item) => ({ id: `attendance-${item.child_id}-${item.updated_at}`, type: "נוכחות", title: item.status === "present" ? "ילד/ה הגיע/ה" : item.status === "absent" ? "סומן היעדרות" : "נוכחות עודכנה", text: item.pickup_name ? `איסוף: ${item.pickup_name}` : statusLabel(item.status), href: "/dashboard/garden/attendance", time: item.check_out_at ?? item.check_in_at ?? item.updated_at ?? item.created_at })),
    ...parentRequests.map((item) => ({ id: `parent-${item.id}`, type: "הורים", title: item.request_type ?? "פניית הורה", text: item.content, href: "/dashboard/garden/communication", time: item.created_at })),
    ...incidents.map((item) => ({ id: `incident-${item.id}`, type: "אירוע", title: item.title ?? "אירוע", text: statusLabel(item.status), href: "/dashboard/garden/incidents", time: item.created_at })),
    ...observerSignals.map((item) => ({ id: `signal-${item.id}`, type: "תצפיתן", title: item.recommended_action ?? "בדיקה מומלצת", text: sourceLabel(item.signal_type), href: "/dashboard/garden/observer-intelligence", time: item.created_at })),
    ...inspections.map((item) => ({ id: `inspection-${item.id}`, type: "פיקוח", title: item.title ?? "פעולת פיקוח", text: dateText(item.due_at), href: "/dashboard/garden/inspections", time: item.due_at })),
    ...shifts.filter((item) => item.actual_start).map((item) => ({ id: `shift-${item.staff_id}-${item.actual_start}`, type: "צוות", title: item.actual_end ? "משמרת נסגרה" : "איש צוות הגיע", text: statusLabel(item.status), href: "/dashboard/garden/staff", time: item.actual_end ?? item.actual_start }))
  ].sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime()).slice(0, 10);
  const openingChecklist = [
    { key: "staff_arrived", label: "צוות הגיע", done: activeStaff > 0, count: activeStaff },
    { key: "cameras_online", label: "מצלמות תקינות", done: cameraIssues === 0, count: cameras.length - cameraIssues },
    { key: "attendance_active", label: "נוכחות פעילה", done: attendance.length > 0, count: attendance.length },
    { key: "inspections_clear", label: "פיקוח ברור", done: inspections.length === 0, count: inspections.length },
    { key: "alerts_reviewed", label: "התראות נבדקו", done: smartAlerts.filter((item) => item.category !== "information").length === 0, count: smartAlerts.length }
  ];
  const closingChecklist = [
    { key: "children_left", label: "ילדים יצאו", done: childCount > 0 && attendance.filter((item) => item.check_out_at).length >= childCount, count: attendance.filter((item) => item.check_out_at).length },
    { key: "attendance_complete", label: "נוכחות מלאה", done: missingAttendance === 0, count: attendance.length },
    { key: "incidents_reviewed", label: "אירועים נבדקו", done: incidents.length === 0, count: incidents.length },
    { key: "updates_sent", label: "עדכונים נשלחו", done: missingChildUpdates === 0, count: updatedChildren },
    { key: "tasks_closed", label: "משימות פתוחות נבדקו", done: unifiedQueue.length === 0, count: unifiedQueue.length }
  ];
  const oneTapActions = [
    { title: "עדכון ילד", href: "/dashboard/garden/child-journal", icon: Baby, tone: "good" as const },
    { title: "שליחת עדכון", href: "/dashboard/garden/communication", icon: MessageSquare, tone: "good" as const },
    { title: "דיווח אירוע", href: "/dashboard/garden/incidents", icon: AlertTriangle, tone: "warn" as const },
    { title: "מצלמות", href: "/dashboard/garden/cameras", icon: Camera, tone: cameraIssues ? "warn" as const : "default" as const },
    { title: "נוכחות", href: "/dashboard/garden/attendance", icon: Clock, tone: missingAttendance ? "warn" as const : "good" as const },
    { title: "הודעה", href: "/dashboard/garden/messages", icon: MessageSquare, tone: communicationItems ? "warn" as const : "default" as const },
    { title: "ביקורת", href: "/dashboard/garden/inspections", icon: CalendarClock, tone: inspections.length ? "warn" as const : "default" as const },
    { title: "מסמך", href: "/dashboard/garden/documents", icon: FileText, tone: documents.length ? "warn" as const : "default" as const }
  ];
  const aiSuggestions = [
    missingChildUpdates ? `שלחי עדכון יומי ל-${missingChildUpdates} ילדים.` : "כל הילדים עודכנו היום.",
    documents.length ? `בדקי ${documents.length} מסמכים שתוקפם קרוב או חסרים.` : "אין מסמכים דחופים כרגע.",
    parentRequests.length ? `עני ל-${parentRequests.length} פניות הורים פתוחות.` : "אין פניות הורים שממתינות לתגובה.",
    cameraIssues ? `בדקי ${cameraIssues} מצלמות שלא זמינות.` : "המצלמות נראות תקינות.",
    inspections.length ? `הכיני את הגן לביקורת הקרובה.` : "אין ביקורת פתוחה שמחכה לטיפול."
  ];

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="מרכז פיקוד">
      <div className="manager-command-center-2">
        <PremiumDashboardHero
          eyebrow="Command Center"
          title={`${garden?.name ?? "הגן"} במבט ניהולי אחד`}
          subtitle="תפעול, ילדים, צוות, ציות, פיקוח, תצפיתן, תקשורת וכספים במקום אחד."
          badge={`${healthScore}/100`}
          badgeTone={healthTone}
          actions={<><Link className="button primary" href="/dashboard/garden/tasks">משימות</Link><Link className="button secondary" href="/dashboard/garden/operations">מערכת הפעלה</Link></>}
        >
          <Avatar name={garden?.name} src={garden?.logo_url ?? garden?.image_url} size="lg" />
        </PremiumDashboardHero>

        <section className="manager-command-kpis">
          <RoleMetricCard label="בריאות גן" value={`${healthScore}/100`} hint="תפעול יומי" tone={healthTone} />
          <RoleMetricCard label="נוכחות ילדים" value={`${presentChildren}/${childCount}`} hint={`${missingAttendance} ללא סימון`} tone={missingAttendance ? "warn" : "good"} href="/dashboard/garden/attendance" />
          <RoleMetricCard label="צוות פעיל" value={`${activeStaff}/${staffCount}`} hint={`${staffAbsent} לא במשמרת`} tone={activeStaff ? "good" : "warn"} href="/dashboard/garden/staff" />
          <RoleMetricCard label="אירועים פתוחים" value={unresolvedIncidents} hint="אירועים ופניות" tone={unresolvedIncidents ? "bad" : "good"} href="/dashboard/garden/incidents" />
          <RoleMetricCard label="ציות" value={complianceIssues} hint="מסמכים, ליקויים, פעולות" tone={complianceIssues ? "warn" : "good"} href="/dashboard/garden/compliance" />
          <RoleMetricCard label="תצפיתן" value={observerAlerts + cameraIssues} hint="התראות ומצלמות" tone={observerAlerts + cameraIssues ? "warn" : "good"} href="/dashboard/garden/observer-intelligence" />
        </section>

        <section className="manager-daily-focus">
          <div>
            <p className="eyebrow">מה דורש את תשומת לבך היום?</p>
            <h2>עד 5 דברים חשובים, לפי דחיפות.</h2>
            <p>{dailyOperation?.operational_status ? `סטטוס יומי: ${statusLabel(dailyOperation.operational_status)}` : "תמונה יומית מחושבת מנתוני הגן הנוכחיים."}</p>
          </div>
          <div className="manager-daily-focus-list">
            {dailyFocus.length ? dailyFocus.map((item) => (
              <Link className={`manager-focus-item ${item.tone}`} href={item.href} key={item.title}>
                <AlertTriangle size={18} />
                <div><strong>{item.title}</strong><span>{item.text}</span></div>
              </Link>
            )) : <div className="manager-focus-item good"><CheckCircle2 size={18} /><div><strong>אין מוקדי טיפול דחופים</strong><span>היום נראה יציב. המשיכי לעקוב אחרי הציר והמשימות.</span></div></div>}
          </div>
        </section>

        <CleanSection title="פעולות בלחיצה אחת" subtitle="הפעולות היומיומיות בלי לחפש בתפריט.">
          <div className="manager-one-tap-grid">
            {oneTapActions.map((action) => <ActionCard title={action.title} text="פתיחה מהירה" href={action.href} icon={action.icon} tone={action.tone} key={action.title} />)}
          </div>
        </CleanSection>

        <CleanSection title="תדריך בוקר" subtitle="מה דורש החלטה או פעולה עכשיו.">
          <div className="manager-briefing-grid">
            {briefing.map((item) => <Link className={`manager-briefing-card ${item.tone}`} href={item.href} key={item.text}><StatusBadge tone={item.tone}>{item.tone === "good" ? "תקין" : "לטיפול"}</StatusBadge><strong>{item.text}</strong></Link>)}
          </div>
        </CleanSection>

        <section className="manager-command-layout">
          <CleanSection title="מרכז התראות" subtitle="התראות קריטיות, חשובות ומידע כללי במקום אחד.">
            {smartAlerts.length ? <div className="manager-alert-list">{smartAlerts.map((item) => (
              <Link className={`manager-alert-row ${item.category}`} href={item.href} key={item.id}>
                <span>{item.category === "critical" ? "קריטי" : item.category === "important" ? "חשוב" : "מידע"}</span>
                <strong>{item.title}</strong>
                <small>{item.text}</small>
              </Link>
            ))}</div> : <EmptyState title="אין התראות פתוחות" text="התראות חדשות יופיעו כאן לפי חשיבות." />}
          </CleanSection>
          <CleanSection title="הצעות חכמות" subtitle="המלצות פעולה בלבד. ההחלטה נשארת אצלך.">
            <div className="manager-suggestion-list">{aiSuggestions.map((item) => <span key={item}>{item}</span>)}</div>
          </CleanSection>
        </section>

        <section className="manager-command-layout">
          <CleanSection title="תור עבודה מאוחד" subtitle="משימות מפיקוח, ציות, תצפיתן, מסמכים ותקשורת.">
            {unifiedQueue.length ? <div className="kos-task-list">{unifiedQueue.map((item) => <Link className="kos-task-row" href={item.href} key={`${item.source}-${item.id}`}><span>{sourceLabel(item.source)}</span><strong>{item.title}</strong><small>{statusLabel(item.status)} · {dateText(item.due)}</small></Link>)}</div> : <EmptyState title="אין משימות פתוחות" text="אם יעלה משהו חדש, הוא יופיע כאן." />}
          </CleanSection>
          <CleanSection title="עוזר מנהלת 2.0" subtitle="שאלות קצרות שמובילות למסך הנכון.">
            <div className="manager-assistant-2">
              <Bot />
              {[
                ["מה דורש טיפול היום?", "/dashboard/garden/tasks"],
                ["אילו ילדים צריכים מעקב?", "/dashboard/garden/children?view=attention"],
                ["איזה צוות חסר עדכונים?", "/dashboard/garden/staff"],
                ["אילו מסמכים עומדים לפוג?", "/dashboard/garden/compliance"],
                ["אילו ביקורות ממתינות?", "/dashboard/garden/inspections"]
              ].map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}
            </div>
          </CleanSection>
        </section>

        <section className="manager-command-layout">
          <CleanSection title="ציר הגן" subtitle="מה קרה היום, לפי סדר כרונולוגי.">
            {gardenTimeline.length ? <div className="manager-timeline-feed">{gardenTimeline.map((item) => (
              <Link className="manager-timeline-row" href={item.href} key={item.id}>
                <time>{timeText(item.time) || dateText(item.time)}</time>
                <div><strong>{item.title}</strong><span>{item.type} · {item.text}</span></div>
              </Link>
            ))}</div> : <EmptyState title="אין אירועים בציר היום" text="נוכחות, פניות, אירועים ופעולות צוות יופיעו כאן." />}
          </CleanSection>
          <CleanSection title="פתיחה וסגירת יום" subtitle={`${checklistRows.length} פריטי רשימה נשמרו היום. מצב חי מחושב עכשיו.`}>
            <div className="manager-checklist-columns">
              <div><h3><ListChecks size={17} /> פתיחת יום</h3>{openingChecklist.map((item) => <span className={item.done ? "done" : "pending"} key={item.key}><CheckCircle2 size={15} /> {item.label}<b>{item.count}</b></span>)}</div>
              <div><h3><ListChecks size={17} /> סגירת יום</h3>{closingChecklist.map((item) => <span className={item.done ? "done" : "pending"} key={item.key}><CheckCircle2 size={15} /> {item.label}<b>{item.count}</b></span>)}</div>
            </div>
          </CleanSection>
        </section>

        <section className="manager-command-grid">
          <article className="manager-command-card"><h2><Baby size={20} /> ילדים</h2><p>{presentChildren} נוכחים, {absentChildren} נעדרים, {missingChildUpdates} בלי עדכון.</p><span>{healthChildren.length} דגשי בריאות</span><Link className="button secondary" href="/dashboard/garden/children">פתיחה</Link></article>
          <article className="manager-command-card"><h2><UsersRound size={20} /> צוות</h2><p>{activeStaff} במשמרת, {staffGaps} פערי אישור/תיעוד.</p><span>מוכנות צוות: {pct(staffCount - staffGaps, staffCount)}%</span><Link className="button secondary" href="/dashboard/garden/staff">פתיחה</Link></article>
          <article className="manager-command-card"><h2><FileText size={20} /> ציות</h2><p>{documents.length} מסמכים או תעודות לבדיקה.</p><span>{findings.length + complianceActions.length} ליקויים/פעולות</span><Link className="button secondary" href="/dashboard/garden/compliance">פתיחה</Link></article>
          <article className="manager-command-card"><h2><ClipboardCheck size={20} /> פיקוח</h2><p>ביקורת קרובה: {dateText(inspections[0]?.due_at)}</p><span>ביקורת אחרונה: {lastInspection?.weighted_score ?? garden?.last_inspection_score ?? "-"}</span><Link className="button secondary" href="/dashboard/garden/inspections">פתיחה</Link></article>
          <article className="manager-command-card"><h2><MessageSquare size={20} /> תקשורת</h2><p>{messagesRes.count ?? 0} הודעות, {parentRequests.length + complaints.length} פניות פתוחות.</p><span>{notices.length} התראות מנהל</span><Link className="button secondary" href="/dashboard/garden/communication">פתיחה</Link></article>
          <article className="manager-command-card"><h2><Camera size={20} /> תצפיתן ומצלמות</h2><p>{cameraIssues} מצלמות דורשות בדיקה.</p><span>{observerAlerts} סימנים לבדיקה אנושית</span><Link className="button secondary" href="/dashboard/garden/observer-intelligence">פתיחה</Link></article>
          <article className="manager-command-card"><h2><WalletCards size={20} /> כספים</h2><p>צפי: {money(expectedPayments)} · נגבה: {money(receivedPayments)}</p><span>{overduePayments} תשלומים לטיפול</span><Link className="button secondary" href="/dashboard/garden/finance">פתיחה</Link></article>
          <article className="manager-command-card"><h2><ShieldCheck size={20} /> דוחות</h2><p>סיכום יומי, שבועי וחודשי לפי ילדים, צוות, ציות ובטיחות.</p><span>מוכן לייצוא בהמשך</span><Link className="button secondary" href="/dashboard/garden/insights">פתיחה</Link></article>
        </section>

        <CleanSection title="ציוני בריאות תפעולית" subtitle="ציון ברור לפי גורמים, לא קופסה שחורה.">
          <div className="kos-score-list">
            <span>נוכחות <b>{liveHealth.components.attendance}</b></span>
            <span>ציות <b>{liveHealth.components.compliance}</b></span>
            <span>פיקוח <b>{liveHealth.components.inspections}</b></span>
            <span>אירועים <b>{liveHealth.components.incidents}</b></span>
            <span>תקשורת <b>{liveHealth.components.communication}</b></span>
            <span>תצפיתן <b>{liveHealth.components.observer}</b></span>
          </div>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
