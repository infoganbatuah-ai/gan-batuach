import Link from "next/link";
import type { CSSProperties } from "react";
import { AlertTriangle, BarChart3, BellRing, Bot, Camera, CreditCard, FileText, HeartPulse, MessageSquareWarning, Rocket, Search, ShieldAlert, ShieldCheck, Star, UsersRound } from "lucide-react";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { AdminDataError } from "@/components/admin-data-state";
import {
  ActionCard,
  DashboardGrid,
  EmptyState,
  ListRowCard,
  MetricCard,
  PremiumCard,
  ReportCard,
  SectionHeader,
  StatusChip
} from "@/components/gan-batuach-design-system";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

async function countRows(supabase: Awaited<ReturnType<typeof createClient>>, table: string) {
  const { count, error } = await supabase.from(table as any).select("*", { count: "exact", head: true });
  logSupabaseError(`count ${table}`, error);
  return error ? 0 : count ?? 0;
}

async function countFiltered(supabase: Awaited<ReturnType<typeof createClient>>, table: string, apply: (query: any) => any) {
  const { count, error } = await apply(supabase.from(table as any).select("*", { count: "exact", head: true }));
  logSupabaseError(`count ${table}`, error);
  return error ? 0 : count ?? 0;
}

function money(value: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(value);
}

