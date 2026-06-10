import Link from "next/link";
import { AlertTriangle, BarChart3, CalendarDays, ClipboardCheck, FileWarning, MapPinned, Radar, Route, ShieldCheck, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildInspectionRiskScore, buildNationalInspectionReadiness, inspectionTone } from "@/lib/domain/national-inspections";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function countRows(supabase: SupabaseServerClient, table: string) {
  const { count, error } = await supabase.from(table as any).select("*", { count: "exact", head: true });
  logSupabaseError(`national inspection count ${table}`, error);
  return error ? 0 : count ?? 0;
}

async function countFiltered(supabase: SupabaseServerClient, table: string, apply: (query: any) => any) {
  const { count, error } = await apply(supabase.from(table as any).select("*", { count: "exact", head: true }));
  logSupabaseError(`national inspection count ${table}`, error);
  return error ? 0 : count ?? 0;
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function avg(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;
}

function groupBy<T extends Record<string, any>>(rows: T[], key: string) {
  return rows.reduce<Record<string, T[]>>((acc, row) => {
    const value = String(row[key] ?? "לא משויך");
    (acc[value] ??= []).push(row);
    return acc;
  }, {});
}

export default async function NationalInspectionsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("national inspections", async () => {
    const supabase = await createClient();
    const nowIso = new Date().toISOString();
    const nextMonthIso = new Date(Date.now() + 30 * 86400000).toISOString();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [
      totalInspections,
      completedInspections,
      overdueInspections,
      upcomingInspections,
      activeInspectors,
      unresolvedViolations,
      unresolvedFindings,
      activeComplaints,
      observerRecommendations,
      urgentRecommendations,
      inspectionsRes,
      requiredRes,
      inspectorsRes,
      gardensRes,
      violationsRes,
      findingsRes,
      complaintsRes,
      recommendationsRes,
      plansRes,
      assignmentsRes,
      followUpsRes
    ] = await Promise.all([
      countRows(supabase, "inspections"),
      countFiltered(supabase, "inspections", (query) => query.gte("completed_at", monthStart).in("status", ["done", "completed"])),
      countFiltered(supabase, "required_inspections", (query) => query.lt("due_at", nowIso).neq("status", "done")),
      countFiltered(supabase, "required_inspections", (query) => query.gte("due_at", nowIso).lte("due_at", nextMonthIso).neq("status", "done")),
      countFiltered(supabase, "profiles", (query) => query.eq("role", "inspector").eq("active", true)),
      countFiltered(supabase, "violations", (query) => query.not("status", "in", "(done,completed)")),
      countFiltered(supabase, "national_compliance_findings", (query) => query.in("resolution_status", ["open", "in_progress"])),
      countFiltered(supabase, "complaints", (query) => query.not("status", "eq", "closed")),
      countFiltered(supabase, "observer_inspection_recommendations", (query) => query.in("status", ["new", "reviewing", "planned"])),
      countFiltered(supabase, "observer_inspection_recommendations", (query) => query.gte("risk_score", 75).in("status", ["new", "reviewing", "planned"])),
      supabase.from("inspections" as any).select("id,garden_id,inspector_id,status,completed_at,created_at,weighted_score,violation_count,critical_failures,gps_verified,gardens(name,city),inspectors:inspector_id(full_name)").order("created_at", { ascending: false }).limit(250),
      supabase.from("required_inspections" as any).select("id,garden_id,inspector_id,due_at,status,gardens(name,city,last_inspection_score,safe_status)").neq("status", "done").order("due_at", { ascending: true }).limit(250),
      supabase.from("inspectors" as any).select("id,service_cities,created_at,profiles:id(full_name,phone,email,active)").limit(250),
      supabase.from("gardens" as any).select("id,name,city,status,safe_status,inspector_id,last_inspection_score,next_inspection_at").limit(500),
      supabase.from("violations" as any).select("id,garden_id,title,severity,status,correction_due_at,gardens(name,city)").not("status", "in", "(done,completed)").order("created_at", { ascending: false }).limit(250),
      supabase.from("national_compliance_findings" as any).select("id,garden_id,title,severity,resolution_status,due_at,responsible_party,gardens(name,city)").order("created_at", { ascending: false }).limit(250),
      supabase.from("complaints" as any).select("id,garden_id,subject,severity,status,urgent,assigned_inspector_id,created_at,gardens(name,city)").not("status", "eq", "closed").order("created_at", { ascending: false }).limit(250),
      supabase.from("observer_inspection_recommendations" as any).select("id,garden_id,recommendation_type,risk_reason,risk_score,status,created_at,gardens(name,city)").order("risk_score", { ascending: false }).limit(100),
      supabase.from("national_inspection_plans" as any).select("id,garden_id,inspector_id,plan_type,priority,status,scheduled_for,due_at,recommended_reason,gardens(name,city)").order("due_at", { ascending: true }).limit(120),
      supabase.from("inspector_assignment_history" as any).select("id,inspector_id,garden_id,assignment_scope,assignment_type,city,municipality,starts_at,ends_at,active,profiles:inspector_id(full_name),gardens(name,city)").order("created_at", { ascending: false }).limit(120),
      supabase.from("inspection_follow_up_actions" as any).select("id,garden_id,action_type,status,due_at,completed_at,gardens(name,city)").order("due_at", { ascending: true }).limit(120)
    ]);

    [
      inspectionsRes,
      requiredRes,
      inspectorsRes,
      gardensRes,
      violationsRes,
      findingsRes,
      complaintsRes,
      recommendationsRes,
      plansRes,
      assignmentsRes,
      followUpsRes
    ].forEach((query, index) => logSupabaseError(`national inspections query ${index}`, (query as any).error));

    const inspections = (inspectionsRes.data ?? []) as any[];
    const required = (requiredRes.data ?? []) as any[];
    const inspectors = (inspectorsRes.data ?? []) as any[];
    const gardens = (gardensRes.data ?? []) as any[];
    const violations = (violationsRes.data ?? []) as any[];
    const findings = (findingsRes.data ?? []) as any[];
    const complaints = (complaintsRes.data ?? []) as any[];
    const recommendations = (recommendationsRes.data ?? []) as any[];
    const plans = (plansRes.data ?? []) as any[];
    const assignments = (assignmentsRes.data ?? []) as any[];
    const followUps = (followUpsRes.data ?? []) as any[];

    const requiredByInspector = groupBy(required, "inspector_id");
    const completedByInspector = groupBy(inspections.filter((inspection) => ["done", "completed"].includes(String(inspection.status))), "inspector_id");
    const gardensByInspector = groupBy(gardens.filter((garden) => garden.inspector_id), "inspector_id");
    const inspectorWorkload = inspectors.map((inspector) => {
      const profile = Array.isArray(inspector.profiles) ? inspector.profiles[0] : inspector.profiles;
      const assigned = gardensByInspector[inspector.id]?.length ?? 0;
      const open = requiredByInspector[inspector.id]?.length ?? 0;
      const overdue = (requiredByInspector[inspector.id] ?? []).filter((item) => daysUntil(item.due_at) !== null && Number(daysUntil(item.due_at)) < 0).length;
      const completed = completedByInspector[inspector.id]?.length ?? 0;
      const averageScore = avg((completedByInspector[inspector.id] ?? []).map((item) => Number(item.weighted_score ?? 0)).filter(Boolean));
      return { id: inspector.id, name: profile?.full_name ?? "מפקח", active: profile?.active !== false, assigned, open, overdue, completed, averageScore, cities: inspector.service_cities };
    });
    const overloadedInspectors = inspectorWorkload.filter((item) => item.open >= 12 || item.overdue >= 3).length;

    const gardenRisk = gardens.map((garden) => {
      const gardenViolations = violations.filter((item) => item.garden_id === garden.id);
      const gardenFindings = findings.filter((item) => item.garden_id === garden.id);
      const gardenComplaints = complaints.filter((item) => item.garden_id === garden.id);
      const gardenObserver = recommendations.filter((item) => item.garden_id === garden.id);
      const gardenRequired = required.filter((item) => item.garden_id === garden.id);
      const overdue = gardenRequired.filter((item) => daysUntil(item.due_at) !== null && Number(daysUntil(item.due_at)) < 0).length;
      const riskScore = buildInspectionRiskScore({
        incidents: 0,
        complaints: gardenComplaints.length,
        unresolvedFindings: gardenViolations.length + gardenFindings.length,
        observerAlerts: gardenObserver.length,
        overdueInspections: overdue,
        complianceScore: garden.last_inspection_score
      });
      return { ...garden, riskScore, complaints: gardenComplaints.length, findings: gardenViolations.length + gardenFindings.length, observer: gardenObserver.length, overdue };
    }).sort((a, b) => b.riskScore - a.riskScore);

    const regionRows = Object.entries(groupBy(gardens, "city")).map(([city, cityGardens]) => {
      const ids = new Set(cityGardens.map((garden) => garden.id));
      const cityRequired = required.filter((item) => ids.has(item.garden_id));
      const cityFindings = [...violations, ...findings].filter((item) => ids.has(item.garden_id));
      const cityComplaints = complaints.filter((item) => ids.has(item.garden_id));
      const cityRecommendations = recommendations.filter((item) => ids.has(item.garden_id));
      const overdue = cityRequired.filter((item) => daysUntil(item.due_at) !== null && Number(daysUntil(item.due_at)) < 0).length;
      return {
        city,
        gardens: cityGardens.length,
        overdue,
        findings: cityFindings.length,
        complaints: cityComplaints.length,
        observer: cityRecommendations.length,
        averageScore: avg(cityGardens.map((garden) => Number(garden.last_inspection_score ?? 0)).filter(Boolean)),
        riskScore: buildInspectionRiskScore({
          incidents: 0,
          complaints: cityComplaints.length,
          unresolvedFindings: cityFindings.length,
          observerAlerts: cityRecommendations.length,
          overdueInspections: overdue,
          complianceScore: avg(cityGardens.map((garden) => Number(garden.last_inspection_score ?? 0)).filter(Boolean))
        })
      };
    }).sort((a, b) => b.riskScore - a.riskScore);

    const readiness = buildNationalInspectionReadiness({
      totalInspections,
      completedInspections,
      overdueInspections,
      unresolvedFindings: unresolvedFindings || unresolvedViolations,
      activeInspectors,
      overloadedInspectors,
      urgentRecommendations
    });

    return {
      totalInspections,
      completedInspections,
      overdueInspections,
      upcomingInspections,
      activeInspectors,
      unresolvedFindings: unresolvedFindings || unresolvedViolations,
      activeComplaints,
      observerRecommendations,
      urgentRecommendations,
      inspections,
      required,
      inspectors,
      gardens,
      violations,
      findings,
      complaints,
      recommendations,
      plans,
      assignments,
      followUps,
      inspectorWorkload,
      overloadedInspectors,
      gardenRisk,
      regionRows,
      readiness,
      queryError: [inspectionsRes.error, requiredRes.error, inspectorsRes.error, gardensRes.error].some(Boolean) ? "חלק מנתוני רשת הפיקוח לא נטענו" : null
    };
  }, {
    totalInspections: 0,
    completedInspections: 0,
    overdueInspections: 0,
    upcomingInspections: 0,
    activeInspectors: 0,
    unresolvedFindings: 0,
    activeComplaints: 0,
    observerRecommendations: 0,
    urgentRecommendations: 0,
    inspections: [] as any[],
    required: [] as any[],
    inspectors: [] as any[],
    gardens: [] as any[],
    violations: [] as any[],
    findings: [] as any[],
    complaints: [] as any[],
    recommendations: [] as any[],
    plans: [] as any[],
    assignments: [] as any[],
    followUps: [] as any[],
    inspectorWorkload: [] as any[],
    overloadedInspectors: 0,
    gardenRisk: [] as any[],
    regionRows: [] as any[],
    readiness: buildNationalInspectionReadiness({ totalInspections: 0, completedInspections: 0, overdueInspections: 0, unresolvedFindings: 0, activeInspectors: 0, overloadedInspectors: 0, urgentRecommendations: 0 }),
    queryError: null as string | null
  });

  const data = result.data;
  const readiness = data.readiness;

  return (
    <DashboardShell role="admin" title="National Inspections">
      <div className="commercial-dashboard national-inspection-shell">
        <PremiumDashboardHero
          eyebrow="National Inspection Network"
          title="רשת פיקוח ארצית"
          subtitle="מבט ארצי על פיקוחים, מפקחים, ליקויים, תלונות, תצפיתן וסיכוני ציות לפי גן ואזור."
          badge={`${readiness.readinessScore}/100`}
          badgeTone={readiness.tone}
          actions={<><Link className="button primary" href="/dashboard/admin/inspectors">מפקחים</Link><Link className="button secondary" href="/dashboard/admin/inspection-forms">טפסים</Link></>}
        >
          <div className="setup-checklist">
            <span>מדינה → אזור → עיר → גן</span>
            <span>תכנון + מעקב + סגירה</span>
            <span>המלצות תצפיתן לבדיקה אנושית בלבד</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="ביקורות" value={data.totalInspections} hint={`${data.completedInspections} הושלמו החודש`} tone="good" />
          <RoleMetricCard label="באיחור" value={data.overdueInspections} hint="דורש טיפול" tone={data.overdueInspections ? "bad" : "good"} href="/dashboard/admin/inspections/late" />
          <RoleMetricCard label="קרובות" value={data.upcomingInspections} hint="30 ימים" tone={data.upcomingInspections ? "warn" : "good"} href="/dashboard/admin/inspections/due" />
          <RoleMetricCard label="מפקחים פעילים" value={data.activeInspectors} hint={`${data.overloadedInspectors} בעומס`} tone={data.overloadedInspectors ? "warn" : "good"} href="/dashboard/admin/inspectors" />
          <RoleMetricCard label="השלמה" value={`${readiness.completionRate}%`} hint="חודש נוכחי" tone={inspectionTone(readiness.completionRate)} />
          <RoleMetricCard label="ליקויים פתוחים" value={data.unresolvedFindings} hint="ציות ותיקונים" tone={data.unresolvedFindings ? "warn" : "good"} />
          <RoleMetricCard label="תלונות פעילות" value={data.activeComplaints} hint="כולל הסלמה לפיקוח" tone={data.activeComplaints ? "warn" : "good"} href="/dashboard/admin/complaints" />
          <RoleMetricCard label="המלצות תצפיתן" value={data.observerRecommendations} hint={`${data.urgentRecommendations} דחופות`} tone={data.urgentRecommendations ? "bad" : data.observerRecommendations ? "warn" : "good"} href="/dashboard/admin/ai-events" />
        </section>

        <section className="national-inspection-score-grid">
          <article><ClipboardCheck /><span>השלמת פיקוחים</span><strong>{readiness.completionRate}%</strong></article>
          <article><CalendarDays /><span>עמידה בזמנים</span><strong>{readiness.overdueScore}%</strong></article>
          <article><FileWarning /><span>סגירת ליקויים</span><strong>{readiness.findingsScore}%</strong></article>
          <article><UsersRound /><span>עומס מפקחים</span><strong>{readiness.workloadScore}%</strong></article>
          <article><Radar /><span>תצפיתן לפיקוח</span><strong>{readiness.observerScore}%</strong></article>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><UsersRound size={20} /> עומס מפקחים</h2>
            {data.inspectorWorkload.length === 0 ? <div className="empty-mini">אין מפקחים להצגה.</div> : data.inspectorWorkload.slice(0, 8).map((inspector: any) => (
              <div className="list-item" key={inspector.id}>
                <div><strong>{inspector.name}</strong><span>{inspector.assigned} גנים · {inspector.open} פתוחות · {inspector.completed} הושלמו</span></div>
                <StatusBadge tone={inspector.overdue ? "bad" : inspector.open >= 12 ? "warn" : "good"}>{inspector.overdue} באיחור</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><MapPinned size={20} /> סיכון לפי עיר</h2>
            {data.regionRows.length === 0 ? <div className="empty-mini">אין אזורים להצגה.</div> : data.regionRows.slice(0, 8).map((region: any) => (
              <div className="list-item" key={region.city}>
                <div><strong>{region.city}</strong><span>{region.gardens} גנים · {region.findings} ליקויים · {region.complaints} תלונות</span></div>
                <StatusBadge tone={inspectionTone(100 - region.riskScore)}>סיכון {region.riskScore}</StatusBadge>
              </div>
            ))}
          </article>
        </section>

        <CleanSection title="גנים בסיכון גבוה" subtitle="מיון לפי תלונות, ליקויים, איחורי פיקוח, התראות תצפיתן וציון ציות.">
          {data.gardenRisk.length === 0 ? <EmptyState title="אין גנים להצגה" text="כאשר יהיו נתוני פיקוח, יופיע דירוג סיכון ארצי." /> : (
            <div className="national-inspection-table">
              <div className="national-inspection-head"><span>גן</span><span>עיר</span><span>ליקויים</span><span>תלונות</span><span>תצפיתן</span><span>סיכון</span></div>
              {data.gardenRisk.slice(0, 12).map((garden: any) => (
                <Link href={`/dashboard/admin/gardens/${garden.id}`} className="national-inspection-row" key={garden.id}>
                  <span><strong>{garden.name}</strong><small>{garden.status} · ציון {garden.last_inspection_score ?? "-"}</small></span>
                  <span>{garden.city ?? "-"}</span>
                  <span>{garden.findings}</span>
                  <span>{garden.complaints}</span>
                  <span>{garden.observer}</span>
                  <StatusBadge tone={inspectionTone(100 - garden.riskScore)}>{garden.riskScore}</StatusBadge>
                </Link>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><CalendarDays size={20} /> תכנון פיקוחים</h2>
            {data.plans.length === 0 ? <div className="empty-mini">אין תוכניות פיקוח לאומיות עדיין.</div> : data.plans.slice(0, 8).map((plan: any) => (
              <div className="list-item" key={plan.id}>
                <div><strong>{plan.gardens?.name ?? "גן"}</strong><span>{plan.plan_type} · {plan.priority} · {plan.due_at ? new Date(plan.due_at).toLocaleDateString("he-IL") : "ללא תאריך"}</span></div>
                <StatusBadge tone={inspectionTone(plan.priority)}>{plan.status}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><Radar size={20} /> המלצות תצפיתן לפיקוח</h2>
            {data.recommendations.length === 0 ? <div className="empty-mini">אין המלצות תצפיתן פתוחות.</div> : data.recommendations.slice(0, 8).map((item: any) => (
              <div className="list-item" key={item.id}>
                <div><strong>{item.gardens?.name ?? "גן"}</strong><span>{item.risk_reason}</span></div>
                <StatusBadge tone={inspectionTone(100 - Number(item.risk_score ?? 0))}>{item.risk_score}/100</StatusBadge>
              </div>
            ))}
          </article>
        </section>

        <section className="grid cols-3 dashboard-panels">
          <article className="card action-panel">
            <h2><Route size={20} /> Assignment engine</h2>
            <p>{data.assignments.length} רשומות שיוך: גן, עיר, רשות, אזור, זמני וגיבוי. השיוך הקיים בגן נשמר כמקור אמת תפעולי.</p>
          </article>
          <article className="card action-panel">
            <h2><ShieldCheck size={20} /> Follow-up workflow</h2>
            <p>{data.followUps.length} פעולות המשך: בקשת תיקון, ביקורת אימות וסגירת ממצא.</p>
          </article>
          <article className="card action-panel">
            <h2><AlertTriangle size={20} /> Complaint escalation</h2>
            <p>{data.activeComplaints} תלונות פעילות יכולות להפוך לביקורת תלונה, בקשת מידע או הסלמה דחופה.</p>
          </article>
        </section>

        <section className="quick-actions-grid">
          <ActionCard title="ביקורות" text="כל הביקורות והדוחות" href="/dashboard/admin/inspections" icon={ClipboardCheck} />
          <ActionCard title="ביקורות באיחור" text="מעקב SLA" href="/dashboard/admin/inspections/late" icon={CalendarDays} tone={data.overdueInspections ? "bad" : "good"} />
          <ActionCard title="מפקחים" text="שיוך, עומס וביצועים" href="/dashboard/admin/inspectors" icon={UsersRound} />
          <ActionCard title="תלונות" text="הסלמה לפיקוח" href="/dashboard/admin/complaints" icon={AlertTriangle} />
          <ActionCard title="תצפיתן" text="המלצות לביקורת" href="/dashboard/admin/observer-calibration" icon={Radar} />
          <ActionCard title="דוחות" text="פיקוח ובטיחות" href="/dashboard/admin/reports" icon={BarChart3} />
        </section>
      </div>
    </DashboardShell>
  );
}
