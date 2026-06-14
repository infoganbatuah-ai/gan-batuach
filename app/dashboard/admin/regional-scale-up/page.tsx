import Link from "next/link";
import { Activity, Banknote, Brain, Building2, Camera, ClipboardCheck, Database, Gauge, GraduationCap, Headphones, LineChart, MapPinned, Route, ShieldAlert, TrendingUp, UserCheck, UsersRound } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, any>;
type Tone = "default" | "good" | "warn" | "bad";

async function safeQuery<T>(label: string, run: () => any) {
  try {
    const result = (await run()) as { data: T[] | null; error: any };
    logSupabaseError(label, result.error);
    return result.error ? [] : result.data ?? [];
  } catch (error) {
    logSupabaseError(label, error);
    return [];
  }
}

function money(value: unknown) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function label(value?: string | null) {
  return String(value ?? "לא ידוע").replaceAll("_", " ");
}

function toneForScore(score: number): Tone {
  if (score >= 82) return "good";
  if (score >= 58) return "warn";
  return "bad";
}

function toneForStatus(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["active", "completed", "healthy", "on_forecast", "mitigated", "closed", "continue_to_250", "expand_to_new_city", "approved"].includes(value)) return "good";
  if (["planned", "recruiting", "onboarding", "stabilizing", "tracking", "near_limit", "near_capacity", "watch", "readiness_only", "mitigating", "recommended", "continue_regional_stabilization"].includes(value)) return "warn";
  if (["blocked", "critical", "high", "overloaded", "needs_optimization", "below_forecast", "negative_margin", "not_ready", "open", "at_risk"].includes(value)) return "bad";
  return "default";
}

function dateText(value?: string | null) {
  if (!value) return "לא נקבע";
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function avg(rows: Row[], field: string) {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0) / rows.length);
}