function healthTone(score: number): "success" | "warning" | "danger" {
  if (score >= 82) return "success";
  if (score >= 62) return "warning";
  return "danger";
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default async function AdminDashboard() {
  const { profile } = await requireRole(["admin"]);
  const result = await safeAdminData("national admin command center", async () => {
    const supabase = await createClient();
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const weekStartIso = weekStart.toISOString();
    const nowIso = now.toISOString();

    const [
      gardens,
      activeGardens,
      onboardingGardens,
      suspendedGardens,
      children,
      staff,
      activeStaff,
      inspectors,
      parents,
      activeSubscriptions,
      expiringSubscriptions,
      overdueAccounts,
      requiredInspections,
      overdueInspections,
      completedInspections,
      violations,
      complaints,
      criticalComplaints,
      incidents,
      activeIncidents,
      observerAlerts,
      cameras,
      offlineCameras,
      unhealthyCameras,
      communicationFailures,
      deliveryLogs,
      launchBlockers,
      securityFindings,
      pilotPrograms,
      subscriptionRowsRes,
      gardenRowsRes,
      inspectorRowsRes,
      recentComplaintsRes,
      recentAiEventsRes,
      launchScoresRes
    ] = await Promise.all([
      countRows(supabase, "gardens"),
      countFiltered(supabase, "gardens", (query) => query.in("status", ["active", "safe", "approved"])),
      countFiltered(supabase, "gardens", (query) => query.in("approval_flow_status", ["lead_submitted", "credentials_sent", "onboarding_in_progress", "pending_final_approval", "correction_required"])),
      countFiltered(supabase, "gardens", (query) => query.in("status", ["suspended", "archived"])),
      countRows(supabase, "children"),
      countRows(supabase, "staff"),
      countFiltered(supabase, "staff", (query) => query.eq("approved_to_work", true)),
      countRows(supabase, "inspectors"),
      countFiltered(supabase, "profiles", (query) => query.eq("role", "parent")),
      countFiltered(supabase, "subscriptions", (query) => query.in("status", ["active", "trialing"])),
      countFiltered(supabase, "subscriptions", (query) => query.lte("current_period_end", new Date(Date.now() + 14 * 86400000).toISOString()).in("status", ["active", "trialing"])),
      countFiltered(supabase, "subscriptions", (query) => query.in("status", ["past_due", "unpaid", "payment_failed"])),
      countFiltered(supabase, "required_inspections", (query) => query.neq("status", "done")),
      countFiltered(supabase, "required_inspections", (query) => query.lt("due_at", nowIso).neq("status", "done")),
      countFiltered(supabase, "inspections", (query) => query.gte("completed_at", monthStart).in("status", ["done", "completed"])),
      countFiltered(supabase, "violations", (query) => query.in("status", ["open", "new", "in_progress", "overdue"])),
      countFiltered(supabase, "complaints", (query) => query.in("status", ["new", "open", "in_progress", "waiting_user"])),
      countFiltered(supabase, "complaints", (query) => query.in("severity", ["critical", "high", "urgent"]).in("status", ["new", "open", "in_progress", "waiting_user"])),
      countRows(supabase, "incident_reports"),
      countFiltered(supabase, "incident_reports", (query) => query.in("status", ["new", "open", "in_progress"])),
      countFiltered(supabase, "ai_events", (query) => query.in("status", ["open", "in_progress"]).in("severity", ["high", "critical"])),
      countRows(supabase, "camera_streams"),
      countFiltered(supabase, "camera_streams", (query) => query.in("status", ["offline", "failed", "error", "disabled", "pending_gateway"])),
      countFiltered(supabase, "camera_streams", (query) => query.in("health_status", ["warning", "unhealthy", "offline", "failed"])),
      countFiltered(supabase, "communication_delivery_logs", (query) => query.in("status", ["failed", "failed_mock", "bounced", "delivery_failed"])),
      countRows(supabase, "communication_delivery_logs"),
      countFiltered(supabase, "launch_blockers", (query) => query.not("status", "in", "(verified,accepted_risk)")),
      countFiltered(supabase, "security_findings", (query) => query.not("status", "in", "(resolved,false_positive,accepted_risk)")),
      countFiltered(supabase, "pilot_programs", (query) => query.in("pilot_status", ["active", "in_progress", "onboarding"])),
      supabase.from("subscriptions" as any).select("id,status,monthly_amount,amount,price,created_at,current_period_end").limit(500),
      supabase.from("gardens" as any).select("id,name,city,safe_status,status,last_inspection_score,next_inspection_at,inspection_required_status,created_at").order("created_at", { ascending: false }).limit(10),
      supabase.from("inspectors" as any).select("id,full_name,city,assigned_cities,status").limit(10),
      supabase.from("complaints" as any).select("id,subject,severity,status,created_at,gardens(name,city)").order("created_at", { ascending: false }).limit(6),
      supabase.from("ai_events" as any).select("id,event_type,severity,status,detected_at,gardens(name,city)").order("detected_at", { ascending: false }).limit(6),
      supabase.from("launch_readiness_scores" as any).select("category,score,status").limit(20)
    ]);

    [
      subscriptionRowsRes,
      gardenRowsRes,
      inspectorRowsRes,
      recentComplaintsRes,
      recentAiEventsRes,
      launchScoresRes
    ].forEach((query, index) => logSupabaseError(`national dashboard query ${index}`, (query as any).error));

    const subscriptionRows = (subscriptionRowsRes.data ?? []) as any[];
    const mrr = subscriptionRows
      .filter((row) => ["active", "trialing"].includes(String(row.status)))
      .reduce((sum, row) => sum + Number(row.monthly_amount ?? row.amount ?? row.price ?? 0), 0);
    const newThisWeek = await countFiltered(supabase, "gardens", (query) => query.gte("created_at", weekStartIso));
    const launchScores = (launchScoresRes.data ?? []) as any[];
    const launchReadiness = launchScores.length ? Math.round(launchScores.reduce((sum, row) => sum + Number(row.score ?? 0), 0) / launchScores.length) : 0;

    return {
      gardens,
      activeGardens,
      onboardingGardens,
      suspendedGardens,
      children,
      staff,
      activeStaff,
      inspectors,
      parents,
      activeSubscriptions,
      expiringSubscriptions,
      overdueAccounts,
      requiredInspections,
      overdueInspections,
      completedInspections,
      violations,
      complaints,
      criticalComplaints,
      incidents,
      activeIncidents,
      observerAlerts,
      cameras,
      offlineCameras,
      unhealthyCameras,
      communicationFailures,
      deliveryLogs,
      launchBlockers,
      securityFindings,
      pilotPrograms,
      mrr,
      arr: mrr * 12,
      newThisWeek,
      launchReadiness,
      gardenRows: (gardenRowsRes.data ?? []) as any[],
      inspectorRows: (inspectorRowsRes.data ?? []) as any[],
      recentComplaints: (recentComplaintsRes.data ?? []) as any[],
      recentAiEvents: (recentAiEventsRes.data ?? []) as any[],
      queryError: [gardenRowsRes.error, inspectorRowsRes.error].some(Boolean) ? "חלק מנתוני מרכז השליטה לא נטענו" : null
    };
  }, {
    gardens: 0,
    activeGardens: 0,
    onboardingGardens: 0,
    suspendedGardens: 0,
    children: 0,
    staff: 0,
    activeStaff: 0,
    inspectors: 0,
    parents: 0,
    activeSubscriptions: 0,
    expiringSubscriptions: 0,
    overdueAccounts: 0,
    requiredInspections: 0,
    overdueInspections: 0,
    completedInspections: 0,
    violations: 0,
    complaints: 0,
    criticalComplaints: 0,
    incidents: 0,
    activeIncidents: 0,
    observerAlerts: 0,
    cameras: 0,
    offlineCameras: 0,
    unhealthyCameras: 0,
    communicationFailures: 0,
    deliveryLogs: 0,
    launchBlockers: 0,
    securityFindings: 0,
    pilotPrograms: 0,
    mrr: 0,
    arr: 0,
    newThisWeek: 0,
    launchReadiness: 0,
    gardenRows: [] as any[],
    inspectorRows: [] as any[],
    recentComplaints: [] as any[],
    recentAiEvents: [] as any[],
    queryError: null as string | null
  });

  const data = result.data;
  const staffReadiness = data.staff ? Math.round((data.activeStaff / data.staff) * 100) : 100;
  const inspectionCompletion = data.requiredInspections + data.completedInspections ? Math.round((data.completedInspections / (data.requiredInspections + data.completedInspections)) * 100) : 100;
  const communicationHealth = data.deliveryLogs ? clamp(100 - (data.communicationFailures / Math.max(data.deliveryLogs, 1)) * 100) : 100;
  const cameraHealth = data.cameras ? clamp(100 - ((data.offlineCameras + data.unhealthyCameras) / Math.max(data.cameras, 1)) * 100) : 100;
  const safetyPressure = data.criticalComplaints + data.activeIncidents + data.violations + data.observerAlerts;
  const systemHealth = clamp(
    100 -
    data.overdueInspections * 7 -
    data.criticalComplaints * 6 -
    data.observerAlerts * 5 -
    data.offlineCameras * 3 -
    data.launchBlockers * 6 -
    data.securityFindings * 4 -
    Math.max(0, 90 - staffReadiness) / 2
  );
  const tone = healthTone(systemHealth);
  const activeCustomers = data.activeGardens + data.onboardingGardens;
  const growthRate = data.gardens ? Math.round((data.newThisWeek / Math.max(data.gardens, 1)) * 100) : 0;
  const churnRisk = data.activeSubscriptions ? Math.round(((data.expiringSubscriptions + data.overdueAccounts) / Math.max(data.activeSubscriptions, 1)) * 100) : 0;

  const executiveQuestions = [
    { label: "אילו גנים דורשים טיפול?", href: "/dashboard/admin/kindergartens" },
    { label: "אילו מפקחים עמוסים?", href: "/dashboard/admin/inspectors" },
    { label: "אילו מנויים בסיכון?", href: "/dashboard/admin/subscriptions" },
    { label: "מה חששות הבטיחות החודש?", href: "/dashboard/admin/ai-events" }
  ];

  const safetyItems = [
    { label: "תלונות דחופות", value: data.criticalComplaints, href: "/dashboard/admin/complaints", tone: data.criticalComplaints ? "danger" : "success" },
    { label: "אירועים פתוחים", value: data.activeIncidents, href: "/dashboard/admin/incident-center", tone: data.activeIncidents ? "warning" : "success" },
    { label: "פיקוחים באיחור", value: data.overdueInspections, href: "/dashboard/admin/inspections/late", tone: data.overdueInspections ? "warning" : "success" },
    { label: "התראות תצפיתן", value: data.observerAlerts, href: "/dashboard/admin/ai-events", tone: data.observerAlerts ? "danger" : "success" }
  ] as const;

  const managementModules = [
    { title: "גנים", text: "פעילים, קליטה, מושעים וניסיון", href: "/dashboard/admin/kindergartens", icon: ShieldAlert, tone: "primary" },
    { title: "אנליטיקה ארצית", text: "מגמות, ערים ואזורים", href: "/dashboard/admin/analytics-center", icon: BarChart3, tone: "primary" },
    { title: "מפקחים", text: "שיבוץ, עומס וביצוע", href: "/dashboard/admin/inspectors", icon: UsersRound, tone: "primary" },
    { title: "כוח פיקוח", text: "קיבולת, תגמול ו-SLA", href: "/dashboard/admin/inspection-workforce", icon: UsersRound, tone: data.overdueInspections ? "warning" : "success" },
    { title: "פיקוח ארצי", text: "תכנון, ציות וסיכונים", href: "/dashboard/admin/national-inspections", icon: ShieldCheck, tone: data.overdueInspections ? "warning" : "success" },
    { title: "תיקי אירוע", text: "חקירה, ראיות וסגירה", href: "/dashboard/admin/incident-center", icon: MessageSquareWarning, tone: data.activeIncidents || data.criticalComplaints ? "warning" : "success" },
    { title: "דירוג לאומי", text: "ציונים, מגמות ושיפור", href: "/dashboard/admin/rating-system", icon: Star, tone: "primary" },
    { title: "מודיעין סיכון", text: "חיזוי, דפוסים ומניעה", href: "/dashboard/admin/risk-intelligence", icon: AlertTriangle, tone: data.observerAlerts || data.criticalComplaints ? "warning" : "muted" },
    { title: "בטיחות חזויה", text: "אזהרות ומניעה מוקדמת", href: "/dashboard/admin/predictive-safety", icon: ShieldAlert, tone: data.observerAlerts || data.criticalComplaints ? "warning" : "success" },
    { title: "ציות חכם", text: "מסמכים, תעודות ותיקונים", href: "/dashboard/admin/compliance-center", icon: FileText, tone: data.securityFindings || data.overdueInspections ? "warning" : "success" },
    { title: "תצפיתן", text: "מוכנות, כיול והתראות", href: "/dashboard/admin/observer-calibration", icon: Bot, tone: data.observerAlerts ? "warning" : "muted" },
    { title: "רשת בטיחות", text: "סימנים, סיכון ובדיקה אנושית", href: "/dashboard/admin/observer-network", icon: ShieldAlert, tone: data.observerAlerts ? "warning" : "muted" },
    { title: "מצלמות", text: "בריאות, Gateway ושידורים", href: "/dashboard/admin/camera-deployment", icon: Camera, tone: data.offlineCameras ? "warning" : "muted" },
    { title: "תקשורת", text: "Email, WhatsApp, SMS, Push", href: "/dashboard/admin/communications", icon: BellRing, tone: data.communicationFailures ? "warning" : "muted" },
    { title: "ספקי Production", text: "הפעלה, בדיקות ו-Rollback", href: "/dashboard/admin/provider-production", icon: BellRing, tone: data.communicationFailures ? "warning" : "success" },
    { title: "הכנסות", text: "מנויים, גבייה וסיכון", href: "/dashboard/admin/subscriptions", icon: CreditCard, tone: "primary" },
    { title: "סקייל", text: "ריבוי גנים, בידוד וביצועים", href: "/dashboard/admin/scale-validation", icon: BarChart3, tone: data.activeGardens >= 5 ? "success" : "warning" },
    { title: "100 גנים", text: "תוכנית סקייל מבוקרת", href: "/dashboard/admin/scale-100", icon: BarChart3, tone: data.activeGardens >= 25 ? "success" : "warning" },
    { title: "השקה", text: "פיילוט, אבטחה וציות", href: "/dashboard/admin/launch-readiness", icon: Rocket, tone: data.launchBlockers ? "danger" : "success" },
    { title: "אימות חיצוני", text: "משפטי, PT, ISO וחנויות", href: "/dashboard/admin/external-validation", icon: ShieldCheck, tone: data.launchBlockers ? "warning" : "success" },
    { title: "השקה סופית", text: "Go/No-Go, חסמים וסיכונים", href: "/dashboard/admin/final-production-launch", icon: Rocket, tone: data.launchBlockers ? "danger" : "success" },
    { title: "תפעול חברה", text: "ריליסים, תמיכה ופידבק", href: "/dashboard/admin/company-operations", icon: HeartPulse, tone: "success" },
    { title: "הגשה למובייל", text: "TestFlight ו-Google Play", href: "/dashboard/admin/mobile-submission", icon: Rocket, tone: data.launchBlockers ? "warning" : "success" },
    { title: "דוחות", text: "שבועי, חודשי, בטיחות והכנסות", href: "/dashboard/admin/reports", icon: FileText, tone: "primary" }
  ] as const;

  return (
    <AdminAppFrame
      profile={profile}
      title="דשבורד אדמין ראשי"
      subtitle="שליטה מלאה על גנים, פיקוח, מנויים, ספקים ובטיחות."
      badge="🌐 מרכז שליטה ארצי"
    >
      {result.error || data.queryError ? <AdminDataError message={result.error ?? data.queryError ?? undefined} /> : null}

      <PremiumCard className="admin-command-hero" size="lg">
        <div className={`admin-health-orb gb-tone-${tone}`} style={{ "--score": systemHealth } as CSSProperties}>
          <span>בריאות מערכת</span>
          <strong>{systemHealth}</strong>
          <small>מתוך 100</small>
        </div>
        <div className="admin-command-copy">
          <span>מבט מנהלים</span>
          <h2>כל גן בטוח במקום אחד.</h2>
          <p>{data.activeGardens} גנים פעילים, {data.inspectors} מפקחים, {data.children} ילדים, {data.staff} אנשי צוות ו-{safetyPressure} נושאי בטיחות פתוחים.</p>
          <div className="admin-chip-row">
            <StatusChip tone={tone}>{tone === "success" ? "מערכת יציבה" : tone === "warning" ? "דורש תשומת לב" : "חריגים פתוחים"}</StatusChip>
            <StatusChip tone={data.launchBlockers ? "danger" : "success"}>{data.launchBlockers} חסמי השקה</StatusChip>
            <StatusChip tone={data.securityFindings ? "warning" : "success"}>{data.securityFindings} ממצאי אבטחה</StatusChip>
          </div>
        </div>
        <Link className="admin-primary-button" href="/dashboard/admin/users"><Search size={18} /> חיפוש ארצי</Link>
      </PremiumCard>

      <DashboardGrid className="admin-kpi-grid" columns={3}>
        <MetricCard label="גנים פעילים" value={data.activeGardens} hint={`${data.gardens} סה״כ`} tone="success" href="/dashboard/admin/kindergartens" icon={ShieldCheck} />
        <MetricCard label="מפקחים" value={data.inspectors} hint="שיבוץ וביצוע" tone="primary" href="/dashboard/admin/inspectors" icon={UsersRound} />
        <MetricCard label="ילדים" value={data.children} hint={`${data.parents} הורים`} tone="primary" href="/dashboard/admin/users" icon={UsersRound} />
        <MetricCard label="צוות פעיל" value={`${data.activeStaff}/${data.staff}`} hint={`${staffReadiness}% מוכנות`} tone={staffReadiness >= 80 ? "success" : "warning"} href="/dashboard/admin/users" icon={UsersRound} />
        <MetricCard label="מנויים" value={data.activeSubscriptions} hint={`${data.overdueAccounts} בסיכון`} tone={data.overdueAccounts ? "warning" : "success"} href="/dashboard/admin/subscriptions" icon={CreditCard} />
        <MetricCard label="בריאות" value={`${systemHealth}%`} hint="פלטפורמה" tone={tone} href="/dashboard/admin/system-health" icon={HeartPulse} />
      </DashboardGrid>

      <DashboardGrid className="admin-report-grid" columns={3}>
        <ReportCard title="MRR" value={money(data.mrr)} subtitle={`ARR ${money(data.arr)}`} icon={CreditCard} tone="primary" href="/dashboard/admin/subscriptions" />
        <ReportCard title="לקוחות פעילים" value={activeCustomers} subtitle="כולל גנים בקליטה" icon={UsersRound} tone="success" href="/dashboard/admin/kindergartens" />
        <ReportCard title="צמיחה שבועית" value={`${growthRate}%`} subtitle={`${data.newThisWeek} גנים חדשים`} icon={BarChart3} tone={growthRate ? "success" : "muted"} href="/dashboard/admin/analytics-center" />
        <ReportCard title="סיכון נטישה" value={`${churnRisk}%`} subtitle="מנויים באיחור/לקראת סיום" icon={AlertTriangle} tone={churnRisk ? "warning" : "success"} href="/dashboard/admin/subscriptions" />
        <ReportCard title="מוכנות השקה" value={`${data.launchReadiness}%`} subtitle="Readiness center" icon={Rocket} tone={data.launchReadiness >= 80 ? "success" : "warning"} href="/dashboard/admin/launch-readiness" />
        <ReportCard title="פיקוח" value={`${inspectionCompletion}%`} subtitle={`${data.overdueInspections} באיחור`} icon={ShieldCheck} tone={data.overdueInspections ? "warning" : "success"} href="/dashboard/admin/national-inspections" />
      </DashboardGrid>

      <DashboardGrid className="admin-two-column" columns={2}>
        <PremiumCard className="admin-section-card" size="lg">
          <SectionHeader title="בטיחות ארצית" subtitle="תלונות, אירועים, פיקוח ותצפיתן לפי חומרה." icon={ShieldAlert} />
          <DashboardGrid className="admin-alert-grid" columns={4}>
            {safetyItems.map((item) => (
              <ReportCard key={item.label} title={item.label} value={item.value} tone={item.tone} href={item.href} />
            ))}
          </DashboardGrid>
          <div className="admin-list-stack">
            {[...data.recentComplaints, ...data.recentAiEvents].slice(0, 6).map((item: any) => (
              <ListRowCard
                key={`${item.id}-${item.subject ?? item.event_type}`}
                href={item.event_type ? "/dashboard/admin/ai-events" : "/dashboard/admin/complaints"}
                title={item.subject ?? item.event_type ?? "אירוע לבדיקה"}
                subtitle={`${item.gardens?.name ?? "גן"} · ${item.gardens?.city ?? "אזור לא צוין"}`}
                meta={item.created_at || item.detected_at ? new Date(item.created_at ?? item.detected_at).toLocaleString("he-IL") : "זמן לא צוין"}
                status={<StatusChip tone={["critical", "high", "urgent"].includes(String(item.severity)) ? "danger" : "warning"}>{item.severity ?? item.status ?? "פתוח"}</StatusChip>}
              />
            ))}
            {[...data.recentComplaints, ...data.recentAiEvents].length === 0 ? <EmptyState title="אין התראות חריגות" text="אירועים ותלונות שייווצרו יופיעו כאן." icon={ShieldCheck} /> : null}
          </div>
        </PremiumCard>

        <PremiumCard className="admin-section-card" size="lg">
          <SectionHeader title="עוזר מנהלים" subtitle="שאלות שמובילות להחלטה מהירה." icon={Bot} />
          <div className="admin-question-list">
            {executiveQuestions.map((question) => <Link href={question.href} key={question.label}>{question.label}</Link>)}
          </div>
          <div className="admin-health-list">
            <span>מצלמות תקינות <b>{cameraHealth}%</b></span>
            <span>תקשורת תקינה <b>{communicationHealth}%</b></span>
            <span>מוכנות צוות <b>{staffReadiness}%</b></span>
            <span>פיקוח החודש <b>{data.completedInspections}</b></span>
          </div>
        </PremiumCard>
      </DashboardGrid>

      <PremiumCard className="admin-section-card admin-management-card" size="lg">
        <SectionHeader title="ניהול מלא" subtitle="כל מודולי האדמין זמינים, בלי להפוך את המסך הראשון לקיר טבלאות." icon={BarChart3} />
        <details className="admin-management-drawer">
          <summary>הצג את כל מרכזי הניהול</summary>
          <DashboardGrid className="admin-management-grid" columns={4}>
            {managementModules.map((module) => <ActionCard key={module.href} {...module} />)}
          </DashboardGrid>
        </details>
      </PremiumCard>

      <DashboardGrid className="admin-two-column" columns={2}>
        <PremiumCard className="admin-section-card" size="lg">
          <SectionHeader title="מרכז גנים" subtitle="סטטוס, בטיחות ופיקוח הבא." icon={ShieldCheck} action={<Link className="admin-link-button" href="/dashboard/admin/kindergartens">ניהול מלא</Link>} />
          <div className="admin-list-stack">
            {data.gardenRows.length === 0 ? <EmptyState title="אין גנים להצגה" text="גנים שייווצרו יופיעו כאן." icon={ShieldCheck} /> : data.gardenRows.map((garden: any) => (
              <ListRowCard
                key={garden.id}
                href={`/dashboard/admin/gardens/${garden.id}`}
                title={garden.name}
                subtitle={`${garden.city ?? "עיר לא צוינה"} · ${garden.status ?? "סטטוס חסר"}`}
                meta={garden.next_inspection_at ? `פיקוח הבא: ${new Date(garden.next_inspection_at).toLocaleDateString("he-IL")}` : "פיקוח הבא לא נקבע"}
                status={<StatusChip tone={Number(garden.last_inspection_score ?? 100) < 70 ? "danger" : garden.safe_status === "safe" ? "success" : "warning"}>{garden.last_inspection_score ?? garden.safe_status ?? "בדיקה"}</StatusChip>}
              />
            ))}
          </div>
        </PremiumCard>

        <PremiumCard className="admin-section-card" size="lg">
          <SectionHeader title="מפקחים ועומס" subtitle="שיבוץ ומוכנות פיקוח." icon={UsersRound} action={<Link className="admin-link-button" href="/dashboard/admin/inspectors">ניהול מלא</Link>} />
          <div className="admin-list-stack">
            {data.inspectorRows.length === 0 ? <EmptyState title="אין מפקחים להצגה" text="מפקחים שייווצרו יופיעו כאן." icon={UsersRound} /> : data.inspectorRows.map((inspector: any) => (
              <ListRowCard
                key={inspector.id}
                href="/dashboard/admin/inspectors"
                title={inspector.full_name ?? "מפקח"}
                subtitle={Array.isArray(inspector.assigned_cities) ? inspector.assigned_cities.join(", ") : inspector.city ?? "אזור לא צוין"}
                meta="בדיקת עומס ושיוך"
                status={<StatusChip tone="success">{inspector.status ?? "פעיל"}</StatusChip>}
              />
            ))}
          </div>
        </PremiumCard>
      </DashboardGrid>

      <PremiumCard className="admin-ops-strip">
        <span><ShieldCheck /> גנים פעילים <b>{data.activeGardens}</b></span>
        <span><HeartPulse /> בטיחות פתוחה <b>{safetyPressure}</b></span>
        <span><Camera /> מצלמות לא תקינות <b>{data.offlineCameras + data.unhealthyCameras}</b></span>
        <span><BellRing /> כשלי תקשורת <b>{data.communicationFailures}</b></span>
        <span><Rocket /> פיילוטים פעילים <b>{data.pilotPrograms}</b></span>
      </PremiumCard>
    </AdminAppFrame>
  );
}
