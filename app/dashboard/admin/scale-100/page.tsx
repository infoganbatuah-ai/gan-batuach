import Link from "next/link";
import { Activity, Banknote, BarChart3, BookOpen, Building2, Camera, ClipboardCheck, Database, GraduationCap, Headphones, LineChart, ShieldCheck, TrendingUp, UserCheck, UsersRound } from "lucide-react";
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

function label(value?: string | null) {
  return String(value ?? "לא ידוע").replaceAll("_", " ");
}

function money(value: unknown) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function dateText(value?: string | null) {
  if (!value) return "לא נקבע";
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function toneForScore(score: number): Tone {
  if (score >= 82) return "good";
  if (score >= 58) return "warn";
  return "bad";
}

function toneForStatus(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["active", "completed", "healthy", "met", "mitigated", "closed", "paid", "tracking_ok", "continue_to_250_kindergartens", "expand_to_another_region"].includes(value)) return "good";
  if (["planned", "recruiting", "onboarding", "stabilizing", "tracking", "needs_attention", "near_limit", "watch", "readiness_only", "in_progress", "recommended", "pause_and_stabilize"].includes(value)) return "warn";
  if (["blocked", "critical", "high", "overloaded", "at_risk", "not_met", "open", "negative_margin", "needs_optimization"].includes(value)) return "bad";
  return "default";
}

function avg(rows: Row[], field: string) {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0) / rows.length);
}

