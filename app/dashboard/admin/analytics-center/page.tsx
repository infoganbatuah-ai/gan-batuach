import Link from "next/link";
import { Activity, BarChart3, Building2, Camera, ClipboardCheck, FileText, LineChart, MapPinned, Radar, ShieldCheck, Sparkles, TrendingUp, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { analyticsGovernanceRules, analyticsTone, avg, benchmarkRows, buildAnalyticsInsights, groupByRegion, pct } from "@/lib/domain/cross-kindergarten-analytics";
import { riskLevelLabel, riskTone, riskTrendLabel } from "@/lib/domain/predictive-risk";
import { createClient } from "@/lib/supabase/server";

function monthAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function countBy(rows: any[], key: string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = row?.[key];
    if (value) acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function completed(status?: string | null) {
  return ["done", "completed", "closed", "resolved", "verified"].includes(String(status));
}

export default async function AdminAnalyticsCenterPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("cross kindergarten analytics", async () => {
    const supabase = await createClient();
    const thirtyDaysAgo = monthAgo(30);
    const sixtyDaysAgo = monthAgo(60);
    const [
      gardensRes,
      profilesRes,
      staffRes,
      childrenRes,
      inspectorsRes,
      ratingRes,
      riskRes,
      inspectionsRes,
      findingsRes,
      complaintsCurrentRes,
      complaintsPreviousRes,
      incidentsRes,
      complianceRes,
      observerSignalsRes,
      observerReviewsRes,
      calibrationRes,
      parentEngagementRes,
      videoSessionsRes,
      documentsRes,
      tasksRes,
      attendanceRes,
      assistantUsageRes,
      analyticsInsightsRes
    ] = await Promise.all([
      supabase.from("gardens" as any).select("id,name,city,region,status,safe_status,current_children_count,staff_count,last_inspection_score,created_at").limit(1000),
      supabase.from("profiles" as any).select("id,role,garden_id,active,last_login_at").limit(5000),
      supabase.from("staff" as any).select("id,garden_id,onboarding_status,approved_to_work,created_at").limit(5000),
      supabase.from("children" as any).select("id,garden_id,status,created_at").limit(8000),
      supabase.from("inspectors" as any).select("id,profile_id,full_name,status,assigned_cities,created_at").limit(1000),
      supabase.from("kindergarten_rating_profiles" as any).select("*, gardens(id,name,city,region,status)").limit(1000),
      supabase.from("kindergarten_risk_profiles" as any).select("*, gardens(id,name,city,region,status)").limit(1000),
      supabase.from("inspections" as any).select("id,garden_id,inspector_id,status,completed_at,created_at,weighted_score").gte("created_at", sixtyDaysAgo).limit(5000),
      supabase.from("national_compliance_findings" as any).select("id,garden_id,inspector_id,severity,resolution_status,created_at,closed_at").limit(5000),
      supabase.from("complaints" as any).select("id,garden_id,severity,status,created_at").gte("created_at", thirtyDaysAgo).limit(5000),
      supabase.from("complaints" as any).select("id,garden_id,severity,status,created_at").gte("created_at", sixtyDaysAgo).lt("created_at", thirtyDaysAgo).limit(5000),
      supabase.from("incident_cases" as any).select("id,garden_id,severity,status,created_at,closed_at").gte("created_at", thirtyDaysAgo).limit(5000),
      supabase.from("compliance_alerts" as any).select("id,garden_id,category,severity,status,created_at,due_date").limit(5000),
      supabase.from("observer_intelligence_signals" as any).select("id,kindergarten_id,observer_site_id,signal_type,severity,confidence,review_status,created_at").gte("created_at", thirtyDaysAgo).limit(5000),
      supabase.from("observer_ground_truth_reviews" as any).select("id,site_id,camera_id,review_outcome,created_at").gte("created_at", thirtyDaysAgo).limit(5000),
      supabase.from("observer_calibration_profiles" as any).select("id,site_id,kindergarten_id,readiness_score,calibration_status,updated_at").limit(1000),
      supabase.from("parent_engagement_events" as any).select("id,garden_id,event_type,occurred_at").gte("occurred_at", thirtyDaysAgo).limit(5000),
      supabase.from("video_stream_sessions" as any).select("id,garden_id,viewer_role,created_at").gte("created_at", thirtyDaysAgo).limit(5000),
      supabase.from("documents" as any).select("id,garden_id,status,created_at,updated_at").gte("created_at", thirtyDaysAgo).limit(5000),
      supabase.from("tasks" as any).select("id,garden_id,status,created_at,completed_at").gte("created_at", thirtyDaysAgo).limit(5000),
      supabase.from("attendance" as any).select("id,garden_id,status,attendance_date,updated_at").gte("attendance_date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).limit(8000),
      supabase.from("ai_assistant_usage_analytics" as any).select("role,question_key,usage_count,unresolved_count,last_used_at").limit(1000),
      supabase.from("analytics_intelligence_insights" as any).select("*").order("updated_at", { ascending: false }).limit(20)
    ]);

    [
      gardensRes, profilesRes, staffRes, childrenRes, inspectorsRes, ratingRes, riskRes, inspectionsRes, findingsRes,
      complaintsCurrentRes, complaintsPreviousRes, incidentsRes, complianceRes, observerSignalsRes, observerReviewsRes,
      calibrationRes, parentEngagementRes, videoSessionsRes, documentsRes, tasksRes, attendanceRes, assistantUsageRes,
      analyticsInsightsRes
    ].forEach((query, index) => logSupabaseError(`analytics center query ${index}`, (query as any).error));

    const gardens = (gardensRes.data ?? []) as any[];
    const profiles = (profilesRes.data ?? []) as any[];
    const staff = (staffRes.data ?? []) as any[];
    const children = (childrenRes.data ?? []) as any[];
    const inspectors = (inspectorsRes.data ?? []) as any[];
    const ratings = (ratingRes.data ?? []) as any[];
    const risks = (riskRes.data ?? []) as any[];
    const inspections = (inspectionsRes.data ?? []) as any[];
    const findings = (findingsRes.data ?? []) as any[];
    const complaintsCurrent = (complaintsCurrentRes.data ?? []) as any[];
    const complaintsPrevious = (complaintsPreviousRes.data ?? []) as any[];
    const incidents = (incidentsRes.data ?? []) as any[];
    const compliance = (complianceRes.data ?? []) as any[];
    const observerSignals = (observerSignalsRes.data ?? []) as any[];
    const observerReviews = (observerReviewsRes.data ?? []) as any[];
    const calibration = (calibrationRes.data ?? []) as any[];
    const parentEngagement = (parentEngagementRes.data ?? []) as any[];
    const videoSessions = (videoSessionsRes.data ?? []) as any[];
    const documents = (documentsRes.data ?? []) as any[];
    const tasks = (tasksRes.data ?? []) as any[];
    const attendance = (attendanceRes.data ?? []) as any[];
    const assistantUsage = (assistantUsageRes.data ?? []) as any[];
    const storedInsights = (analyticsInsightsRes.data ?? []) as any[];

    const activeGardens = gardens.filter((garden) => ["active", "safe", "approved"].includes(String(garden.status))).length;
    const activeInspectors = profiles.filter((profile) => profile.role === "inspector" && profile.active !== false).length || inspectors.filter((inspector) => inspector.status !== "inactive").length;
    const activeChildren = children.filter((child) => ["active", "approved"].includes(String(child.status))).length || children.length;
    const activeStaff = staff.filter((item) => item.approved_to_work || item.onboarding_status === "active").length || staff.length;
    const completedInspections = inspections.filter((inspection) => completed(inspection.status) || inspection.completed_at).length;
    const openInspections = inspections.filter((inspection) => !completed(inspection.status) && !inspection.completed_at).length;
    const unresolvedFindings = findings.filter((finding) => !completed(finding.resolution_status)).length;
    const complianceOpen = compliance.filter((item) => !completed(item.status)).length;
    const observerReviewed = observerSignals.filter((signal) => ["confirmed", "dismissed", "resolved"].includes(String(signal.review_status))).length;
    const observerReviewRate = pct(observerReviewed, observerSignals.length);
    const falsePositiveRate = pct(observerReviews.filter((review) => review.review_outcome === "false_positive").length, observerReviews.length);
    const calibrationAverage = avg(calibration, "readiness_score");
    const highRisk = risks.filter((risk) => ["high", "critical"].includes(String(risk.risk_level)) || Number(risk.overall_risk_score ?? 0) >= 65).length;
    const risingRisk = risks.filter((risk) => risk.risk_trend === "rising").length;
    const engagementByGarden = countBy(parentEngagement, "garden_id");
    const videoByGarden = countBy(videoSessions.filter((session) => session.viewer_role === "parent"), "garden_id");
    const staffTaskByGarden = countBy(tasks.filter((task) => completed(task.status) || task.completed_at), "garden_id");
    const staffAttendanceByGarden = countBy(attendance.filter((row) => ["present", "checked_in", "completed"].includes(String(row.status))), "garden_id");
    const staffCompletionByGarden = Object.fromEntries(Object.keys({ ...staffTaskByGarden, ...staffAttendanceByGarden }).map((gardenId) => [gardenId, (staffTaskByGarden[gardenId] ?? 0) + (staffAttendanceByGarden[gardenId] ?? 0)]));
    const mergedEngagement = Object.fromEntries(Object.keys({ ...engagementByGarden, ...videoByGarden }).map((gardenId) => [gardenId, (engagementByGarden[gardenId] ?? 0) + (videoByGarden[gardenId] ?? 0)]));
    const benchmarks = benchmarkRows(ratings, gardens, mergedEngagement, staffCompletionByGarden);
    const regions = groupByRegion(gardens, ratings);
    const insights = buildAnalyticsInsights({
      regions,
      ratingProfiles: ratings,
      risks,
      complaintsThisMonth: complaintsCurrent.length,
      complaintsLastMonth: complaintsPrevious.length,
      inspectionsCompleted: completedInspections,
      inspectionsOpen: openInspections
    });
    const inspectorWorkload = inspections.reduce<Record<string, any>>((acc, inspection) => {
      const key = inspection.inspector_id ?? "לא משויך";
      acc[key] ??= { inspectorId: key, total: 0, completed: 0, open: 0, findings: 0 };
      acc[key].total += 1;
      if (completed(inspection.status) || inspection.completed_at) acc[key].completed += 1;
      else acc[key].open += 1;
      return acc;
    }, {});
    for (const finding of findings) {
      const key = finding.inspector_id ?? "לא משויך";
      inspectorWorkload[key] ??= { inspectorId: key, total: 0, completed: 0, open: 0, findings: 0 };
      inspectorWorkload[key].findings += 1;
    }
    const inspectorRows = Object.values(inspectorWorkload).sort((a: any, b: any) => Number(b.open ?? 0) - Number(a.open ?? 0)).slice(0, 8);
    const queryError = [ratingRes.error, riskRes.error, parentEngagementRes.error, analyticsInsightsRes.error].some(Boolean)
      ? "חלק מנתוני האנליטיקה לא נטענו. ייתכן שמיגרציה או מקור נתונים עדיין לא הופעלו."
      : null;

    return {
      gardens,
      ratings,
      risks,
      activeGardens,
      activeInspectors,
      activeChildren,
      activeStaff,
      safetyAverage: avg(ratings, "safety_score"),
      complianceAverage: avg(ratings, "compliance_score"),
      inspectionAverage: avg(ratings, "inspection_score"),
      observerAverage: avg(ratings, "observer_score") || calibrationAverage,
      parentEngagementCount: parentEngagement.length,
      cameraUsageCount: videoSessions.filter((session) => session.viewer_role === "parent").length,
      documentApprovals: documents.filter((doc) => ["approved", "signed"].includes(String(doc.status))).length,
      taskCompletionRate: pct(tasks.filter((task) => completed(task.status) || task.completed_at).length, tasks.length),
      attendanceCompletionRate: pct(attendance.filter((row) => ["present", "checked_in", "completed"].includes(String(row.status))).length, attendance.length),
      inspectionCompletionRate: pct(completedInspections, completedInspections + openInspections),
      unresolvedFindings,
      incidents,
      complaintsCurrent,
      complianceOpen,
      observerSignals,
      observerReviewRate,
      falsePositiveRate,
      calibrationAverage,
      highRisk,
      risingRisk,
      benchmarks,
      regions,
      inspectorRows,
      assistantUsage,
      insights: [...insights, ...storedInsights.map((item) => item.summary)].slice(0, 8),
      queryError
    };
  }, {
    gardens: [] as any[],
    ratings: [] as any[],
    risks: [] as any[],
    activeGardens: 0,
    activeInspectors: 0,
    activeChildren: 0,
    activeStaff: 0,
    safetyAverage: 0,
    complianceAverage: 0,
    inspectionAverage: 0,
    observerAverage: 0,
    parentEngagementCount: 0,
    cameraUsageCount: 0,
    documentApprovals: 0,
    taskCompletionRate: 0,
    attendanceCompletionRate: 0,
    inspectionCompletionRate: 0,
    unresolvedFindings: 0,
    incidents: [] as any[],
    complaintsCurrent: [] as any[],
    complianceOpen: 0,
    observerSignals: [] as any[],
    observerReviewRate: 0,
    falsePositiveRate: 0,
    calibrationAverage: 0,
    highRisk: 0,
    risingRisk: 0,
    benchmarks: [] as any[],
    regions: [] as any[],
    inspectorRows: [] as any[],
    assistantUsage: [] as any[],
    insights: [] as string[],
    queryError: null as string | null
  });

  const data = result.data;

  return (
    <DashboardShell role="admin" title="מרכז אנליטיקה">
      <div className="commercial-dashboard analytics-center-shell">
        <PremiumDashboardHero
          eyebrow="National Analytics"
          title="מרכז אנליטיקה ומודיעין ארצי"
          subtitle="השוואות, מגמות ומדדים בין גנים, אזורים, מפקחים ותשתיות. הנתונים מוצגים כאגרגציה וללא מידע אישי של ילדים או הורים."
          badge={`${data.activeGardens} גנים פעילים`}
          badgeTone={data.activeGardens ? "good" : "warn"}
          actions={<><Link className="button primary" href="/dashboard/admin/rating-system">דירוג</Link><Link className="button secondary" href="/dashboard/admin/scale-validation">סקייל</Link></>}
        >
          <div className="setup-checklist"><span>אגרגציה בלבד</span><span>Benchmarking</span><span>מגמות לאומיות</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="גנים פעילים" value={data.activeGardens} tone="good" />
          <RoleMetricCard label="מפקחים פעילים" value={data.activeInspectors} tone={data.activeInspectors ? "good" : "warn"} />
          <RoleMetricCard label="ילדים פעילים" value={data.activeChildren} hint="ספירה בלבד" tone="good" />
          <RoleMetricCard label="צוות פעיל" value={data.activeStaff} tone="good" />
          <RoleMetricCard label="בטיחות" value={`${data.safetyAverage}/100`} tone={analyticsTone(data.safetyAverage)} />
          <RoleMetricCard label="ציות" value={`${data.complianceAverage}/100`} tone={analyticsTone(data.complianceAverage)} />
          <RoleMetricCard label="פיקוח" value={`${data.inspectionAverage}/100`} tone={analyticsTone(data.inspectionAverage)} />
          <RoleMetricCard label="תצפיתן" value={`${data.observerAverage}/100`} tone={analyticsTone(data.observerAverage)} />
        </section>

        <section className="analytics-trend-grid">
          <article><LineChart /><span>מעורבות הורים</span><strong>{data.parentEngagementCount}</strong><small>אירועים אגרגטיביים ב-30 יום</small></article>
          <article><Camera /><span>צפיות מצלמה</span><strong>{data.cameraUsageCount}</strong><small>צפיות הורים מורשות</small></article>
          <article><FileText /><span>אישורי מסמכים</span><strong>{data.documentApprovals}</strong><small>ללא פרטי מסמך אישי</small></article>
          <article><Activity /><span>השלמת משימות</span><strong>{data.taskCompletionRate}%</strong><small>צוות ותפעול</small></article>
          <article><ClipboardCheck /><span>פיקוח נסגר</span><strong>{data.inspectionCompletionRate}%</strong><small>{data.unresolvedFindings} ממצאים פתוחים</small></article>
          <article><Radar /><span>סיכון עולה</span><strong>{data.risingRisk}</strong><small>{data.highRisk} גנים בסיכון גבוה</small></article>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><Sparkles size={20} /> תובנות מבוססות נתונים</h2>
            <div className="analytics-insight-list">{data.insights.map((insight) => <span key={insight}>{insight}</span>)}</div>
          </article>
          <article className="card action-panel">
            <h2><ShieldCheck size={20} /> ממשל נתונים</h2>
            <div className="setup-checklist">{analyticsGovernanceRules.map((rule) => <span key={rule}>{rule}</span>)}</div>
          </article>
        </section>

        <CleanSection title="Benchmarking בין גנים" subtitle="השוואה לפי ציון, אחוזון, מעורבות הורים והשלמת צוות.">
          {data.benchmarks.length === 0 ? <EmptyState title="אין עדיין נתוני benchmarking" text="לאחר חישוב דירוגים, ההשוואות יופיעו כאן." /> : (
            <div className="analytics-table">
              {data.benchmarks.slice(0, 12).map((row: any) => <Link className="analytics-row" href={`/dashboard/admin/gardens/${row.garden_id ?? row.kindergarten_id}`} key={row.id}>
                <div><strong>{row.gardens?.name ?? row.garden?.name ?? "גן"}</strong><span>{row.gardens?.city ?? row.garden?.city ?? "אזור לא צוין"} · אחוזון {row.percentile}</span></div>
                <span>ארצי <b>{row.nationalAverage}/100</b></span>
                <span>הורים <b>{row.parentEngagement}</b></span>
                <span>צוות <b>{row.staffCompletion}</b></span>
                <StatusBadge tone={analyticsTone(Number(row.overall_score ?? 0))}>{row.overall_score ?? 0}/100</StatusBadge>
              </Link>)}
            </div>
          )}
        </CleanSection>

        <CleanSection title="אנליטיקה אזורית" subtitle="Country → Region → City → Kindergarten, בלי מידע אישי.">
          {data.regions.length === 0 ? <EmptyState title="אין אזורים להצגה" /> : (
            <div className="analytics-region-grid">
              {data.regions.slice(0, 10).map((region: any) => <article key={region.region}>
                <MapPinned />
                <strong>{region.region}</strong>
                <span>{region.activeGardens}/{region.gardens} גנים פעילים</span>
                <small>בטיחות {region.safetyScore}/100 · ציות {region.complianceScore}/100 · תצפיתן {region.observerScore}/100</small>
              </article>)}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><UsersRound size={20} /> אנליטיקת מפקחים</h2>
            {data.inspectorRows.length === 0 ? <div className="empty-mini">אין עומס מפקחים להצגה.</div> : data.inspectorRows.map((row: any) => <div className="list-item" key={row.inspectorId}><div><strong>{row.inspectorId === "לא משויך" ? "לא משויך" : `מפקח ${String(row.inspectorId).slice(0, 8)}`}</strong><span>{row.completed} הושלמו · {row.findings} ממצאים</span></div><StatusBadge tone={row.open ? "warn" : "good"}>{row.open} פתוחות</StatusBadge></div>)}
          </article>
          <article className="card action-panel">
            <h2><BarChart3 size={20} /> שימוש בעוזר AI</h2>
            {data.assistantUsage.length === 0 ? <div className="empty-mini">אין עדיין שימוש מתועד.</div> : data.assistantUsage.slice(0, 8).map((row: any) => <div className="list-item" key={`${row.role}-${row.question_key}`}><div><strong>{row.role}</strong><span>{row.question_key}</span></div><StatusBadge tone={Number(row.unresolved_count ?? 0) ? "warn" : "good"}>{row.usage_count}</StatusBadge></div>)}
          </article>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><ShieldCheck size={20} /> בטיחות וציות</h2>
            <div className="analytics-mini-grid">
              <span>אירועים <b>{data.incidents.length}</b></span>
              <span>פניות <b>{data.complaintsCurrent.length}</b></span>
              <span>ציות פתוח <b>{data.complianceOpen}</b></span>
              <span>ממצאים פתוחים <b>{data.unresolvedFindings}</b></span>
            </div>
          </article>
          <article className="card action-panel">
            <h2><Radar size={20} /> תצפיתן וסיכון</h2>
            <div className="analytics-mini-grid">
              <span>סיגנלים <b>{data.observerSignals.length}</b></span>
              <span>Review <b>{data.observerReviewRate}%</b></span>
              <span>False positive <b>{data.falsePositiveRate}%</b></span>
              <span>כיול <b>{data.calibrationAverage}/100</b></span>
            </div>
            {data.risks.slice(0, 5).map((risk: any) => <div className="list-item" key={risk.id}><div><strong>{risk.gardens?.name ?? "גן"}</strong><span>{riskTrendLabel(risk.risk_trend)} · {riskLevelLabel(risk.risk_level)}</span></div><StatusBadge tone={riskTone(risk.overall_risk_score)}>{risk.overall_risk_score}/100</StatusBadge></div>)}
          </article>
        </section>

        <CleanSection title="שאלות עוזר מנהלים" subtitle="השאלות משתמשות בנתונים קיימים בלבד.">
          <div className="analytics-question-grid">{["איזה אזור השתפר הכי הרבה?", "אילו גנים דורשים תשומת לב?", "אילו מגמות עולות?", "מה הסיכונים הגדולים ביותר?"].map((question) => <Link href="/dashboard/admin/analytics-center" key={question}>{question}</Link>)}</div>
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="דירוג לאומי" text="ציונים והסברים" href="/dashboard/admin/rating-system" icon={TrendingUp} />
          <ActionCard title="סקייל" text="בידוד וביצועים" href="/dashboard/admin/scale-validation" icon={BarChart3} />
          <ActionCard title="פיקוח ארצי" text="מפקחים וממצאים" href="/dashboard/admin/national-inspections" icon={ClipboardCheck} />
          <ActionCard title="ציות" text="מסמכים ותעודות" href="/dashboard/admin/compliance-center" icon={FileText} />
          <ActionCard title="מודיעין סיכון" text="מגמות וסיכונים" href="/dashboard/admin/risk-intelligence" icon={Radar} />
          <ActionCard title="תצפיתן" text="אירועים וכיול" href="/dashboard/admin/observer-network" icon={Camera} />
          <ActionCard title="גנים" text="ניהול פרופילים" href="/dashboard/admin/kindergartens" icon={Building2} />
        </section>
      </div>
    </DashboardShell>
  );
}