export default async function RegionalScaleUpPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("regional scale-up", async () => {
    const supabase = await createClient();
    const [scores, cohorts, growth, capacity, automation, support, inspectorCapacity, workloads, revenue, economics, infrastructure, cameraObserver, adoption, churn, health, csTasks, training, sales, demand, risks, decisions] = await Promise.all([
      safeQuery<Row>("regional scale readiness scores", () => supabase.from("regional_scale_readiness_scores" as any).select("*, regional_rollout_cohorts(cohort_name, rollout_status, region)").order("calculated_at", { ascending: false }).limit(1)),
      safeQuery<Row>("regional rollout cohorts", () => supabase.from("regional_rollout_cohorts" as any).select("*").order("start_date", { ascending: true }).limit(50)),
      safeQuery<Row>("regional growth plans", () => supabase.from("regional_growth_plans" as any).select("*").order("recommended_priority").order("parent_demand_requests", { ascending: false }).limit(120)),
      safeQuery<Row>("regional onboarding capacity", () => supabase.from("regional_onboarding_capacity" as any).select("*").order("created_at", { ascending: false }).limit(20)),
      safeQuery<Row>("regional onboarding automation tasks", () => supabase.from("regional_onboarding_automation_tasks" as any).select("*").order("priority").order("due_date", { ascending: true }).limit(120)),
      safeQuery<Row>("regional support forecasts", () => supabase.from("regional_support_forecasts" as any).select("*").order("garden_count").limit(20)),
      safeQuery<Row>("regional inspector capacity", () => supabase.from("regional_inspector_capacity" as any).select("*").order("garden_count").limit(20)),
      safeQuery<Row>("regional inspector workloads", () => supabase.from("regional_inspector_workloads" as any).select("*").order("overload_risk").limit(80)),
      safeQuery<Row>("regional revenue validation", () => supabase.from("regional_revenue_scale_validation" as any).select("*").order("created_at", { ascending: false }).limit(20)),
      safeQuery<Row>("regional unit economics", () => supabase.from("regional_unit_economics" as any).select("*").order("created_at", { ascending: false }).limit(20)),
      safeQuery<Row>("regional infrastructure checks", () => supabase.from("regional_infrastructure_scale_checks" as any).select("*").order("area").limit(120)),
      safeQuery<Row>("regional camera observer readiness", () => supabase.from("regional_camera_observer_scale_readiness" as any).select("*").order("readiness_type").limit(40)),
      safeQuery<Row>("regional adoption metrics", () => supabase.from("regional_adoption_metrics" as any).select("*").order("role_area").limit(120)),
      safeQuery<Row>("regional churn risk signals", () => supabase.from("regional_churn_risk_signals" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("regional customer health scores", () => supabase.from("regional_customer_health_scores" as any).select("*").order("customer_health_score", { ascending: true }).limit(120)),
      safeQuery<Row>("regional customer success tasks", () => supabase.from("regional_customer_success_tasks" as any).select("*").order("priority").order("due_date", { ascending: true }).limit(120)),
      safeQuery<Row>("regional training content needs", () => supabase.from("regional_training_content_needs" as any).select("*").order("issue_area").limit(80)),
      safeQuery<Row>("regional sales operations metrics", () => supabase.from("regional_sales_operations_metrics" as any).select("*").order("created_at", { ascending: false }).limit(20)),
      safeQuery<Row>("regional parent demand scaling", () => supabase.from("regional_parent_demand_scaling" as any).select("*").order("parent_requests", { ascending: false }).limit(120)),
      safeQuery<Row>("regional rollout risks", () => supabase.from("regional_rollout_risks" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("regional expansion decisions", () => supabase.from("regional_expansion_decisions" as any).select("*").order("created_at", { ascending: false }).limit(20))
    ]);
    return { scores, cohorts, growth, capacity, automation, support, inspectorCapacity, workloads, revenue, economics, infrastructure, cameraObserver, adoption, churn, health, csTasks, training, sales, demand, risks, decisions };
  }, {
    scores: [] as Row[],
    cohorts: [] as Row[],
    growth: [] as Row[],
    capacity: [] as Row[],
    automation: [] as Row[],
    support: [] as Row[],
    inspectorCapacity: [] as Row[],
    workloads: [] as Row[],
    revenue: [] as Row[],
    economics: [] as Row[],
    infrastructure: [] as Row[],
    cameraObserver: [] as Row[],
    adoption: [] as Row[],
    churn: [] as Row[],
    health: [] as Row[],
    csTasks: [] as Row[],
    training: [] as Row[],
    sales: [] as Row[],
    demand: [] as Row[],
    risks: [] as Row[],
    decisions: [] as Row[]
  });

  const data = result.data;
  const score = data.scores[0] ?? {};
  const readiness = Number(score.scale_readiness_score ?? 0);
  const targetKindergartens = Number(score.target_kindergartens ?? data.cohorts.reduce((sum, cohort) => sum + Number(cohort.target_kindergartens ?? 0), 0));
  const activeKindergartens = Number(score.active_kindergartens ?? data.growth.reduce((sum, row) => sum + Number(row.active_kindergartens ?? 0), 0));
  const latestRevenue = data.revenue[0] ?? {};
  const latestEconomics = data.economics[0] ?? {};
  const parentMetrics = data.adoption.filter((item) => item.role_area === "parent");
  const staffMetrics = data.adoption.filter((item) => item.role_area === "staff");
  const managerMetrics = data.adoption.filter((item) => item.role_area === "manager");
  const parentAdoption = avg(parentMetrics, "adoption_score") || Number(score.adoption_score ?? 0);
  const staffAdoption = avg(staffMetrics, "adoption_score");
  const managerAdoption = avg(managerMetrics, "adoption_score");
  const highRisks = data.risks.filter((risk) => ["high", "critical"].includes(String(risk.severity)) && !["mitigated", "closed", "accepted"].includes(String(risk.status)));
  const openChurn = data.churn.filter((signal) => !["mitigated", "accepted", "closed"].includes(String(signal.status)));
  const infraWatch = data.infrastructure.filter((check) => ["watch", "needs_optimization", "blocked"].includes(String(check.status)));
  const launchDecision = String(score.launch_decision ?? data.decisions[0]?.decision ?? "not_ready");
  const recommendedSupport = data.support.find((item) => Number(item.garden_count) === 100) ?? data.support[0] ?? {};
  const recommendedInspectors = data.inspectorCapacity.find((item) => Number(item.garden_count) === 100) ?? data.inspectorCapacity[0] ?? {};

  return (
    <DashboardShell role="admin" title="Regional Scale-Up">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Regional Scale-Up"
          title="סקייל אזורי מבוקר ל־50–100 גנים"
          subtitle="מרכז בקרה להתרחבות אזורית: קיבולת קליטה, עומס תמיכה, כיסוי מפקחים, הכנסות, אימוץ משתמשים, תשתיות וסיכוני נטישה. עדיין לא השקה ארצית."
          badge={`${readiness}/100`}
          badgeTone={toneForScore(readiness)}
          actions={<><Link className="button primary" href="/dashboard/admin/commercial-rollout">10–25 Rollout</Link><Link className="button secondary" href="/dashboard/admin/customer-success">Customer Success</Link></>}
        >
          <div className="setup-checklist">
            <span>50–100 kindergartens</span>
            <span>Regional only</span>
            <span>Capacity validation</span>
            <span>{label(launchDecision)}</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="Scale readiness" value={`${readiness}/100`} hint={label(launchDecision)} tone={toneForScore(readiness)} />
          <RoleMetricCard label="Target gardens" value={targetKindergartens || "50-100"} hint={`${data.cohorts.length} regional cohorts`} tone="warn" />
          <RoleMetricCard label="Active gardens" value={activeKindergartens} hint="regional rollout only" tone={activeKindergartens ? "warn" : "bad"} />
          <RoleMetricCard label="Support need" value={recommendedSupport.recommended_support_staff ?? "TBD"} hint={label(recommendedSupport.recommendation)} tone={toneForStatus(recommendedSupport.recommendation)} />
          <RoleMetricCard label="Inspectors needed" value={recommendedInspectors.inspectors_needed ?? "TBD"} hint={`${recommendedInspectors.garden_count ?? 100} gardens forecast`} tone={toneForStatus(recommendedInspectors.overload_risk)} />
          <RoleMetricCard label="Forecast MRR" value={money(latestRevenue.forecast_mrr_nis)} hint={`${money(latestRevenue.mrr_nis)} current`} tone={toneForStatus(latestRevenue.status)} />
          <RoleMetricCard label="Contribution" value={money(latestEconomics.contribution_margin_nis)} hint={`${latestEconomics.break_even_kindergartens ?? "TBD"} break-even gardens`} tone={toneForStatus(latestEconomics.status)} />
          <RoleMetricCard label="Open risks" value={highRisks.length + openChurn.length} hint={`${infraWatch.length} infra checks to watch`} tone={highRisks.length || openChurn.length ? "bad" : "good"} />
        </section>

        <CleanSection title="Regional Rollout Cohorts" subtitle="Cohorts אזוריים של 50–100 גנים לפי עיר, אזור, מקור מכירה, רשת גנים או cluster ביקוש הורים.">
          {data.cohorts.length === 0 ? <EmptyState title="אין cohort אזורי" text="לאחר הרצת המיגרציה יופיע cohort בסיסי לסקייל מבוקר." /> : (
            <div className="procedure-list">
              {data.cohorts.map((cohort) => (
                <article className="card procedure-card" key={cohort.id ?? cohort.cohort_key}>
                  <div>
                    <StatusBadge tone={toneForStatus(cohort.rollout_status)}>{label(cohort.rollout_status)}</StatusBadge>
                    <h3>{cohort.cohort_name}</h3>
                    <p>{cohort.region ?? "אזור לא צויין"} · {cohort.city ?? "עיר לא צוינה"} · {label(cohort.cohort_source)}</p>
                    <small>{dateText(cohort.start_date)} עד {dateText(cohort.end_date)} · {cohort.notes}</small>
                  </div>
                  <div className="procedure-meta">
                    <strong>{cohort.target_kindergartens} גנים</strong>
                    <span>{cohort.owner ?? "Owner TBD"}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="City / Region Growth Planning" subtitle="ביקוש הורים, לידים, דמו, המרה וכיסוי מפקחים לפי עיר.">
            <div className="camera-infra-list">
              {data.growth.map((plan) => (
                <article className="camera-infra-row" key={plan.id ?? plan.planning_key}>
                  <div>
                    <strong>{plan.city}</strong>
                    <span>{plan.parent_demand_requests} parent requests · {plan.leads_count} leads · {plan.demo_bookings} demos</span>
                  </div>
                  <StatusBadge tone={toneForStatus(plan.recommended_priority)}>{label(plan.recommended_priority)}</StatusBadge>
                  <small>{plan.active_kindergartens}/{plan.total_target_kindergartens} active · conversion {plan.conversion_rate}%</small>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Regional Demand Dashboard" subtitle="איפה הביקוש הכי חזק ואיפה כדאי לתעדף outreach.">
            <div className="procedure-list compact-list">
              {data.demand.map((item) => (
                <div className="mini-row" key={item.id ?? item.demand_key}>
                  <span>{item.city}</span>
                  <strong><StatusBadge tone={toneForStatus(item.recommended_outreach_priority)}>{item.parent_requests} requests</StatusBadge></strong>
                  <small>{label(item.referral_source)} · conversion {item.parent_demand_conversion_rate}% · {item.high_demand_kindergarten ? "high demand" : "cluster"}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Onboarding Capacity & Automation" subtitle="כמה גנים ניתן לקלוט בשבוע, איפה נדרש אדם, ומה אפשר להפוך למשימה אוטומטית.">
            <div className="camera-infra-list">
              {data.capacity.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.capacity_key}>
                  <div>
                    <strong>{item.kindergartens_per_week} גנים בשבוע</strong>
                    <span>{item.average_activation_days} days activation · parents {item.parent_onboarding_rate}% · documents {item.document_completion_rate}%</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.capacity_status)}>{label(item.capacity_status)}</StatusBadge>
                </article>
              ))}
            </div>
            <div className="procedure-list compact-list">
              {data.automation.map((task) => (
                <div className="mini-row" key={task.id ?? task.task_key}>
                  <span>{task.title}</span>
                  <strong><StatusBadge tone={toneForStatus(task.priority)}>{label(task.priority)}</StatusBadge></strong>
                  <small>{label(task.task_type)} · due {dateText(task.due_date)}</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Support Load & Staffing" subtitle="תחזית עומס תמיכה ל־50, 100, 250 ו־500 גנים.">
            <div className="camera-infra-list">
              {data.support.map((forecast) => (
                <article className="camera-infra-row" key={forecast.id ?? forecast.forecast_key}>
                  <div>
                    <strong>{forecast.garden_count} gardens · {forecast.tickets_per_kindergarten} tickets/garden</strong>
                    <span>Parents {forecast.parent_support_volume} · managers {forecast.manager_support_volume} · staff {forecast.staff_support_volume} · payments {forecast.payment_support_volume}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(forecast.recommendation)}>{label(forecast.recommendation)}</StatusBadge>
                  <small>{forecast.recommended_support_staff} support staff</small>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Inspector Capacity & Workload" subtitle="מפקחים נדרשים לפי ביקור חודשי, זמן נסיעה, ביקורי המשך ותלונות.">
            <div className="camera-infra-list">
              {data.inspectorCapacity.map((forecast) => (
                <article className="camera-infra-row" key={forecast.id ?? forecast.forecast_key}>
                  <div>
                    <strong>{forecast.garden_count} gardens · {forecast.inspectors_needed} inspectors</strong>
                    <span>{forecast.monthly_inspections} monthly inspections · {forecast.travel_time_minutes} min travel · {forecast.average_inspection_duration_minutes} min inspection</span>
                  </div>
                  <StatusBadge tone={toneForStatus(forecast.overload_risk)}>{label(forecast.overload_risk)}</StatusBadge>
                </article>
              ))}
            </div>
            <div className="procedure-list compact-list">
              {data.workloads.map((workload) => (
                <div className="mini-row" key={workload.id ?? workload.workload_key}>
                  <span>{workload.assigned_kindergartens} assigned · {workload.monthly_inspections_due} due</span>
                  <strong><StatusBadge tone={toneForStatus(workload.status)}>{label(workload.status)}</StatusBadge></strong>
                  <small>{workload.overdue_inspections} overdue · {workload.complaints_requiring_visit} complaints requiring visit</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Revenue, Pricing & Unit Economics" subtitle="אימות מחיר 800 ₪ בסיס + 200 ₪ לכיתה נוספת מול עלויות תמיכה, פיקוח, תשתית ותקשורת.">
            <div className="camera-infra-list">
              {data.revenue.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.snapshot_key}>
                  <div>
                    <strong>{money(item.forecast_mrr_nis)} forecast MRR</strong>
                    <span>{money(item.mrr_nis)} current · {money(item.arr_nis)} ARR · {item.average_classes_per_kindergarten} avg classes</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
              {data.economics.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.economics_key}>
                  <div>
                    <strong>{money(item.contribution_margin_nis)} contribution margin</strong>
                    <span>Support {money(item.support_cost_nis)} · inspector {money(item.inspector_cost_nis)} · infrastructure {money(item.infrastructure_cost_nis)}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                  <small>break-even {item.break_even_kindergartens ?? "TBD"} gardens</small>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Infrastructure & Database Scale" subtitle="Vercel, Supabase, DB, storage, audit logs, background jobs and communication volume.">
            <div className="procedure-list compact-list">
              {data.infrastructure.map((check) => (
                <div className="mini-row" key={check.id ?? check.check_key}>
                  <span>{label(check.area)} · {check.metric_name}</span>
                  <strong><StatusBadge tone={toneForStatus(check.status)}>{label(check.status)}</StatusBadge></strong>
                  <small>{check.recommendation}</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Camera & AI Observer Scale" subtitle="מצלמות ו־AI נשארים readiness/shadow עד שיש עומס Gateway, סקירת אנוש וחסימת raw AI להורים.">
            <div className="camera-infra-list">
              {data.cameraObserver.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.readiness_key}>
                  <div>
                    <strong>{label(item.readiness_type)}</strong>
                    <span>{item.active_streams} streams · {item.review_queue_volume} review queue · {item.false_positives} FP · {item.false_negatives} FN</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                  <small>{item.parent_raw_ai_blocked ? "raw AI blocked from parents" : "policy gap"}</small>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Parent, Staff & Manager Adoption" subtitle="אימוץ לפי תפקיד ואזור, כולל שימוש יומי, הודעות, תשלומים, משימות ו-command center.">
            <div className="camera-infra-kpis">
              <RoleMetricCard label="Parents" value={`${parentAdoption}%`} hint={`${parentMetrics.length} records`} tone={toneForScore(parentAdoption)} />
              <RoleMetricCard label="Staff" value={`${staffAdoption}%`} hint={`${staffMetrics.length} records`} tone={toneForScore(staffAdoption)} />
              <RoleMetricCard label="Managers" value={`${managerAdoption}%`} hint={`${managerMetrics.length} records`} tone={toneForScore(managerAdoption)} />
            </div>
            <div className="procedure-list compact-list">
              {data.adoption.map((metric) => (
                <div className="mini-row" key={metric.id ?? metric.metric_key}>
                  <span>{label(metric.role_area)} · {metric.city ?? metric.region ?? "regional"}</span>
                  <strong><StatusBadge tone={toneForStatus(metric.status)}>{metric.adoption_score}/100</StatusBadge></strong>
                  <small>{metric.activated_count}/{metric.invited_count} activated · {metric.daily_active_count} daily active</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Churn Risk & Customer Health 2.0" subtitle="נטישה מתוך שימוש נמוך, פניות חוזרות, תשלומים כושלים, קליטה חסרה ושביעות רצון.">
            <div className="procedure-list compact-list">
              {data.health.map((item) => (
                <div className="mini-row" key={item.id ?? item.score_key}>
                  <span>{item.customer_name ?? "Customer"}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{item.customer_health_score}/100</StatusBadge></strong>
                  <small>usage {item.usage_score} · payment {item.payment_score} · support {item.support_score} · satisfaction {item.satisfaction_score}</small>
                </div>
              ))}
              {data.churn.map((signal) => (
                <div className="mini-row" key={signal.id ?? signal.signal_key}>
                  <span>{label(signal.signal_type)}</span>
                  <strong><StatusBadge tone={toneForStatus(signal.severity)}>{label(signal.severity)}</StatusBadge></strong>
                  <small>{signal.recommended_action}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Customer Success, Training & Knowledge Scaling" subtitle="משימות CS ותוכן הדרכה לבעיות שחוזרות בגנים רבים.">
            <div className="procedure-list compact-list">
              {data.csTasks.map((task) => (
                <div className="mini-row" key={task.id ?? task.task_key}>
                  <span>{task.title}</span>
                  <strong><StatusBadge tone={toneForStatus(task.priority)}>{label(task.priority)}</StatusBadge></strong>
                  <small>{label(task.task_type)} · owner {task.owner ?? "TBD"} · due {dateText(task.due_date)}</small>
                </div>
              ))}
              {data.training.map((item) => (
                <div className="mini-row" key={item.id ?? item.content_key}>
                  <span>{label(item.issue_area)}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>{item.recommended_content}</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Sales Operations Scaling" subtitle="קצב לידים, דמואים, follow-ups, המרה, סיבות הפסד וביצועי referral.">
            <div className="camera-infra-list">
              {data.sales.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.snapshot_key}>
                  <div>
                    <strong>{item.leads_per_week} leads/week · {item.demos_per_week} demos/week</strong>
                    <span>{item.followups_overdue} overdue follow-ups · conversion {item.conversion_rate}%</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Regional Rollout Risk Register" subtitle="סיכוני טכנולוגיה, תמיכה, תשלומים, פרטיות, מצלמות, AI, פיקוח, הצלחת לקוחות ומוניטין.">
            <div className="procedure-list compact-list">
              {data.risks.map((risk) => (
                <div className="mini-row" key={risk.id ?? risk.risk_key}>
                  <span>{risk.title}</span>
                  <strong><StatusBadge tone={toneForStatus(risk.severity)}>{label(risk.severity)}</StatusBadge></strong>
                  <small>{label(risk.risk_type)} · {risk.mitigation}</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Expansion Decision Engine" subtitle="המלצה אחרי 50–100: לייצב, להמשיך ל־250, עיר חדשה, לגייס תמיכה/מפקחים או לדחות מצלמות/AI.">
            <div className="procedure-list compact-list">
              {data.decisions.map((decision) => (
                <div className="mini-row" key={decision.id ?? decision.decision_key}>
                  <span>{label(decision.decision)}</span>
                  <strong><StatusBadge tone={toneForScore(Number(decision.readiness_score ?? 0))}>{decision.readiness_score}/100</StatusBadge></strong>
                  <small>{decision.rationale}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Executive Regional Dashboard" subtitle="תמונת הנהלה נקייה: הכנסות, אימוץ, תמיכה, פיקוח, תשתיות, נטישה והפעולה הבאה.">
          <section className="grid cols-4">
            <ActionCard icon={MapPinned} title="Regional cohorts" text={`${data.cohorts.length} active planning records · ${targetKindergartens || "50-100"} target gardens`} href="/dashboard/admin/regional-scale-up" />
            <ActionCard icon={Building2} title="Commercial rollout" text="Validate 10-25 before scaling to regional cohort" href="/dashboard/admin/commercial-rollout" />
            <ActionCard icon={Headphones} title="Support capacity" text={`${recommendedSupport.recommended_support_staff ?? "TBD"} staff · ${label(recommendedSupport.recommendation)}`} href="/dashboard/admin/customer-success" />
            <ActionCard icon={ClipboardCheck} title="Inspector capacity" text={`${recommendedInspectors.inspectors_needed ?? "TBD"} inspectors needed for ${recommendedInspectors.garden_count ?? 100} gardens`} href="/dashboard/admin/inspectors" />
            <ActionCard icon={Banknote} title="Revenue validation" text={`${money(latestRevenue.forecast_mrr_nis)} forecast MRR · price validation active`} href="/dashboard/admin/billing" />
            <ActionCard icon={Gauge} title="System health" text={`${infraWatch.length} checks require monitoring before expansion`} href="/dashboard/admin/system-health" />
            <ActionCard icon={Database} title="Database scale" text="Slow queries, RLS and audit growth must be watched" href="/dashboard/admin/database-integrity" />
            <ActionCard icon={Camera} title="Camera readiness" text="Readiness only until gateway load is validated" href="/dashboard/admin/camera-gateway" />
            <ActionCard icon={Brain} title="Observer scale" text="Shadow mode and human review remain mandatory" href="/dashboard/admin/observer-pilot" />
            <ActionCard icon={UsersRound} title="Parent adoption" text={`${parentAdoption}% parent activation readiness`} href="/dashboard/admin/customer-success" />
            <ActionCard icon={UserCheck} title="Customer health" text={`${openChurn.length} churn signals open`} href="/dashboard/admin/customer-success" />
            <ActionCard icon={TrendingUp} title="Growth loop" text="Demand clusters and referrals feed the next region" href="/dashboard/admin/growth" />
            <ActionCard icon={Route} title="Sales operations" text="Follow-ups, demos and regional demand pipeline" href="/dashboard/admin/commercial-launch" />
            <ActionCard icon={Activity} title="Infrastructure" text="Vercel, Supabase, storage and comms volume" href="/dashboard/admin/system-health" />
            <ActionCard icon={GraduationCap} title="Training scale" text={`${data.training.length} knowledge items tracked`} href="/dashboard/admin/customer-success" />
            <ActionCard icon={ShieldAlert} title="Expansion blockers" text={`${highRisks.length} high/critical regional risks`} href="/dashboard/admin/final-compliance-review" />
            <ActionCard icon={LineChart} title="Regional report" text="50-100 rollout summary and next expansion recommendation" href="/dashboard/admin/reports" />
          </section>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
