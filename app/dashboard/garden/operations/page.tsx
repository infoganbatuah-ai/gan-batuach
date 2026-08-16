import Link from "next/link";
import { israelTodayDateKey } from "@/lib/domain/israel-date";
import { redirect } from "next/navigation";
import {
  Activity,
  Baby,
  Camera,
  ClipboardCheck,
  FileText,
  HeartPulse,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  TeacherActionTile,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel, isSyntheticLabel } from "@/lib/domain/display-label";
import { createClient } from "@/lib/supabase/server";
import {
  buildOperationalHealthScore,
  countTone,
  kosAssistantQuestions,
  kosTone,
  kosWorkflowExamples,
  sourceLabel,
  statusLabel
} from "@/lib/domain/kindergarten-operating-system";

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

function dateText(value?: string | null) {
  if (!value) return "לא נקבע";
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

export default async function GardenOperationsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  if (!gardenId) redirect("/dashboard/garden");

  const supabase = await createClient();
  const today = israelTodayDateKey();

  const [
    gardenRes,
    childrenRes,
    attendanceRes,
    journalsRes,
    staffRes,
    shiftsRes,
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
  const healthTone = kosTone(healthScore);
  const operationStatus = String((dailyOpsRes.data as any)?.operational_status ?? statusFromScore(healthScore));

  const attentionItems = [
    { label: "ילדים בלי נוכחות", value: Math.max(0, childCount - attendance.length), href: "/dashboard/garden/attendance", source: "children" },
    { label: "עדכוני ילד חסרים", value: Math.max(0, childCount - journals.length), href: "/dashboard/garden/child-journal", source: "children" },
    { label: "משימות פתוחות", value: tasksRes.count ?? tasks.length, href: "/dashboard/garden/tasks", source: "communications" },
    { label: "ציות ומסמכים", value: complianceIssues, href: "/dashboard/garden/compliance", source: "compliance" },
    { label: "פיקוח קרוב", value: inspections.length, href: "/dashboard/garden/inspections", source: "inspections" },
    { label: "תצפיתן ומצלמות", value: observerIssues, href: "/dashboard/garden/observer-intelligence", source: "observer" }
  ];

  const unifiedTasks = [
    ...workflows.map((item) => ({
      id: item.id,
      title: item.event_title,
      source: item.source_type,
      status: item.event_status,
      href: item.task_id ? "/dashboard/garden/tasks" : "/dashboard/garden/operations",
      due: item.due_at,
      priority: item.metadata?.priority
    })),
    ...tasks.map((item) => ({
      id: item.id,
      title: item.title,
      source: item.source_entity_type ?? item.task_type ?? "communications",
      status: item.status,
      href: "/dashboard/garden/tasks",
      due: item.due_at,
      priority: null
    })),
    ...complianceActions.map((item) => ({
      id: item.id,
      title: item.title ?? "פעולת ציות",
      source: "compliance",
      status: item.status,
      href: "/dashboard/garden/compliance",
      due: item.due_date,
      priority: item.priority
    })),
    ...preventionActions.map((item) => ({
      id: item.id,
      title: item.title ?? "פעולת מניעה",
      source: "observer",
      status: item.status,
      href: "/dashboard/garden/risk",
      due: null,
      priority: item.priority
    }))
  ].slice(0, 12);

  const operationalAreas = [
    { title: "ילדים", text: "נוכחות, אוכל, שינה, בריאות וציר יום", href: "/dashboard/garden/children", icon: Baby, tone: countTone(Math.max(0, childCount - journals.length)) },
    { title: "צוות", text: "נוכחות GPS, אישורים, משימות ותעודות", href: "/dashboard/garden/staff", icon: UsersRound, tone: staffReadiness >= 80 ? "good" as const : "warn" as const },
    { title: "הורים", text: "הודעות, אישורים, תשלומים ומצלמות", href: "/dashboard/garden/parents", icon: MessageSquare, tone: communicationItems ? "warn" as const : "good" as const },
    { title: "פיקוח", text: "ביקורות, ליקויים ופעולות תיקון", href: "/dashboard/garden/inspections", icon: ClipboardCheck, tone: inspections.length ? "warn" as const : "good" as const },
    { title: "ציות", text: "מסמכים, תעודות, נהלים ותוקף", href: "/dashboard/garden/compliance", icon: FileText, tone: complianceIssues ? "warn" as const : "good" as const },
    { title: "תצפיתן", text: "מצלמות, שמע, AI וסיכון", href: "/dashboard/garden/observer-intelligence", icon: Camera, tone: observerIssues ? "warn" as const : "good" as const },
    { title: "כספים", text: "גבייה, חובות ותשלומים", href: "/dashboard/garden/finance", icon: WalletCards, tone: paymentIssues ? "warn" as const : "good" as const },
    { title: "התראות", text: "כל מה שממתין לטיפול", href: "/dashboard/garden/notifications", icon: Activity, tone: unreadNotifications.length ? "warn" as const : "good" as const }
  ];

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="מערכת הפעלה" appHome>
      <TeacherAppFrame
        title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`}
        subtitle={`ברוכה הבאה ל${cleanSyntheticLabel(garden?.name, "הגן")}`}
        avatarUrl={(profile as any).profile_image_url ?? null}
        active="home"
      >
        {syntheticSession ? <div className="dashboard-environment-notice" role="status">סביבת בדיקה עם נתונים סינתטיים בלבד. ערכים חסרים אינם מוחלפים במספרי דמו.</div> : null}
        <TeacherStatsGrid>
          <TeacherStatCard title="בריאות תפעולית" value={`${healthScore}/100`} hint={statusText(operationStatus)} icon={ShieldCheck} tone={healthScore >= 85 ? "green" : healthScore >= 65 ? "orange" : "red"} />
          <TeacherStatCard title="נוכחות ילדים" value={`${presentChildren}/${childCount}`} hint={`${attendanceCompletion}% הושלם`} icon={Baby} tone={attendanceCompletion >= 90 ? "green" : "orange"} href="/dashboard/garden/attendance" />
          <TeacherStatCard title="צוות מוכן" value={`${staffReady}/${staffCount}`} hint={`${staffPresent} במשמרת`} icon={UsersRound} tone={staffReadiness >= 80 ? "green" : "orange"} href="/dashboard/garden/staff" />
          <TeacherStatCard title="התראות" value={communicationItems + observerIssues} hint="תקשורת ובטיחות" icon={Activity} tone={communicationItems + observerIssues ? "orange" : "green"} href="/dashboard/garden/notifications" />
        </TeacherStatsGrid>

        <TeacherSection title="מה דורש טיפול עכשיו" subtitle="תמונה אחת של היום, בלי לקפוץ בין מסכים.">
          <TeacherCompactList>
            {attentionItems.map((item) => (
              <TeacherCompactItem
                key={item.label}
                title={item.label}
                subtitle={sourceLabel(item.source)}
                meta={item.value}
                tone={item.value ? "orange" : "green"}
                href={item.href}
              />
            ))}
          </TeacherCompactList>
        </TeacherSection>

        <TeacherSection title="משימות מכל המערכת" subtitle="פיקוח, ציות, מסמכים, תקשורת ואירועים בתור אחד.">
          {unifiedTasks.length ? (
            <TeacherCompactList>
              {unifiedTasks.slice(0, 8).map((task) => (
                <TeacherCompactItem
                  key={`${task.source}-${task.id}`}
                  title={cleanSyntheticLabel(task.title, "משימה")}
                  subtitle={`${sourceLabel(task.source)} · ${statusLabel(task.status)} · ${dateText(task.due)}`}
                  tone={task.priority === "high" ? "red" : "purple"}
                  href={task.href}
                />
              ))}
            </TeacherCompactList>
          ) : (
            <TeacherEmptyState title="אין משימות פתוחות" text="היום נראה מסודר. אם יעלה משהו חדש, הוא יופיע כאן." />
          )}
        </TeacherSection>

        <TeacherQuickActions title="מרכזי פעולה">
          {operationalAreas.slice(0, 5).map((area) => (
            <TeacherActionTile key={area.title} title={area.title} href={area.href} icon={area.icon} tone={area.tone === "warn" ? "orange" : area.tone === "bad" ? "red" : "purple"} />
          ))}
        </TeacherQuickActions>

        <TeacherSection title="קיצורי חיפוש" subtitle="גישה מהירה לכל אזורי הגן.">
          <div className="ganenet-shortcut-grid">
            {operationalAreas.slice(5).map((area) => {
              const AreaIcon = area.icon;
              return (
                <Link className="ganenet-shortcut-tile" href={area.href} key={area.title}>
                  <AreaIcon size={26} />
                  <b>{area.title}</b>
                  <small>{area.text}</small>
                </Link>
              );
            })}
          </div>
        </TeacherSection>

        <TeacherSection title="עוזר תפעולי" subtitle="שאלות מוכנות למנהלת, מבוססות על נתוני הגן בלבד.">
          <TeacherCompactList>
            {kosAssistantQuestions.slice(0, 4).map((question) => (
              <TeacherCompactItem key={question} title={question} subtitle="פתיחה בתובנות" tone="blue" href="/dashboard/garden/insights" />
            ))}
          </TeacherCompactList>
        </TeacherSection>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
