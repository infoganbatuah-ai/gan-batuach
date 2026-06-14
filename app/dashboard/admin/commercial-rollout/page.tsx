import Link from "next/link";
import { Banknote, BarChart3, CalendarCheck, Headphones, Receipt, ShieldAlert, TrendingUp, UsersRound } from "lucide-react";
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
  if (["active", "completed", "paid", "met", "healthy", "ready", "live_validated", "sandbox_validated", "mitigated", "closed", "ready_for_50_gardens", "ready_for_regional_rollout", "ready_for_commercial_scale"].includes(value)) return "good";
  if (["planned", "recruiting", "onboarding", "stabilizing", "in_progress", "tracking", "configured", "trial", "manager_onboarding", "at_risk", "continue_stabilization", "mitigating", "sandbox_ready", "grace_period"].includes(value)) return "warn";
  if (["blocked", "critical", "high", "failed", "suspended", "not_ready", "missed", "open"].includes(value)) return "bad";
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

export default async function CommercialRolloutPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("commercial rollout", async () => {
    const supabase = await createClient();
    const [scores, cohorts, profiles, checklists, payments, adoption, inspections, support, risks, criteria, expansion, feedback, pricing, staffing] = await Promise.all([
      safeQuery<Row>("commercial rollout scores", () => supabase.from("commercial_rollout_readiness_scores" as any).select("*, commercial_rollout_cohorts(cohort_name, rollout_status)").order("calculated_at", { ascending: false }).limit(1)),
      safeQuery<Row>("commercial rollout cohorts", () => supabase.from("commercial_rollout_cohorts" as any).select("*").order("start_date", { ascending: true }).limit(50)),
      safeQuery<Row>("commercial rollout kindergarten profiles", () => supabase.from("commercial_rollout_kindergarten_profiles" as any).select("*, commercial_rollout_cohorts(cohort_name, rollout_status)").order("created_at", { ascending: false }).limit(100)),
      safeQuery<Row>("commercial rollout activation checklists", () => supabase.from("commercial_rollout_activation_checklists" as any).select("*").order("category").limit(300)),
      safeQuery<Row>("commercial rollout payment validation", () => supabase.from("commercial_rollout_payment_validation" as any).select("*").order("payment_stream").limit(160)),
      safeQuery<Row>("commercial rollout adoption metrics", () => supabase.from("commercial_rollout_adoption_metrics" as any).select("*").order("role_area").limit(240)),
      safeQuery<Row>("commercial rollout inspection validation", () => supabase.from("commercial_rollout_inspection_validation" as any).select("*").order("inspection_due_date", { ascending: true }).limit(120)),
      safeQuery<Row>("commercial rollout support validation", () => supabase.from("commercial_rollout_support_validation" as any).select("*").order("tickets_count", { ascending: false }).limit(120)),
      safeQuery<Row>("commercial rollout risks", () => supabase.from("commercial_rollout_risks" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("commercial rollout success criteria", () => supabase.from("commercial_rollout_success_criteria" as any).select("*").order("required", { ascending: false }).limit(80)),
      safeQuery<Row>("commercial rollout expansion readiness", () => supabase.from("commercial_rollout_expansion_readiness" as any).select("*").order("created_at", { ascending: false }).limit(20)),
      safeQuery<Row>("commercial rollout feedback loop", () => supabase.from("commercial_rollout_feedback_loop" as any).select("*").order("created_at", { ascending: false }).limit(80)),
      safeQuery<Row>("commercial rollout pricing insights", () => supabase.from("commercial_rollout_pricing_insights" as any).select("*").order("created_at", { ascending: false }).limit(40)),
      safeQuery<Row>("commercial rollout staffing forecasts", () => supabase.from("commercial_rollout_staffing_forecasts" as any).select("*").order("forecast_type").order("garden_count").limit(40))
    ]);
    return { scores, cohorts, profiles, checklists, payments, adoption, inspections, support, risks, criteria, expansion, feedback, pricing, staffing };
  }, {
    scores: [] as Row[],
    cohorts: [] as Row[],
    profiles: [] as Row[],
    checklists: [] as Row[],
    payments: [] as Row[],
    adoption: [] as Row[],
    inspections: [] as Row[],
    support: [] as Row[],
    risks: [] as Row[],
    criteria: [] as Row[],
    expansion: [] as Row[],
    feedback: [] as Row[],
    pricing: [] as Row[],
    staffing: [] as Row[]
  });

  const data = result.data;
  const score = data.scores[0] ?? {};
  const readiness = Number(score.rollout_readiness_score ?? 0);
  const activeProfiles = data.profiles.filter((profile) => !["cancelled", "suspended"].includes(String(profile.subscription_status)));
  const targetKindergartens = data.cohorts.reduce((sum, cohort) => sum + Number(cohort.target_kindergartens ?? 0), 0);
  const expectedRevenue = data.profiles.reduce((sum, profile) => sum + Number(profile.expected_monthly_price_nis ?? 0), 0);
  const collectedRevenue = data.payments.reduce((sum, payment) => sum + Number(payment.collected_amount_nis ?? 0), 0);
  const failedPayments = data.payments.filter((payment) => ["failed", "blocked"].includes(String(payment.status))).length;
  const highRisks = data.risks.filter((risk) => ["high", "critical"].includes(String(risk.severity)) && !["mitigated", "closed", "accepted"].includes(String(risk.status)));
  const completedChecklist = data.checklists.filter((item) => ["completed", "not_required"].includes(String(item.status))).length;
  const onboardingProgress = data.checklists.length ? Math.round((completedChecklist / data.checklists.length) * 100) : Number(score.onboarding_score ?? 0);
  const parentMetrics = data.adoption.filter((item) => item.role_area === "parent");
  const staffMetrics = data.adoption.filter((item) => item.role_area === "staff");
  const managerMetrics = data.adoption.filter((item) => item.role_area === "manager");
  const parentActivation = avg(parentMetrics, "adoption_score") || Number(score.parent_activation_score ?? 0);
  const staffActivation = avg(staffMetrics, "adoption_score") || Number(score.staff_activation_score ?? 0);
  const managerAdoption = avg(managerMetrics, "adoption_score") || Number(score.manager_adoption_score ?? 0);
  const supportTickets = data.support.reduce((sum, item) => sum + Number(item.tickets_count ?? 0), 0);
  const launchDecision = String(score.launch_decision ?? data.expansion[0]?.decision ?? "not_ready");

  return (
    <DashboardShell role="admin" title="Commercial Rollout">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="First Commercial Rollout"
          title="רולאאוט מסחרי מבוקר ל־10–25 גנים"
          subtitle="מרכז בקרה ללקוחות אמיתיים: קליטה, תשלומים, אימוץ הורים וצוות, פיקוח, תמיכה, סיכונים והכנסות. אין כאן mass launch."
          badge={`${readiness}/100`}
          badgeTone={toneForScore(readiness)}
          actions={<><Link className="button primary" href="/dashboard/admin/commercial-launch">Commercial Launch</Link><Link className="button secondary" href="/dashboard/admin/customer-success">Customer Success</Link></>}
        >
          <div className="setup-checklist">
            <span>10–25 kindergartens only</span>
            <span>Controlled rollout</span>
            <span>Revenue validation</span>
            <span>{label(launchDecision)}</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="Readiness" value={`${readiness}/100`} hint={label(launchDecision)} tone={toneForScore(readiness)} />
          <RoleMetricCard label="Target gardens" value={targetKindergartens || "10-25"} hint={`${data.cohorts.length} cohorts`} tone="warn" />
          <RoleMetricCard label="Active rollout" value={activeProfiles.length} hint={`${data.profiles.length} tracked profiles`} tone={activeProfiles.length ? "warn" : "bad"} />
          <RoleMetricCard label="Onboarding" value={`${onboardingProgress}%`} hint={`${completedChecklist}/${data.checklists.length} checklist`} tone={toneForScore(onboardingProgress)} />
          <RoleMetricCard label="Parent activation" value={`${parentActivation}%`} hint="target 70%" tone={toneForScore(parentActivation)} />
          <RoleMetricCard label="Staff activation" value={`${staffActivation}%`} hint="weekly usage" tone={toneForScore(staffActivation)} />
          <RoleMetricCard label="Revenue collected" value={money(collectedRevenue || score.revenue_collected_nis)} hint={`Expected ${money(expectedRevenue || score.expected_revenue_nis)}`} tone={collectedRevenue ? "good" : "warn"} />
          <RoleMetricCard label="High risks" value={highRisks.length} hint={`${failedPayments} failed payments`} tone={highRisks.length ? "bad" : "good"} />
        </section>

        <CleanSection title="Rollout Cohorts" subtitle="Batch מבוקר של 10–25 גנים, עם סטטוס, owner ותנאי הצלחה.">
          {data.cohorts.length === 0 ? <EmptyState title="אין cohorts מסחריים" text="לאחר הרצת המיגרציה יופיע cohort ראשון של 10–25 גנים." /> : (
            <div className="procedure-list">
              {data.cohorts.map((cohort) => (
                <article className="card procedure-card" key={cohort.id ?? cohort.cohort_key}>
                  <div>
                    <StatusBadge tone={toneForStatus(cohort.rollout_status)}>{label(cohort.rollout_status)}</StatusBadge>
                    <h3>{cohort.cohort_name}</h3>
                    <p>{cohort.target_kindergartens} target kindergartens · {dateText(cohort.start_date)} עד {dateText(cohort.end_date)}</p>
                    <small>{cohort.notes}</small>
                  </div>
                  <div className="procedure-meta">
                    <strong>{cohort.owner ?? "Owner TBD"}</strong>
                    <span>80% managers · 70% parents · no critical blockers</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <CleanSection title="Kindergarten Rollout Profiles" subtitle="כל גן מחובר למקור lead/conversion, קליטה, תשלום, פיקוח ותמיכה.">
          {data.profiles.length === 0 ? <EmptyState title="אין גנים ברולאאוט" /> : (
            <div className="procedure-list">
              {data.profiles.map((profile) => {
                const profileAdoption = data.adoption.filter((item) => item.rollout_profile_id === profile.id);
                const profileRisks = data.risks.filter((risk) => risk.rollout_profile_id === profile.id && !["closed", "mitigated"].includes(String(risk.status)));
                return (
                  <article className="card procedure-card" key={profile.id ?? profile.profile_key}>
                    <div>
                      <StatusBadge tone={toneForStatus(profile.risk_level)}>{label(profile.risk_level)}</StatusBadge>
                      <h3>{profile.kindergarten_name}</h3>
                      <p>{label(profile.source)} · {profile.city ?? "עיר לא צוינה"} · {profile.age_groups_count} כיתות/קבוצות</p>
                      <small>Support: {profile.support_owner ?? "TBD"} · Manager: {profile.manager_name ?? "TBD"}</small>
                    </div>
                    <div className="procedure-meta">
                      <StatusBadge tone={toneForStatus(profile.onboarding_status)}>{label(profile.onboarding_status)}</StatusBadge>
                      <StatusBadge tone={toneForStatus(profile.payment_status)}>{label(profile.payment_status)}</StatusBadge>
                      <span>{money(profile.expected_monthly_price_nis)} MRR · health {profile.customer_health_score}/100 · risks {profileRisks.length} · adoption {avg(profileAdoption, "adoption_score")}%</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Revenue & Payment Validation" subtitle="Gan Batuach subscription נפרד מכספי הורים שמנותבים לגן.">
            <div className="camera-infra-list">
              {data.payments.map((payment) => (
                <article className="camera-infra-row" key={payment.id ?? payment.validation_key}>
                  <div>
                    <strong>{label(payment.payment_stream)}</strong>
                    <span>{payment.validation_notes}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(payment.status)}>{label(payment.status)}</StatusBadge>
                  <small>{money(payment.collected_amount_nis)} / {money(payment.expected_amount_nis)} · {label(payment.revenue_destination)}</small>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Adoption Metrics" subtitle="הורים, צוות ומנהלים נמדדים בנפרד.">
            <div className="camera-infra-kpis">
              <RoleMetricCard label="Manager" value={`${managerAdoption}%`} hint={`${managerMetrics.length} records`} tone={toneForScore(managerAdoption)} />
              <RoleMetricCard label="Parent" value={`${parentActivation}%`} hint={`${parentMetrics.length} records`} tone={toneForScore(parentActivation)} />
              <RoleMetricCard label="Staff" value={`${staffActivation}%`} hint={`${staffMetrics.length} records`} tone={toneForScore(staffActivation)} />
              <RoleMetricCard label="Support tickets" value={supportTickets} hint="rollout support load" tone={supportTickets > 10 ? "bad" : "warn"} />
            </div>
            <div className="procedure-list compact-list">
              {data.adoption.map((metric) => (
                <div className="mini-row" key={metric.id ?? metric.metric_key}>
                  <span>{label(metric.role_area)}</span>
                  <strong><StatusBadge tone={toneForStatus(metric.status)}>{metric.adoption_score}/100</StatusBadge></strong>
                  <small>{metric.activated_count}/{metric.invited_count} activated · {metric.weekly_active_count} weekly active</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Inspection Operations" subtitle="חודשיות, GPS, חתימה, PDF, findings ו-corrective actions.">
            <div className="camera-infra-list">
              {data.inspections.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.validation_key}>
                  <div>
                    <strong>{label(item.monthly_cycle_status)}</strong>
                    <span>Due {dateText(item.inspection_due_date)} · GPS {item.gps_validation_ready ? "ready" : "missing"} · PDF {item.pdf_report_ready ? "ready" : "missing"}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Support Operations" subtitle="כמות פניות, זמן תגובה, בעיות חוזרות, הכשרה ושביעות רצון.">
            <div className="camera-infra-list">
              {data.support.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.support_key}>
                  <div>
                    <strong>{label(item.issue_category)}</strong>
                    <span>{item.tickets_count} tickets · response {item.avg_response_minutes ?? "TBD"} min · repeated {item.repeated_issues}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                  <small>satisfaction {item.satisfaction_score ?? "TBD"}/100</small>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Rollout Risk Register" subtitle="סיכוני קליטה, תשלום, תמיכה, פרטיות, מצלמות, AI, אימוץ ונטישה.">
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

          <CleanSection title="Success Criteria & Launch Decision" subtitle="החלטה אחרי cohort: לייצב, 50 גנים, regional rollout או scale.">
            <div className="procedure-list compact-list">
              {data.criteria.map((item) => (
                <div className="mini-row" key={item.id ?? item.criteria_key}>
                  <span>{item.title}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>{item.actual_value ?? "-"} / {item.threshold_value ?? "-"} · {item.notes}</small>
                </div>
              ))}
              {data.expansion.map((item) => (
                <div className="mini-row" key={item.id ?? item.readiness_key}>
                  <span>{item.report_summary}</span>
                  <strong><StatusBadge tone={toneForStatus(item.decision)}>{label(item.decision)}</StatusBadge></strong>
                  <small>score {item.readiness_score}/100</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Sales Feedback Loop & Pricing Validation" subtitle="התנגדויות, פרטיות, מצלמות, onboarding ותמחור חוזרים ל-website, demo, FAQ וחומרי מכירה.">
            <div className="procedure-list compact-list">
              {data.feedback.map((item) => (
                <div className="mini-row" key={item.id ?? item.feedback_key}>
                  <span>{item.summary}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{label(item.feedback_type)}</StatusBadge></strong>
                  <small>update {label(item.recommended_update_target)} · owner {item.owner ?? "TBD"}</small>
                </div>
              ))}
              {data.pricing.map((item) => (
                <div className="mini-row" key={item.id ?? item.insight_key}>
                  <span>{item.recommendation}</span>
                  <strong>{item.willingness_to_pay_score}/100</strong>
                  <small>{label(item.insight_type)} · {label(item.status)}</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Support & Inspector Staffing Forecast" subtitle="תחזית משאבים ל־25, 50, 100 ו־500 גנים.">
            <div className="camera-infra-list">
              {data.staffing.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.forecast_key}>
                  <div>
                    <strong>{label(item.forecast_type)} · {item.garden_count} gardens</strong>
                    <span>{item.notes}</span>
                  </div>
                  <StatusBadge tone="warn">{item.recommended_staff_count} people</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Executive Rollout Dashboard" subtitle="Revenue, adoption, support, churn risk, blockers and next actions.">
          <section className="grid cols-4">
            <ActionCard icon={Banknote} title="Revenue validation" text={`${money(collectedRevenue)} collected · ${money(expectedRevenue)} expected`} href="/dashboard/admin/billing" />
            <ActionCard icon={UsersRound} title="Adoption" text={`Parents ${parentActivation}% · Staff ${staffActivation}% · Manager ${managerAdoption}%`} href="/dashboard/admin/customer-success" />
            <ActionCard icon={Headphones} title="Support load" text={`${supportTickets} tickets · repeated issues tracked`} href="/dashboard/admin/customer-success" />
            <ActionCard icon={ShieldAlert} title="Blockers" text={`${highRisks.length} high/critical risks · ${score.open_blockers ?? 0} blockers`} href="/dashboard/admin/final-compliance-review" />
            <ActionCard icon={CalendarCheck} title="Inspection readiness" text={`${score.inspection_score ?? 0}/100 inspection operations`} href="/dashboard/admin/inspection-forms" />
            <ActionCard icon={Receipt} title="Payment split" text="Gan Batuach subscription vs parent tuition separation" href="/dashboard/admin/billing" />
            <ActionCard icon={BarChart3} title="Next cohort" text={label(launchDecision)} href="/dashboard/admin/commercial-rollout" />
            <ActionCard icon={TrendingUp} title="Growth loop" text="Use rollout feedback to update sales and website assets" href="/dashboard/admin/growth" />
          </section>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