export default async function Scale100Page() {
  await requireRole(["admin"]);
  const result = await safeAdminData("100 kindergarten scale program", async () => {
    const supabase = await createClient();
    const [scores, cohorts, profiles, onboarding, automation, adoption, support, inspectors, revenue, payments, infrastructure, security, health, churn, training, sales, risks, criteria, decisions] = await Promise.all([
      safeQuery<Row>("scale 100 readiness scores", () => supabase.from("scale_100_readiness_scores" as any).select("*").order("calculated_at", { ascending: false }).limit(1)),
      safeQuery<Row>("kindergarten scale cohorts", () => supabase.from("kindergarten_scale_cohorts" as any).select("*").order("start_date", { ascending: true }).limit(30)),
      safeQuery<Row>("kindergarten scale profiles", () => supabase.from("kindergarten_scale_profiles" as any).select("*, kindergarten_scale_cohorts(cohort_name, status)").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("scale 100 onboarding metrics", () => supabase.from("scale_100_onboarding_metrics" as any).select("*").order("created_at", { ascending: false }).limit(20)),
      safeQuery<Row>("scale 100 automation tasks", () => supabase.from("scale_100_automation_tasks" as any).select("*").order("priority").order("due_date", { ascending: true }).limit(100)),
      safeQuery<Row>("scale 100 adoption targets", () => supabase.from("scale_100_adoption_targets" as any).select("*").order("role_area").limit(120)),
      safeQuery<Row>("scale 100 support capacity", () => supabase.from("scale_100_support_capacity" as any).select("*").order("kindergarten_count").limit(20)),
      safeQuery<Row>("scale 100 inspector capacity", () => supabase.from("scale_100_inspector_capacity" as any).select("*").order("kindergarten_count").limit(20)),
      safeQuery<Row>("scale 100 revenue unit economics", () => supabase.from("scale_100_revenue_unit_economics" as any).select("*").order("created_at", { ascending: false }).limit(20)),
      safeQuery<Row>("scale 100 payment health", () => supabase.from("scale_100_payment_health" as any).select("*").order("created_at", { ascending: false }).limit(20)),
      safeQuery<Row>("scale 100 infrastructure checks", () => supabase.from("scale_100_infrastructure_checks" as any).select("*").order("area").limit(120)),
      safeQuery<Row>("scale 100 privacy security checks", () => supabase.from("scale_100_privacy_security_checks" as any).select("*").order("risk_level").limit(120)),
      safeQuery<Row>("scale 100 customer health", () => supabase.from("scale_100_customer_health" as any).select("*").order("customer_health_score", { ascending: true }).limit(120)),
      safeQuery<Row>("scale 100 churn risk signals", () => supabase.from("scale_100_churn_risk_signals" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("scale 100 training knowledge", () => supabase.from("scale_100_training_knowledge" as any).select("*").order("category").limit(120)),
      safeQuery<Row>("scale 100 sales insights", () => supabase.from("scale_100_sales_insights" as any).select("*").order("created_at", { ascending: false }).limit(40)),
      safeQuery<Row>("scale 100 risk register", () => supabase.from("scale_100_risk_register" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("scale 100 success criteria", () => supabase.from("scale_100_success_criteria" as any).select("*").order("required", { ascending: false }).limit(80)),
      safeQuery<Row>("scale 100 expansion decisions", () => supabase.from("scale_100_expansion_decisions" as any).select("*").order("created_at", { ascending: false }).limit(20))
    ]);
    return { scores, cohorts, profiles, onboarding, automation, adoption, support, inspectors, revenue, payments, infrastructure, security, health, churn, training, sales, risks, criteria, decisions };
  }, {
    scores: [] as Row[],
    cohorts: [] as Row[],
    profiles: [] as Row[],
    onboarding: [] as Row[],
    automation: [] as Row[],
    adoption: [] as Row[],
    support: [] as Row[],
    inspectors: [] as Row[],
    revenue: [] as Row[],
    payments: [] as Row[],
    infrastructure: [] as Row[],
    security: [] as Row[],
    health: [] as Row[],
    churn: [] as Row[],
    training: [] as Row[],
    sales: [] as Row[],
    risks: [] as Row[],
    criteria: [] as Row[],
    decisions: [] as Row[]
  });

  const data = result.data;
  const score = data.scores[0] ?? {};
  const readiness = Number(score.scale_readiness_score ?? 0);
  const targetKindergartens = data.cohorts.reduce((sum, cohort) => sum + Number(cohort.target_kindergarten_count ?? 0), 0) || 100;
  const activeKindergartens = Number(score.active_kindergartens ?? data.profiles.filter((profile) => ["active", "paid"].includes(String(profile.payment_status))).length);
  const onboardingKindergartens = Number(score.onboarding_kindergartens ?? data.profiles.filter((profile) => ["not_started", "onboarding", "in_progress"].includes(String(profile.onboarding_status))).length);
  const paidKindergartens = Number(score.paid_kindergartens ?? data.profiles.filter((profile) => ["paid", "active"].includes(String(profile.payment_status))).length);
  const suspendedKindergartens = Number(score.suspended_kindergartens ?? data.profiles.filter((profile) => ["suspended"].includes(String(profile.payment_status))).length);
  const support100 = data.support.find((item) => Number(item.kindergarten_count) === 100) ?? data.support[0] ?? {};
  const inspector100 = data.inspectors.find((item) => Number(item.kindergarten_count) === 100) ?? data.inspectors[0] ?? {};
  const parentAdoption = Number(score.parent_activation_score ?? avg(data.adoption.filter((item) => item.role_area === "parent"), "adoption_score"));
  const staffAdoption = Number(score.staff_activation_score ?? avg(data.adoption.filter((item) => item.role_area === "staff"), "adoption_score"));
  const managerAdoption = avg(data.adoption.filter((item) => item.role_area === "manager"), "adoption_score");
  const highRisks = data.risks.filter((risk) => ["high", "critical"].includes(String(risk.severity)) && !["mitigated", "closed", "accepted_risk"].includes(String(risk.status)));
  const criticalSecurity = data.security.filter((check) => ["critical", "high"].includes(String(check.risk_level)) && !["healthy"].includes(String(check.status)));
  const blockers = Number(score.critical_blockers ?? 0) + highRisks.filter((risk) => String(risk.severity) === "critical").length + criticalSecurity.filter((check) => String(check.risk_level) === "critical").length;
  const decision = String(score.launch_decision ?? data.decisions[0]?.decision ?? "pause_and_stabilize");

  return (
    <DashboardShell role="admin" title="100 Kindergarten Scale">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Gan Batuach Scale Program"
          title="תוכנית סקייל מבוקרת ל־100 גנים"
          subtitle="מרכז בקרה לצמיחה מ־10–25 גנים ל־100 גנים: קליטה, תמיכה, פיקוח, תשלומים, אימוץ משתמשים, תשתיות, פרטיות ואבטחה. לא השקה ארצית."
          badge={`${readiness}/100`}
          badgeTone={toneForScore(readiness)}
          actions={<><Link className="button primary" href="/dashboard/admin/regional-scale-up">50–100 Regional</Link><Link className="button secondary" href="/dashboard/admin/commercial-rollout">10–25 Rollout</Link></>}
        >
          <div className="setup-checklist">
            <span>First 25</span>
            <span>Next 25</span>
            <span>Next 50</span>
            <span>{label(decision)}</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="Scale readiness" value={`${readiness}/100`} hint={label(decision)} tone={toneForScore(readiness)} />
          <RoleMetricCard label="Target gardens" value={targetKindergartens} hint={`${data.cohorts.length} cohorts`} tone="warn" />
          <RoleMetricCard label="Active gardens" value={activeKindergartens} hint={`${onboardingKindergartens} onboarding`} tone={activeKindergartens ? "good" : "warn"} />
          <RoleMetricCard label="Paid gardens" value={paidKindergartens} hint={`${suspendedKindergartens} suspended`} tone={paidKindergartens ? "good" : "warn"} />
          <RoleMetricCard label="Support capacity" value={support100.support_staff_needed ?? "TBD"} hint={label(support100.recommended_staffing)} tone={toneForStatus(support100.recommended_staffing)} />
          <RoleMetricCard label="Inspectors needed" value={inspector100.inspectors_needed ?? "TBD"} hint={`${inspector100.monthly_inspections_required ?? 100} monthly inspections`} tone={toneForStatus(inspector100.overload_risk)} />
          <RoleMetricCard label="Parent activation" value={`${parentAdoption}%`} hint="70% minimum · 80% healthy" tone={toneForScore(parentAdoption)} />
          <RoleMetricCard label="Critical blockers" value={blockers} hint={`${highRisks.length} high/critical risks`} tone={blockers ? "bad" : "good"} />
        </section>

        <CleanSection title="100 Kindergarten Cohorts" subtitle="תבנית מבוקרת: first 25, next 25, next 50. אין קפיצה להשקה ארצית.">
          {data.cohorts.length === 0 ? <EmptyState title="אין cohorts לתוכנית 100" text="לאחר הרצת המיגרציה יופיעו שלושת ה-cohorts הבסיסיים." /> : (
            <div className="procedure-list">
              {data.cohorts.map((cohort) => (
                <article className="card procedure-card" key={cohort.id ?? cohort.cohort_key}>
                  <div>
                    <StatusBadge tone={toneForStatus(cohort.status)}>{label(cohort.status)}</StatusBadge>
                    <h3>{cohort.cohort_name}</h3>
                    <p>{cohort.region ?? "אזור לא נקבע"} · {cohort.city ?? "עיר לא נקבעה"} · {dateText(cohort.start_date)} עד {dateText(cohort.end_date)}</p>
                    <small>{cohort.notes}</small>
                  </div>
                  <div className="procedure-meta">
                    <strong>{cohort.target_kindergarten_count} גנים</strong>
                    <span>{cohort.owner ?? "Owner TBD"}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Kindergarten Scale Profiles" subtitle="כל גן מקבל פרופיל: מקור, עיר, כיתות, תשלום, קליטה, אימוץ, פיקוח, תמיכה וסיכון נטישה.">
            <div className="camera-infra-list">
              {data.profiles.map((profile) => (
                <article className="camera-infra-row" key={profile.id ?? profile.profile_key}>
                  <div>
                    <strong>{profile.kindergarten_name}</strong>
                    <span>{label(profile.source)} · {profile.city ?? "עיר TBD"} · {profile.age_groups_count} כיתות · {money(profile.subscription_amount_nis)}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(profile.churn_risk)}>{label(profile.churn_risk)}</StatusBadge>
                  <small>parents {profile.parent_activation_percent}% · staff {profile.staff_activation_percent}% · health {profile.customer_health_score}/100</small>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Onboarding Capacity & Automation" subtitle="מדידת זמן קליטה ותזכורות אוטומטיות למנהלים, מסמכים, צוות, הורים, תשלום ופיקוח ראשון.">
            <div className="camera-infra-list">
              {data.onboarding.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.metric_key}>
                  <div>
                    <strong>{item.average_kindergarten_activation_days} days activation</strong>
                    <span>{item.support_touches_per_kindergarten} support touches/garden · {item.blocked_onboarding_count} blocked</span>
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
                  <small>{label(task.task_type)} · {dateText(task.due_date)} · {task.owner ?? "TBD"}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Parent, Staff & Manager Adoption" subtitle="יעדי אימוץ ברורים: הורים 70/80/90, צוות 80%, מנהלים דרך command center.">
            <div className="camera-infra-kpis">
              <RoleMetricCard label="Parents" value={`${parentAdoption}%`} hint="minimum 70%" tone={toneForScore(parentAdoption)} />
              <RoleMetricCard label="Staff" value={`${staffAdoption}%`} hint="minimum 80%" tone={toneForScore(staffAdoption)} />
              <RoleMetricCard label="Managers" value={`${managerAdoption}%`} hint="command center usage" tone={toneForScore(managerAdoption)} />
            </div>
            <div className="procedure-list compact-list">
              {data.adoption.map((item) => (
                <div className="mini-row" key={item.id ?? item.target_key}>
                  <span>{label(item.role_area)}</span>
                  <strong><StatusBadge tone={toneForStatus(item.threshold_status)}>{item.adoption_score}/100</StatusBadge></strong>
                  <small>{item.activated_count}/{item.invited_count} activated · login {item.login_rate_percent}% · messages {item.message_read_rate_percent}%</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Support & Inspector Capacity" subtitle="תמיכה ומפקחים הם שערי go/no-go לפני 100 גנים.">
            <div className="camera-infra-list">
              {data.support.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.forecast_key}>
                  <div>
                    <strong>{item.kindergarten_count} gardens · {item.support_staff_needed} support staff</strong>
                    <span>{item.tickets_per_kindergarten} tickets/garden · response {item.avg_response_minutes ?? "TBD"} min</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.recommended_staffing)}>{label(item.recommended_staffing)}</StatusBadge>
                </article>
              ))}
              {data.inspectors.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.forecast_key}>
                  <div>
                    <strong>{item.kindergarten_count} gardens · {item.inspectors_needed} inspectors</strong>
                    <span>{item.monthly_inspections_required} monthly inspections · {item.followup_inspections} follow-up · {item.complaint_driven_inspections} complaints</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.overload_risk)}>{label(item.overload_risk)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Revenue, Unit Economics & Payment Health" subtitle="800 ₪ בסיס + 200 ₪ לכיתה נוספת, עם הפרדה מלאה מתשלומי הורים לגן.">
            <div className="camera-infra-list">
              {data.revenue.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.snapshot_key}>
                  <div>
                    <strong>{money(item.projected_revenue_nis)} projected MRR</strong>
                    <span>{money(item.average_revenue_per_kindergarten_nis)} avg/garden · contribution {money(item.contribution_margin_nis)}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                  <small>break-even {item.break_even_kindergartens ?? "TBD"} gardens</small>
                </article>
              ))}
              {data.payments.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.health_key}>
                  <div>
                    <strong>{item.successful_payments} successful · {item.failed_payments} failed</strong>
                    <span>{item.parent_payment_setup_kindergartens} gardens with parent-payment setup · debt {money(item.debt_accumulated_nis)}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Infrastructure, Database & Communications" subtitle="Vercel, Supabase, API, DB, storage, auth, realtime, providers, logs, camera and AI readiness.">
            <div className="procedure-list compact-list">
              {data.infrastructure.map((check) => (
                <div className="mini-row" key={check.id ?? check.check_key}>
                  <span>{label(check.area)} · {check.metric_name}</span>
                  <strong><StatusBadge tone={toneForStatus(check.readiness_status)}>{label(check.readiness_status)}</StatusBadge></strong>
                  <small>{check.recommendation}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Privacy & Security At Scale" subtitle="MFA, audit, RLS, medical data, private documents, camera logs, parent/staff isolation and service role safety.">
            <div className="procedure-list compact-list">
              {data.security.map((check) => (
                <div className="mini-row" key={check.id ?? check.check_key}>
                  <span>{label(check.area)}</span>
                  <strong><StatusBadge tone={toneForStatus(check.risk_level)}>{check.readiness_score}/100</StatusBadge></strong>
                  <small>{check.alert_rule} · {check.recommendation}</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Customer Health & Churn Risk" subtitle="זיהוי מוקדם של גנים בסיכון: שימוש נמוך, תשלומים כושלים, תמיכה פתוחה ואימוץ חלש.">
            <div className="procedure-list compact-list">
              {data.health.map((item) => (
                <div className="mini-row" key={item.id ?? item.score_key}>
                  <span>{item.customer_name ?? "Customer"}</span>
                  <strong><StatusBadge tone={toneForStatus(item.health_status)}>{item.customer_health_score}/100</StatusBadge></strong>
                  <small>manager {item.manager_usage_score} · parents {item.parent_activation_score} · staff {item.staff_activation_score} · support {item.support_score}</small>
                </div>
              ))}
              {data.churn.map((signal) => (
                <div className="mini-row" key={signal.id ?? signal.signal_key}>
                  <span>{label(signal.signal_type)}</span>
                  <strong><StatusBadge tone={toneForStatus(signal.severity)}>{label(signal.severity)}</StatusBadge></strong>
                  <small>{label(signal.recommended_action)} · {signal.notes}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Training, Knowledge Base & Sales Insights" subtitle="הדרכה ותוכן תמיכה לפי דפוסים חוזרים, לצד ביקוש אזורי וסיבות התנגדות.">
            <div className="procedure-list compact-list">
              {data.training.map((item) => (
                <div className="mini-row" key={item.id ?? item.item_key}>
                  <span>{item.title}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>{label(item.category)} · views {item.article_views} · deflection {item.support_deflection_percent}%</small>
                </div>
              ))}
              {data.sales.map((item) => (
                <div className="mini-row" key={item.id ?? item.insight_key}>
                  <span>{item.city ?? "Regional sales"}</span>
                  <strong><StatusBadge tone="warn">{item.leads_count} leads</StatusBadge></strong>
                  <small>{item.parent_demand_count} parent demand · demo conversion {item.demo_conversion_percent}% · {item.recommended_action}</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Risks, Criteria & Expansion Decision" subtitle="Go/no-go אחרי 100: לייצב, 250 גנים, אזור נוסף, גיוס, אוטומציה, תמחור או דחיית מצלמות/AI.">
            <div className="procedure-list compact-list">
              {data.risks.map((risk) => (
                <div className="mini-row" key={risk.id ?? risk.risk_key}>
                  <span>{risk.risk}</span>
                  <strong><StatusBadge tone={toneForStatus(risk.severity)}>{label(risk.severity)}</StatusBadge></strong>
                  <small>{label(risk.category)} · {risk.mitigation}</small>
                </div>
              ))}
              {data.criteria.map((item) => (
                <div className="mini-row" key={item.id ?? item.criteria_key}>
                  <span>{item.metric_name}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{item.current_value}/{item.target_value}</StatusBadge></strong>
                  <small>{item.notes}</small>
                </div>
              ))}
              {data.decisions.map((item) => (
                <div className="mini-row" key={item.id ?? item.decision_key}>
                  <span>{label(item.decision)}</span>
                  <strong><StatusBadge tone={toneForScore(Number(item.readiness_score ?? 0))}>{item.readiness_score}/100</StatusBadge></strong>
                  <small>{item.rationale}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Executive Actions" subtitle="הפעולות המרכזיות לפני הרחבה מעבר ל־100 גנים.">
          <section className="grid cols-4">
            <ActionCard icon={Building2} title="Commercial rollout" text="Verify 10–25 before scaling" href="/dashboard/admin/commercial-rollout" />
            <ActionCard icon={BarChart3} title="Regional scale-up" text="Compare with 50–100 model" href="/dashboard/admin/regional-scale-up" />
            <ActionCard icon={Headphones} title="Support capacity" text={`${support100.support_staff_needed ?? "TBD"} staff forecast`} href="/dashboard/admin/customer-success" />
            <ActionCard icon={ClipboardCheck} title="Inspector capacity" text={`${inspector100.inspectors_needed ?? "TBD"} inspectors for 100`} href="/dashboard/admin/inspectors" />
            <ActionCard icon={Banknote} title="Payments" text="Subscription and parent-payment separation" href="/dashboard/admin/subscriptions" />
            <ActionCard icon={Database} title="Database scale" text="Slow queries, indexes, RLS and log growth" href="/dashboard/admin/database-integrity" />
            <ActionCard icon={Activity} title="System health" text="Vercel, Supabase, API and providers" href="/dashboard/admin/system-health" />
            <ActionCard icon={ShieldCheck} title="Security" text={`${criticalSecurity.length} high-risk checks`} href="/dashboard/admin/security-review" />
            <ActionCard icon={Camera} title="Camera scale" text="Readiness only unless gateway is proven" href="/dashboard/admin/camera-gateway" />
            <ActionCard icon={UsersRound} title="Parent adoption" text={`${parentAdoption}% current readiness`} href="/dashboard/admin/customer-success" />
            <ActionCard icon={UserCheck} title="Staff adoption" text={`${staffAdoption}% current readiness`} href="/dashboard/admin/users" />
            <ActionCard icon={GraduationCap} title="Training scale" text={`${data.training.length} training/KB items`} href="/dashboard/admin/customer-success" />
            <ActionCard icon={BookOpen} title="Knowledge base" text="Reduce repeated support issues" href="/dashboard/admin/customer-success" />
            <ActionCard icon={TrendingUp} title="Sales insights" text={`${data.sales.length} regional insight records`} href="/dashboard/admin/growth" />
            <ActionCard icon={LineChart} title="Executive report" text="100-kindergarten report and recommendation" href="/dashboard/admin/reports" />
          </section>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
