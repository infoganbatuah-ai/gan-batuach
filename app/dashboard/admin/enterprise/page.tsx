import Link from "next/link";
import { BarChart3, Building2, ClipboardCheck, Landmark, MapPinned, Megaphone, Network, ShieldCheck, Sparkles, UsersRound, WalletCards } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

function avg(rows: any[], key: string) {
  const values = rows.map((row) => Number(row?.[key] ?? 0)).filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function tone(value: number | string) {
  if (typeof value === "number") {
    if (value >= 82) return "good" as const;
    if (value >= 62) return "warn" as const;
    return "bad" as const;
  }
  return ["active", "completed", "sent", "verified"].includes(value) ? "good" as const : ["onboarding", "pending", "planned", "draft"].includes(value) ? "warn" as const : "bad" as const;
}

function date(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function countBy<T extends Record<string, any>>(rows: T[], key: string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = row[key] ?? "לא משויך";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

export default async function EnterpriseAdministrationPage() {
  const { profile } = await requireRole(["admin", "network_manager"]);
  const result = await safeAdminData("enterprise administration", async () => {
    const supabase = await createClient();
    const [
      networksRes,
      membershipsRes,
      managersRes,
      regionsRes,
      supervisorsRes,
      gardensRes,
      metricsRes,
      ratingsRes,
      risksRes,
      inspectionsRes,
      findingsRes,
      incidentsRes,
      subscriptionsRes,
      noticesRes,
      taskRollupsRes,
      auditRes
    ] = await Promise.all([
      supabase.from("kindergarten_networks" as any).select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("network_kindergartens" as any).select("*, kindergarten_networks(network_name,network_type), gardens(id,name,city,region,municipality,status,safe_status)").order("created_at", { ascending: false }).limit(1000),
      supabase.from("network_manager_assignments" as any).select("*, kindergarten_networks(network_name), profiles!network_manager_assignments_profile_id_fkey(full_name,email,phone)").eq("active", true).order("created_at", { ascending: false }).limit(300),
      supabase.from("enterprise_regions" as any).select("*, kindergarten_networks(network_name), profiles:supervisor_profile_id(full_name)").order("region_name").limit(300),
      supabase.from("enterprise_supervisor_assignments" as any).select("*, kindergarten_networks(network_name), gardens(name,city), profiles!enterprise_supervisor_assignments_profile_id_fkey(full_name)").eq("active", true).order("created_at", { ascending: false }).limit(300),
      supabase.from("gardens" as any).select("id,name,city,region,municipality,network_id,status,safe_status,current_children_count,staff_count,last_inspection_score").limit(1500),
      supabase.from("enterprise_operational_metrics" as any).select("*, kindergarten_networks(network_name), enterprise_regions(region_name,city)").order("snapshot_date", { ascending: false }).limit(200),
      supabase.from("kindergarten_rating_profiles" as any).select("garden_id,overall_score,safety_score,compliance_score,inspection_score,parent_satisfaction_score,observer_score").limit(1500),
      supabase.from("kindergarten_risk_profiles" as any).select("garden_id,overall_risk_score,risk_level,risk_trend").limit(1500),
      supabase.from("inspections" as any).select("id,garden_id,status,completed_at,created_at,weighted_score").limit(3000),
      supabase.from("national_compliance_findings" as any).select("id,garden_id,severity,resolution_status,due_at").limit(3000),
      supabase.from("incident_cases" as any).select("id,garden_id,severity,status,created_at").limit(2000),
      supabase.from("kindergarten_subscriptions" as any).select("id,garden_id,billing_status,renewal_date,current_period_end,status").limit(1500),
      supabase.from("enterprise_communication_notices" as any).select("*, kindergarten_networks(network_name)").order("created_at", { ascending: false }).limit(100),
      supabase.from("enterprise_task_rollups" as any).select("*, kindergarten_networks(network_name)").order("snapshot_date", { ascending: false }).limit(100),
      supabase.from("enterprise_audit_logs" as any).select("*, kindergarten_networks(network_name), gardens(name)").order("created_at", { ascending: false }).limit(80)
    ]);

    [
      networksRes,
      membershipsRes,
      managersRes,
      regionsRes,
      supervisorsRes,
      gardensRes,
      metricsRes,
      ratingsRes,
      risksRes,
      inspectionsRes,
      findingsRes,
      incidentsRes,
      subscriptionsRes,
      noticesRes,
      taskRollupsRes,
      auditRes
    ].forEach((query, index) => logSupabaseError(`enterprise query ${index}`, (query as any).error));

    const networks = (networksRes.data ?? []) as any[];
    const memberships = (membershipsRes.data ?? []) as any[];
    const managers = (managersRes.data ?? []) as any[];
    const regions = (regionsRes.data ?? []) as any[];
    const supervisors = (supervisorsRes.data ?? []) as any[];
    const gardens = (gardensRes.data ?? []) as any[];
    const metrics = (metricsRes.data ?? []) as any[];
    const ratings = (ratingsRes.data ?? []) as any[];
    const risks = (risksRes.data ?? []) as any[];
    const inspections = (inspectionsRes.data ?? []) as any[];
    const findings = (findingsRes.data ?? []) as any[];
    const incidents = (incidentsRes.data ?? []) as any[];
    const subscriptions = (subscriptionsRes.data ?? []) as any[];
    const notices = (noticesRes.data ?? []) as any[];
    const taskRollups = (taskRollupsRes.data ?? []) as any[];
    const audit = (auditRes.data ?? []) as any[];

    const networkGardenIds = new Set(memberships.map((item) => item.garden_id));
    const activeGardens = gardens.filter((garden) => ["active", "safe", "approved"].includes(String(garden.status)) || ["safe", "approved"].includes(String(garden.safe_status))).length;
    const unresolvedFindings = findings.filter((item) => !["resolved", "verified", "closed"].includes(String(item.resolution_status))).length;
    const openIncidents = incidents.filter((item) => !["resolved", "closed"].includes(String(item.status))).length;
    const overdueInspections = inspections.filter((item) => !["done", "completed"].includes(String(item.status)) && !item.completed_at).length;
    const expiringSubscriptions = subscriptions.filter((item) => {
      if (!item.renewal_date) return false;
      return new Date(item.renewal_date).getTime() <= Date.now() + 60 * 86400000;
    }).length;
    const byRegion = countBy(gardens, "region");
    const byCity = countBy(gardens, "city");
    const healthScore = avg(metrics, "health_score") || Math.round((avg(ratings, "overall_score") + Math.max(0, 100 - avg(risks, "overall_risk_score"))) / 2) || 0;
    const complianceScore = avg(metrics, "compliance_score") || avg(ratings, "compliance_score");
    const safetyScore = avg(metrics, "safety_score") || avg(ratings, "safety_score");
    const queryError = [networksRes.error, membershipsRes.error, metricsRes.error].some(Boolean)
      ? "חלק מנתוני Enterprise לא נטענו. ייתכן שמיגרציה או הרשאה עדיין לא הופעלו."
      : null;

    return {
      networks,
      memberships,
      managers,
      regions,
      supervisors,
      gardens,
      metrics,
      ratings,
      risks,
      inspections,
      findings,
      incidents,
      subscriptions,
      notices,
      taskRollups,
      audit,
      networkGardenIds,
      activeGardens,
      unresolvedFindings,
      openIncidents,
      overdueInspections,
      expiringSubscriptions,
      byRegion,
      byCity,
      healthScore,
      complianceScore,
      safetyScore,
      queryError
    };
  }, {
    networks: [] as any[],
    memberships: [] as any[],
    managers: [] as any[],
    regions: [] as any[],
    supervisors: [] as any[],
    gardens: [] as any[],
    metrics: [] as any[],
    ratings: [] as any[],
    risks: [] as any[],
    inspections: [] as any[],
    findings: [] as any[],
    incidents: [] as any[],
    subscriptions: [] as any[],
    notices: [] as any[],
    taskRollups: [] as any[],
    audit: [] as any[],
    networkGardenIds: new Set<string>(),
    activeGardens: 0,
    unresolvedFindings: 0,
    openIncidents: 0,
    overdueInspections: 0,
    expiringSubscriptions: 0,
    byRegion: {} as Record<string, number>,
    byCity: {} as Record<string, number>,
    healthScore: 0,
    complianceScore: 0,
    safetyScore: 0,
    queryError: null as string | null
  });

  const data = result.data;
  const shellRole = profile.role === "network_manager" ? "network_manager" : "admin";

  return (
    <DashboardShell role={shellRole} title="ניהול ארגוני">
      <div className="commercial-dashboard analytics-center-shell">
        <PremiumDashboardHero
          eyebrow="Enterprise Operations"
          title="ניהול רשתות, אזורים ופעילות ארגונית"
          subtitle="מרכז אחד לרשתות גנים, זכיינים, רשויות, מפקחים אזוריים, מדדי פעילות, ציות, בטיחות וכספים. כל נתון נשאר תחום להרשאה המתאימה."
          badge={`${data.healthScore}/100`}
          badgeTone={tone(data.healthScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/analytics-center">אנליטיקה</Link><Link className="button secondary" href="/dashboard/admin/national-inspections">פיקוח ארצי</Link></>}
        >
          <div className="setup-checklist">
            <span>Tenant isolation</span>
            <span>Network Manager</span>
            <span>Regional Operations</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="רשתות" value={data.networks.length} tone={data.networks.length ? "good" : "warn"} />
          <RoleMetricCard label="גנים ברשתות" value={data.networkGardenIds.size} hint={`${data.activeGardens} פעילים`} tone="good" />
          <RoleMetricCard label="אזורים" value={data.regions.length || Object.keys(data.byRegion).length} tone="good" />
          <RoleMetricCard label="מנהלי רשת" value={data.managers.length} tone={data.managers.length ? "good" : "warn"} />
          <RoleMetricCard label="בריאות תפעולית" value={`${data.healthScore}/100`} tone={tone(data.healthScore)} />
          <RoleMetricCard label="ציות" value={`${data.complianceScore}/100`} tone={tone(data.complianceScore)} />
          <RoleMetricCard label="בטיחות" value={`${data.safetyScore}/100`} tone={tone(data.safetyScore)} />
          <RoleMetricCard label="מנויים לחידוש" value={data.expiringSubscriptions} tone={data.expiringSubscriptions ? "warn" : "good"} />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><Network size={20} /> רשתות גנים</h2>
            {data.networks.length === 0 ? <EmptyState title="אין רשתות מוגדרות" text="כשתיווצר רשת, גנים, מנהלים ומדדים יוצגו כאן." /> : data.networks.slice(0, 10).map((network) => {
              const count = data.memberships.filter((item) => item.network_id === network.id).length;
              return (
                <div className="list-item" key={network.id}>
                  <div><strong>{network.network_name}</strong><span>{network.network_type} · {count} גנים</span></div>
                  <StatusBadge tone={tone(network.status)}>{network.status}</StatusBadge>
                </div>
              );
            })}
          </article>
          <article className="card action-panel">
            <h2><MapPinned size={20} /> אזורים ורשויות</h2>
            {Object.keys(data.byRegion).length === 0 ? <EmptyState title="אין חלוקה אזורית" text="אזורים יופיעו לאחר שיוך גנים." /> : Object.entries(data.byRegion).slice(0, 10).map(([region, count]) => (
              <div className="list-item" key={region}>
                <div><strong>{region}</strong><span>{count} גנים · ערים: {Object.keys(data.byCity).slice(0, 3).join(", ") || "טרם"}</span></div>
                <StatusBadge tone="good">אזור</StatusBadge>
              </div>
            ))}
          </article>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><ClipboardCheck size={20} /> ציות ופיקוח ברשתות</h2>
            <div className="parent-trust-list">
              <span>{data.unresolvedFindings} ממצאים פתוחים בכל ההרשאות הזמינות.</span>
              <span>{data.overdueInspections} ביקורות פתוחות או באיחור.</span>
              <span>{data.taskRollups.reduce((sum, row) => sum + Number(row.overdue_count ?? 0), 0)} משימות ארגוניות באיחור.</span>
            </div>
          </article>
          <article className="card action-panel">
            <h2><ShieldCheck size={20} /> בטיחות וסיכון</h2>
            <div className="parent-trust-list">
              <span>{data.openIncidents} תיקי אירוע פתוחים.</span>
              <span>{data.risks.filter((risk) => ["high", "critical"].includes(String(risk.risk_level))).length} גנים ברמת סיכון גבוהה.</span>
              <span>כל המלצה נשארת לבדיקה אנושית וללא פעולה אוטומטית.</span>
            </div>
          </article>
        </section>

        <CleanSection title="מדדי Enterprise" subtitle="מדדים אזוריים ורשתיים לבקרה ניהולית.">
          {data.metrics.length === 0 ? <EmptyState title="אין עדיין מדדי Enterprise" text="לאחר חישוב מדדים יופיעו כאן בריאות, ציות, בטיחות, פיקוח ומעורבות הורים." /> : (
            <div className="analytics-region-grid">
              {data.metrics.slice(0, 12).map((metric) => (
                <article key={metric.id}>
                  <BarChart3 />
                  <strong>{metric.kindergarten_networks?.network_name ?? metric.enterprise_regions?.region_name ?? metric.city ?? metric.scope_type}</strong>
                  <span>{metric.active_kindergartens} גנים · {date(metric.snapshot_date)}</span>
                  <small>בריאות {metric.health_score}/100 · ציות {metric.compliance_score}/100 · בטיחות {metric.safety_score}/100</small>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-3 dashboard-panels">
          <article className="card action-panel">
            <h2><UsersRound size={20} /> מנהלים ומפקחים</h2>
            {[...data.managers, ...data.supervisors].length === 0 ? <div className="empty-mini">אין שיוכים פעילים.</div> : [...data.managers, ...data.supervisors].slice(0, 8).map((item) => (
              <div className="list-item" key={item.id}>
                <div><strong>{item.profiles?.full_name ?? "משתמש"}</strong><span>{item.kindergarten_networks?.network_name ?? item.assignment_type ?? item.assignment_scope}</span></div>
                <StatusBadge tone="good">פעיל</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><Megaphone size={20} /> תקשורת ארגונית</h2>
            {data.notices.length === 0 ? <div className="empty-mini">אין הודעות ארגוניות.</div> : data.notices.slice(0, 8).map((notice) => (
              <div className="list-item" key={notice.id}>
                <div><strong>{notice.title}</strong><span>{notice.kindergarten_networks?.network_name ?? notice.notice_type}</span></div>
                <StatusBadge tone={tone(notice.delivery_status)}>{notice.delivery_status}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><Sparkles size={20} /> עוזר Enterprise</h2>
            <div className="parent-trust-list">
              <span>איזו רשת בסיכון? בדקו גנים עם סיכון גבוה וממצאים פתוחים.</span>
              <span>איזה אזור צריך פיקוח? בדקו ביקורות פתוחות לפי אזור ועיר.</span>
              <span>אילו מנויים דורשים טיפול? {data.expiringSubscriptions} חידושים קרובים.</span>
            </div>
          </article>
        </section>

        <CleanSection title="יומן ארגוני" subtitle="שינויים ארגוניים, הרשאות, שיוכים ופעולות רשת.">
          {data.audit.length === 0 ? <EmptyState title="אין פעולות ארגוניות עדיין" text="פעולות Enterprise יירשמו כאן לאודיט." /> : data.audit.slice(0, 10).map((item) => (
            <div className="list-item" key={item.id}>
              <div><strong>{item.summary ?? item.action_type}</strong><span>{item.kindergarten_networks?.network_name ?? item.gardens?.name ?? item.entity_type ?? "מערכת"} · {date(item.created_at)}</span></div>
              <StatusBadge tone="default">{item.actor_role ?? "system"}</StatusBadge>
            </div>
          ))}
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="אנליטיקה ארצית" text="השוואות ומגמות" href="/dashboard/admin/analytics-center" icon={BarChart3} />
          <ActionCard title="פיקוח ארצי" text="שיוכים ותכנון" href="/dashboard/admin/national-inspections" icon={MapPinned} />
          <ActionCard title="ציות" text="פערים ותעודות" href="/dashboard/admin/compliance-center" icon={ClipboardCheck} />
          <ActionCard title="כספים" text="רשתות ומנויים" href="/dashboard/admin/billing" icon={WalletCards} />
          <ActionCard title="גנים" text="ניהול גנים" href="/dashboard/admin/kindergartens" icon={Building2} />
          <ActionCard title="רשויות" text="מוכנות מוניציפלית" href="/dashboard/admin/reports" icon={Landmark} />
        </section>
      </div>
    </DashboardShell>
  );
}
