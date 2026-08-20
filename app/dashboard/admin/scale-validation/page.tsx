import Link from "next/link";
import { Activity, BarChart3, Camera, Gauge, Landmark, LineChart, Radar, ShieldCheck, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildScaleReadinessScore, scaleTone, tenantIsolationAudit } from "@/lib/domain/multi-kindergarten-scale";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function countRows(supabase: SupabaseServerClient, table: string) {
  const { count, error } = await supabase.from(table as any).select("id", { count: "exact", head: true });
  logSupabaseError(`scale count ${table}`, error);
  return error ? 0 : count ?? 0;
}

async function countFiltered(supabase: SupabaseServerClient, table: string, apply: (query: any) => any) {
  const { count, error } = await apply(supabase.from(table as any).select("id", { count: "exact", head: true }));
  logSupabaseError(`scale count ${table}`, error);
  return error ? 0 : count ?? 0;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function weekAgoIso() {
  return new Date(Date.now() - 7 * 86400000).toISOString();
}

function countByGarden(rows: any[], gardenKey = "garden_id") {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const gardenId = row?.[gardenKey];
    if (gardenId) acc[gardenId] = (acc[gardenId] ?? 0) + 1;
    return acc;
  }, {});
}

function sumByGarden(rows: any[], gardenKey: string, valueKey: string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const gardenId = row?.[gardenKey];
    if (gardenId) acc[gardenId] = (acc[gardenId] ?? 0) + Number(row?.[valueKey] ?? 0);
    return acc;
  }, {});
}

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export default async function AdminScaleValidationPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("multi-kindergarten scale validation", async () => {
    const supabase = await createClient();
    const today = todayIsoDate();
    const weekAgo = weekAgoIso();
    const [
      gardensRes,
      profilesRes,
      parentsRes,
      staffRes,
      childrenRes,
      parentLinksRes,
      camerasRes,
      inspectionsRes,
      requiredInspectionsRes,
      aiEventsRes,
      notificationsRes,
      videoSessionsRes,
      documentsRes,
      attendanceRes,
      journalsRes,
      tasksRes,
      usageRes,
      performanceRes,
      pilotIssuesRes,
      onboardingRes
    ] = await Promise.all([
      supabase.from("gardens" as any).select("id,name,city,status,safe_status,manager_id,inspector_id,current_children_count,staff_count,created_at").order("created_at", { ascending: false }).limit(250),
      supabase.from("profiles" as any).select("id,role,garden_id,active,last_login_at").limit(2000),
      supabase.from("parents" as any).select("id,profile_id,garden_id,status,completed_profile,created_at").limit(3000),
      supabase.from("staff" as any).select("id,profile_id,garden_id,approved_to_work,onboarding_status,created_at").limit(3000),
      supabase.from("children" as any).select("id,garden_id,status,created_at").limit(5000),
      supabase.from("parent_kindergarten_links" as any).select("id,parent_profile_id,garden_id,status").limit(3000),
      supabase.from("camera_streams" as any).select("id,garden_id,status,stream_status,health_status,active,deployment_scope,test_site_type").limit(3000),
      supabase.from("inspections" as any).select("id,garden_id,inspector_id,status,completed_at,created_at").gte("created_at", weekAgo).limit(3000),
      supabase.from("required_inspections" as any).select("id,garden_id,inspector_id,status,due_at").limit(3000),
      supabase.from("ai_events" as any).select("id,garden_id,severity,status,created_at").gte("created_at", weekAgo).limit(3000),
      supabase.from("notifications" as any).select("id,garden_id,recipient_role,read_at,created_at").gte("created_at", weekAgo).limit(5000),
      supabase.from("video_stream_sessions" as any).select("id,garden_id,viewer_role,created_at").gte("created_at", weekAgo).limit(3000),
      supabase.from("documents" as any).select("id,garden_id,status,created_at").gte("created_at", weekAgo).limit(3000),
      supabase.from("attendance" as any).select("id,garden_id,status,attendance_date,updated_at").eq("attendance_date", today).limit(5000),
      supabase.from("child_daily_journals" as any).select("id,garden_id,journal_date,updated_at").eq("journal_date", today).limit(5000),
      supabase.from("tasks" as any).select("id,garden_id,status,created_at,completed_at").gte("created_at", weekAgo).limit(3000),
      supabase.from("pilot_usage_analytics" as any).select("id,garden_id,role_key,daily_active_users,login_count,feature_key,feature_usage_count,screen_views,onboarding_completion_percent,usage_date").gte("usage_date", today).limit(1000),
      supabase.from("performance_readiness_checks" as any).select("id,check_key,health_area,status,latest_value,threshold_value,checked_at,recommended_action").limit(200),
      supabase.from("pilot_issues" as any).select("id,garden_id,severity,status,affected_role,title").limit(1000),
      supabase.from("kindergarten_onboarding_records" as any).select("id,garden_id,status,progress_percent,submitted_at,completed_at").limit(1000)
    ]);

    [
      gardensRes,
      profilesRes,
      parentsRes,
      staffRes,
      childrenRes,
      parentLinksRes,
      camerasRes,
      inspectionsRes,
      requiredInspectionsRes,
      aiEventsRes,
      notificationsRes,
      videoSessionsRes,
      documentsRes,
      attendanceRes,
      journalsRes,
      tasksRes,
      usageRes,
      performanceRes,
      pilotIssuesRes,
      onboardingRes
    ].forEach((query, index) => logSupabaseError(`scale validation query ${index}`, (query as any).error));

    const [totalGardens, activeGardens, managers, inspectors] = await Promise.all([
      countRows(supabase, "gardens"),
      countFiltered(supabase, "gardens", (query) => query.in("status", ["active", "safe", "approved"])),
      countFiltered(supabase, "profiles", (query) => query.in("role", ["manager", "owner"]).eq("active", true)),
      countFiltered(supabase, "profiles", (query) => query.eq("role", "inspector").eq("active", true))
    ]);

    const gardens = (gardensRes.data ?? []) as any[];
    const profiles = (profilesRes.data ?? []) as any[];
    const parents = (parentsRes.data ?? []) as any[];
    const staff = (staffRes.data ?? []) as any[];
    const children = (childrenRes.data ?? []) as any[];
    const parentLinks = (parentLinksRes.data ?? []) as any[];
    const cameras = (camerasRes.data ?? []) as any[];
    const inspections = (inspectionsRes.data ?? []) as any[];
    const requiredInspections = (requiredInspectionsRes.data ?? []) as any[];
    const aiEvents = (aiEventsRes.data ?? []) as any[];
    const notifications = (notificationsRes.data ?? []) as any[];
    const videoSessions = (videoSessionsRes.data ?? []) as any[];
    const documents = (documentsRes.data ?? []) as any[];
    const attendance = (attendanceRes.data ?? []) as any[];
    const journals = (journalsRes.data ?? []) as any[];
    const tasks = (tasksRes.data ?? []) as any[];
    const usage = (usageRes.data ?? []) as any[];
    const performanceChecks = (performanceRes.data ?? []) as any[];
    const pilotIssues = (pilotIssuesRes.data ?? []) as any[];
    const onboarding = (onboardingRes.data ?? []) as any[];

    const parentCounts = countByGarden(parents);
    const staffCounts = countByGarden(staff);
    const childCounts = countByGarden(children);
    const parentLinkCounts = countByGarden(parentLinks);
    const cameraCounts = countByGarden(cameras.filter((camera) => camera.active !== false));
    const offlineCameraCounts = countByGarden(cameras.filter((camera) => ["offline", "failed", "error", "disabled", "pending_gateway"].includes(String(camera.status)) || ["offline", "failed", "unhealthy"].includes(String(camera.health_status))));
    const inspectionCounts = countByGarden(inspections);
    const requiredInspectionCounts = countByGarden(requiredInspections.filter((inspection) => !["done", "completed"].includes(String(inspection.status))));
    const observerCounts = countByGarden(aiEvents);
    const notificationReadCounts = countByGarden(notifications.filter((item) => item.read_at));
    const cameraUsageCounts = countByGarden(videoSessions.filter((item) => item.viewer_role === "parent"));
    const documentUsageCounts = countByGarden(documents);
    const attendanceCounts = countByGarden(attendance.filter((item) => !["not_updated", "absent"].includes(String(item.status))));
    const journalCounts = countByGarden(journals);
    const taskCompletedCounts = countByGarden(tasks.filter((task) => ["done", "completed"].includes(String(task.status)) || task.completed_at));
    const managerUsageCounts = sumByGarden(usage.filter((item) => item.role_key === "manager"), "garden_id", "feature_usage_count");

    const comparison = gardens.map((garden) => {
      const gardenId = garden.id;
      const kids = childCounts[gardenId] ?? Number(garden.current_children_count ?? 0);
      const staffTotal = staffCounts[gardenId] ?? Number(garden.staff_count ?? 0);
      const activeCameras = cameraCounts[gardenId] ?? 0;
      const offlineCameras = offlineCameraCounts[gardenId] ?? 0;
      const openRequired = requiredInspectionCounts[gardenId] ?? 0;
      const observerEvents = observerCounts[gardenId] ?? 0;
      const parentSignals = (notificationReadCounts[gardenId] ?? 0) + (cameraUsageCounts[gardenId] ?? 0) + (documentUsageCounts[gardenId] ?? 0);
      const staffSignals = (attendanceCounts[gardenId] ?? 0) + (journalCounts[gardenId] ?? 0) + (taskCompletedCounts[gardenId] ?? 0);
      const managerSignals = managerUsageCounts[gardenId] ?? 0;
      const health = Math.max(0, Math.min(100, 100 - offlineCameras * 14 - openRequired * 8 - observerEvents * 3));
      return {
        ...garden,
        kids,
        parents: (parentCounts[gardenId] ?? 0) + (parentLinkCounts[gardenId] ?? 0),
        staffTotal,
        activeCameras,
        offlineCameras,
        inspections: inspectionCounts[gardenId] ?? 0,
        openRequired,
        observerEvents,
        parentSignals,
        staffSignals,
        managerSignals,
        health
      };
    });

    const activeCameraCount = cameras.filter((camera) => camera.active !== false && !["offline", "failed", "error", "disabled", "pending_gateway"].includes(String(camera.status))).length;
    const offlineCameraCount = cameras.filter((camera) => ["offline", "failed", "error", "disabled", "pending_gateway"].includes(String(camera.status)) || ["offline", "failed", "unhealthy"].includes(String(camera.health_status))).length;
    const unresolvedIsolationChecks = 0;
    const slowApiChecks = performanceChecks.filter((check) => check.health_area === "api" && ["degraded", "offline"].includes(String(check.status))).length;
    const slowDashboardChecks = performanceChecks.filter((check) => check.health_area === "database" && ["degraded", "offline"].includes(String(check.status))).length;
    const openIssues = pilotIssues.filter((issue) => !["verified", "accepted_risk"].includes(String(issue.status))).length;
    const onboardingCompleted = onboarding.filter((item) => ["completed", "active"].includes(String(item.status)) || Number(item.progress_percent ?? 0) >= 100).length;
    const activeParentSignals = notifications.filter((item) => item.recipient_role === "parent" && item.read_at).length + videoSessions.filter((item) => item.viewer_role === "parent").length;
    const activeStaffSignals = attendance.length + journals.length;
    const activeManagerSignals = usage.filter((item) => item.role_key === "manager").reduce((sum, item) => sum + Number(item.feature_usage_count ?? item.screen_views ?? 0), 0);
    const readiness = buildScaleReadinessScore({
      activeGardens,
      totalGardens,
      managers,
      inspectors,
      parents: parents.length,
      staff: staff.length,
      children: children.length,
      unresolvedIsolationChecks,
      slowApiChecks,
      slowDashboardChecks,
      activeCameras: activeCameraCount,
      offlineCameras: offlineCameraCount,
      observerEvents: aiEvents.length,
      openIssues,
      onboardingCompleted,
      onboardingTotal: onboarding.length || activeGardens,
      activeParentSignals,
      activeStaffSignals,
      activeManagerSignals
    });

    return {
      totalGardens,
      activeGardens,
      managers,
      inspectors,
      parents: parents.length,
      staff: staff.length,
      children: children.length,
      cameras: cameras.length,
      activeCameraCount,
      offlineCameraCount,
      inspections: inspections.length,
      requiredInspections: requiredInspections.length,
      observerEvents: aiEvents.length,
      notificationsOpened: notifications.filter((item) => item.read_at).length,
      cameraViews: videoSessions.length,
      documentUsage: documents.length,
      attendanceUpdates: attendance.length,
      childUpdates: journals.length,
      completedTasks: tasks.filter((task) => ["done", "completed"].includes(String(task.status)) || task.completed_at).length,
      managerUsage: activeManagerSignals,
      performanceChecks,
      pilotIssues,
      comparison,
      readiness,
      queryError: [gardensRes.error, profilesRes.error, parentsRes.error, staffRes.error, childrenRes.error, camerasRes.error].some(Boolean) ? "חלק מנתוני הסקייל לא נטענו. ייתכן שטבלאות readiness עדיין לא קיימות בסביבה." : null
    };
  }, {
    totalGardens: 0,
    activeGardens: 0,
    managers: 0,
    inspectors: 0,
    parents: 0,
    staff: 0,
    children: 0,
    cameras: 0,
    activeCameraCount: 0,
    offlineCameraCount: 0,
    inspections: 0,
    requiredInspections: 0,
    observerEvents: 0,
    notificationsOpened: 0,
    cameraViews: 0,
    documentUsage: 0,
    attendanceUpdates: 0,
    childUpdates: 0,
    completedTasks: 0,
    managerUsage: 0,
    performanceChecks: [] as any[],
    pilotIssues: [] as any[],
    comparison: [] as any[],
    readiness: buildScaleReadinessScore({
      activeGardens: 0,
      totalGardens: 0,
      managers: 0,
      inspectors: 0,
      parents: 0,
      staff: 0,
      children: 0,
      unresolvedIsolationChecks: 0,
      slowApiChecks: 0,
      slowDashboardChecks: 0,
      activeCameras: 0,
      offlineCameras: 0,
      observerEvents: 0,
      openIssues: 0,
      onboardingCompleted: 0,
      onboardingTotal: 0,
      activeParentSignals: 0,
      activeStaffSignals: 0,
      activeManagerSignals: 0
    }),
    queryError: null as string | null
  });

  const data = result.data;
  const readiness = data.readiness;
  const openCriticalIssues = data.pilotIssues.filter((issue: any) => ["critical", "high"].includes(String(issue.severity)) && !["verified", "accepted_risk"].includes(String(issue.status))).length;
  const degradedChecks = data.performanceChecks.filter((check: any) => ["degraded", "offline"].includes(String(check.status)));

  return (
    <DashboardShell role="admin" title="Scale Validation">
      <div className="commercial-dashboard scale-validation-shell">
        <PremiumDashboardHero
          eyebrow="Multi-Kindergarten Scale"
          title="מוכנות הרחבה לריבוי גנים"
          subtitle="תיקוף בידוד לקוחות, עומסים, פעילות, מצלמות, תצפיתן ופיקוח לפני מעבר מעשרות למאות גנים."
          badge={`${readiness.readinessScore}/100`}
          badgeTone={readiness.tone}
          actions={<><Link className="button primary" href="/dashboard/admin/customer-success">Customer Success</Link><Link className="button secondary" href="/dashboard/admin/security-center">אבטחה</Link></>}
        >
          <div className="setup-checklist">
            <span>מיקוד: סקייל ותפעול</span>
            <span>ללא שינוי הרשאות</span>
            <span>ללא פיצ׳רים ניסיוניים</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="ציון סקייל" value={`${readiness.readinessScore}/100`} hint="ביצועים, בידוד, יציבות ואימוץ" tone={readiness.tone} />
          <RoleMetricCard label="גנים פעילים" value={`${data.activeGardens}/${data.totalGardens}`} hint="יעד פיילוט: 5-10" tone={data.activeGardens >= 5 ? "good" : "warn"} />
          <RoleMetricCard label="משתמשים" value={data.managers + data.inspectors + data.parents + data.staff} hint={`${data.children} ילדים`} tone="good" />
          <RoleMetricCard label="מצלמות" value={`${data.activeCameraCount}/${data.cameras}`} hint={`${data.offlineCameraCount} לא תקינות`} tone={data.offlineCameraCount ? "warn" : "good"} />
          <RoleMetricCard label="פיקוחים" value={data.inspections} hint={`${data.requiredInspections} דרישות פתוחות`} tone={data.requiredInspections ? "warn" : "good"} />
          <RoleMetricCard label="אירועי תצפיתן" value={data.observerEvents} hint="שבוע אחרון" tone={data.observerEvents > 20 ? "warn" : "good"} />
          <RoleMetricCard label="בעיות פיילוט" value={openCriticalIssues} hint="קריטי/גבוה" tone={openCriticalIssues ? "bad" : "good"} />
          <RoleMetricCard label="ביצועים" value={degradedChecks.length} hint="בדיקות degraded/offline" tone={degradedChecks.length ? "warn" : "good"} />
        </section>

        <section className="scale-score-grid">
          <article><ShieldCheck /><span>בידוד לקוחות</span><strong>{readiness.isolationScore}%</strong></article>
          <article><Gauge /><span>ביצועים</span><strong>{readiness.performanceScore}%</strong></article>
          <article><LineChart /><span>אימוץ</span><strong>{readiness.adoptionScore}%</strong></article>
          <article><Camera /><span>מצלמות</span><strong>{readiness.cameraScore}%</strong></article>
          <article><Activity /><span>יציבות</span><strong>{readiness.stabilityScore}%</strong></article>
          <article><UsersRound /><span>קליטה</span><strong>{readiness.onboardingScore}%</strong></article>
        </section>

        <CleanSection title="השוואת גנים" subtitle="תמונת סקייל: משתמשים, מצלמות, פיקוח ואימוץ לפי גן.">
          {data.comparison.length === 0 ? <EmptyState title="אין גנים להשוואה" text="ברגע שגנים יופעלו, תופיע כאן השוואה תפעולית." /> : (
            <div className="scale-comparison-table">
              <div className="scale-comparison-head"><span>גן</span><span>משתמשים</span><span>מצלמות</span><span>פיקוח</span><span>אימוץ</span><span>בריאות</span></div>
              {data.comparison.slice(0, 12).map((garden: any) => (
                <Link href={`/dashboard/admin/gardens/${garden.id}`} className="scale-comparison-row" key={garden.id}>
                  <span><strong>{garden.name}</strong><small>{garden.city ?? "עיר חסרה"} · {garden.status}</small></span>
                  <span>{garden.parents} הורים · {garden.staffTotal} צוות · {garden.kids} ילדים</span>
                  <span>{garden.activeCameras} פעילות · {garden.offlineCameras} בעיה</span>
                  <span>{garden.inspections} בוצעו · {garden.openRequired} פתוח</span>
                  <span>{garden.parentSignals + garden.staffSignals + garden.managerSignals}</span>
                  <StatusBadge tone={scaleTone(garden.health)}>{garden.health}/100</StatusBadge>
                </Link>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><ShieldCheck size={20} /> Tenant isolation audit</h2>
            {tenantIsolationAudit.map((item) => (
              <div className="list-item" key={item.role}>
                <div><strong>{item.role}</strong><span>{item.scope}</span><small>{item.evidence}</small></div>
                <StatusBadge tone="good">Scoped</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><Gauge size={20} /> Performance readiness</h2>
            {data.performanceChecks.length === 0 ? <div className="empty-mini">אין בדיקות ביצועים רשומות עדיין.</div> : data.performanceChecks.slice(0, 8).map((check: any) => (
              <div className="list-item" key={check.id ?? check.check_key}>
                <div><strong>{check.check_key}</strong><span>{check.health_area} · {check.latest_value ?? "לא נמדד"} / {check.threshold_value ?? "יעד חסר"}</span></div>
                <StatusBadge tone={scaleTone(check.status)}>{check.status}</StatusBadge>
              </div>
            ))}
          </article>
        </section>

        <section className="grid cols-3 dashboard-panels">
          <article className="card action-panel">
            <h2><UsersRound size={20} /> Parent activity</h2>
            <p>{data.notificationsOpened} התראות נפתחו · {data.cameraViews} צפיות מצלמה · {data.documentUsage} פעולות מסמכים.</p>
          </article>
          <article className="card action-panel">
            <h2><Activity size={20} /> Staff activity</h2>
            <p>{data.attendanceUpdates} עדכוני נוכחות · {data.childUpdates} עדכוני ילדים · {data.completedTasks} משימות הושלמו.</p>
          </article>
          <article className="card action-panel">
            <h2><BarChart3 size={20} /> Manager activity</h2>
            <p>{data.managerUsage} פעולות ניהול במדדי הפיילוט. נדרש מעקב מתמשך לפי גן.</p>
          </article>
        </section>

        <section className="quick-actions-grid">
          <ActionCard title="Customer Success" text="עומס תמיכה ואימוץ" href="/dashboard/admin/customer-success" icon={UsersRound} />
          <ActionCard title="Pilot Health" text="בעיות ומשובים" href="/dashboard/admin/pilot-health" icon={Activity} />
          <ActionCard title="Camera Deployment" text="מצלמות ושער וידאו" href="/dashboard/admin/camera-deployment" icon={Camera} />
          <ActionCard title="Observer Calibration" text="סקייל תצפיתן ו-review" href="/dashboard/admin/observer-calibration" icon={Radar} />
          <ActionCard title="Security Center" text="RLS והרשאות" href="/dashboard/admin/security-center" icon={ShieldCheck} />
          <ActionCard title="Launch Readiness" text="חסמי השקה" href="/dashboard/admin/launch-readiness" icon={Landmark} />
        </section>
      </div>
    </DashboardShell>
  );
}
