import Link from "next/link";
import { AlertTriangle, Banknote, BriefcaseBusiness, CalendarClock, ClipboardCheck, FileCheck2, GraduationCap, MapPinned, Route, ShieldCheck, TrendingUp, UserCheck, UsersRound } from "lucide-react";
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
  if (["active", "approved", "completed", "healthy", "ready", "paid", "mitigated", "closed", "resolved"].includes(value)) return "good";
  if (["candidate", "training", "planned", "scheduled", "tracking", "medium", "estimated", "in_progress", "open", "needs_review", "manual_only", "recommended"].includes(value)) return "warn";
  if (["paused", "suspended", "inactive", "expired", "rejected", "blocked", "breached", "critical", "high", "overloaded", "missing"].includes(value)) return "bad";
  return "default";
}

export default async function InspectionWorkforcePage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("inspection workforce", async () => {
    const supabase = await createClient();
    const [scores, profiles, assignments, capacity, plans, schedules, routes, compensation, forecasts, performance, quality, training, certs, candidates, slas, alerts, audit, risks] = await Promise.all([
      safeQuery<Row>("inspection workforce scores", () => supabase.from("inspection_workforce_readiness_scores" as any).select("*").order("calculated_at", { ascending: false }).limit(1)),
      safeQuery<Row>("inspection workforce profiles", () => supabase.from("inspection_workforce_profiles" as any).select("*, profiles:inspector_profile_id(full_name,email,phone,active)").order("active_status").limit(120)),
      safeQuery<Row>("inspection workforce assignments", () => supabase.from("inspection_workforce_assignments" as any).select("*, gardens(name,city), primary:primary_inspector_id(full_name), backup:backup_inspector_id(full_name), supervisor:regional_supervisor_id(full_name)").order("region").limit(160)),
      safeQuery<Row>("inspection workforce capacity", () => supabase.from("inspection_workforce_capacity_models" as any).select("*").order("inspections_per_month").limit(20)),
      safeQuery<Row>("inspection workforce monthly plans", () => supabase.from("inspection_workforce_monthly_plans" as any).select("*").order("plan_month", { ascending: false }).limit(80)),
      safeQuery<Row>("inspection workforce schedules", () => supabase.from("inspection_workforce_schedules" as any).select("*, gardens(name,city)").order("scheduled_date", { ascending: true }).limit(120)),
      safeQuery<Row>("inspection workforce routes", () => supabase.from("inspection_workforce_routes" as any).select("*").order("route_date", { ascending: true }).limit(80)),
      safeQuery<Row>("inspection workforce compensation", () => supabase.from("inspection_workforce_compensation" as any).select("*, profiles:inspector_id(full_name)").order("estimated_monthly_payout_nis", { ascending: false }).limit(120)),
      safeQuery<Row>("inspection workforce financial forecasts", () => supabase.from("inspection_workforce_financial_forecasts" as any).select("*").order("scenario_kindergartens").limit(20)),
      safeQuery<Row>("inspection workforce performance", () => supabase.from("inspection_workforce_performance" as any).select("*, profiles:inspector_id(full_name)").order("metric_month", { ascending: false }).limit(120)),
      safeQuery<Row>("inspection workforce quality", () => supabase.from("inspection_workforce_quality_reviews" as any).select("*").order("severity").order("due_date", { ascending: true }).limit(120)),
      safeQuery<Row>("inspection workforce training", () => supabase.from("inspection_workforce_training" as any).select("*").order("module_type").limit(160)),
      safeQuery<Row>("inspection workforce certifications", () => supabase.from("inspection_workforce_certifications" as any).select("*").order("document_type").limit(160)),
      safeQuery<Row>("inspection workforce candidates", () => supabase.from("inspection_workforce_candidates" as any).select("*").order("status").limit(120)),
      safeQuery<Row>("inspection workforce slas", () => supabase.from("inspection_workforce_slas" as any).select("*").order("sla_type").limit(40)),
      safeQuery<Row>("inspection workforce alerts", () => supabase.from("inspection_workforce_alerts" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("inspection workforce audit", () => supabase.from("inspection_workforce_audit_events" as any).select("*").order("created_at", { ascending: false }).limit(80)),
      safeQuery<Row>("inspection workforce risks", () => supabase.from("inspection_workforce_risks" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(120))
    ]);
    return { scores, profiles, assignments, capacity, plans, schedules, routes, compensation, forecasts, performance, quality, training, certs, candidates, slas, alerts, audit, risks };
  }, {
    scores: [] as Row[],
    profiles: [] as Row[],
    assignments: [] as Row[],
    capacity: [] as Row[],
    plans: [] as Row[],
    schedules: [] as Row[],
    routes: [] as Row[],
    compensation: [] as Row[],
    forecasts: [] as Row[],
    performance: [] as Row[],
    quality: [] as Row[],
    training: [] as Row[],
    certs: [] as Row[],
    candidates: [] as Row[],
    slas: [] as Row[],
    alerts: [] as Row[],
    audit: [] as Row[],
    risks: [] as Row[]
  });

  const data = result.data;
  const score = data.scores[0] ?? {};
  const readiness = Number(score.workforce_readiness_score ?? 0);
  const activeInspectors = Number(score.active_inspectors ?? data.profiles.filter((profile) => profile.active_status === "active").length);
  const assignedKindergartens = Number(score.assigned_kindergartens ?? data.assignments.filter((assignment) => assignment.status === "active").length);
  const dueThisMonth = Number(score.inspections_due_this_month ?? data.plans.reduce((sum, plan) => sum + Number(plan.inspections_due ?? 0), 0));
  const overdueInspections = Number(score.overdue_inspections ?? data.plans.reduce((sum, plan) => sum + Number(plan.overdue_inspections ?? 0), 0));
  const followUps = Number(score.follow_up_inspections ?? data.plans.reduce((sum, plan) => sum + Number(plan.follow_up_inspections ?? 0), 0));
  const complaintDriven = Number(score.complaint_driven_inspections ?? data.plans.reduce((sum, plan) => sum + Number(plan.complaint_driven_inspections ?? 0), 0));
  const openRisks = data.risks.filter((risk) => !["mitigated", "accepted_risk", "closed"].includes(String(risk.status)));
  const highAlerts = data.alerts.filter((alert) => ["high", "critical"].includes(String(alert.severity)) && !["resolved", "skipped"].includes(String(alert.status)));
  const forecast100 = data.forecasts.find((item) => Number(item.scenario_kindergartens) === 100) ?? data.forecasts[0] ?? {};
  const capacity100 = data.capacity.find((item) => item.model_key === "capacity-100-kindergartens") ?? data.capacity[0] ?? {};

  return (
    <DashboardShell role="admin" title="Inspection Workforce">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="National Inspection Workforce"
          title="תפעול כוח אדם ארצי למפקחים"
          subtitle="מרכז שליטה לתכנון כוח מפקחים: שיוכים אזוריים, קיבולת חודשית, לו״ז, מסלולים, תגמול, ביצועים, הכשרה, SLA וסיכונים. AI ותצפיתן מסייעים בתיעדוף בלבד."
          badge={`${readiness}/100`}
          badgeTone={toneForScore(readiness)}
          actions={<><Link className="button primary" href="/dashboard/admin/national-inspections">National Inspections</Link><Link className="button secondary" href="/dashboard/admin/inspectors">Inspectors</Link></>}
        >
          <div className="setup-checklist">
            <span>Human inspection required</span>
            <span>No automatic pass/fail</span>
            <span>Regional coverage</span>
            <span>Compensation readiness</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="Readiness" value={`${readiness}/100`} hint={`${openRisks.length} open risks`} tone={toneForScore(readiness)} />
          <RoleMetricCard label="Active inspectors" value={activeInspectors} hint={`${data.profiles.length} workforce profiles`} tone={activeInspectors ? "good" : "warn"} />
          <RoleMetricCard label="Assigned gardens" value={assignedKindergartens} hint="primary / backup / supervisor" tone={assignedKindergartens ? "good" : "warn"} />
          <RoleMetricCard label="Due this month" value={dueThisMonth} hint={`${overdueInspections} overdue`} tone={overdueInspections ? "bad" : "warn"} />
          <RoleMetricCard label="Follow-ups" value={followUps} hint={`${complaintDriven} complaint-driven`} tone={followUps || complaintDriven ? "warn" : "good"} />
          <RoleMetricCard label="Capacity @100" value={capacity100.max_kindergartens_per_inspector ?? "TBD"} hint={label(capacity100.overload_risk)} tone={toneForStatus(capacity100.overload_risk)} />
          <RoleMetricCard label="Cost @100" value={money(forecast100.inspector_cost_nis)} hint={`${forecast100.inspectors_needed ?? "TBD"} inspectors`} tone={toneForStatus(forecast100.operational_risk)} />
          <RoleMetricCard label="High alerts" value={highAlerts.length} hint="workforce alerts" tone={highAlerts.length ? "bad" : "good"} />
        </section>

        <CleanSection title="Inspector Workforce Profiles" subtitle="סטטוס מפקח, אזור, ערים, קיבולת חודשית, גנים משויכים, תעודות והכשרה.">
          {data.profiles.length === 0 ? <EmptyState title="אין פרופילי workforce" text="לאחר הרצת המיגרציה יופיעו נתוני readiness, ומפקחים אמיתיים יתווספו מכרטיסי הפרופיל." /> : (
            <div className="procedure-list">
              {data.profiles.map((profile) => {
                const person = Array.isArray(profile.profiles) ? profile.profiles[0] : profile.profiles;
                return (
                  <article className="card procedure-card" key={profile.id}>
                    <div>
                      <StatusBadge tone={toneForStatus(profile.active_status)}>{label(profile.active_status)}</StatusBadge>
                      <h3>{person?.full_name ?? "Inspector profile"}</h3>
                      <p>{profile.region ?? "Region TBD"} · {Array.isArray(profile.city_coverage) ? profile.city_coverage.join(", ") : ""}</p>
                      <small>{profile.assigned_kindergarten_count} assigned · {profile.monthly_capacity} monthly capacity · {profile.completed_inspections} completed · {profile.overdue_inspections} overdue</small>
                    </div>
                    <div className="procedure-meta">
                      <StatusBadge tone={toneForStatus(profile.certification_status)}>{label(profile.certification_status)}</StatusBadge>
                      <StatusBadge tone={toneForStatus(profile.training_status)}>{label(profile.training_status)}</StatusBadge>
                      <span>{label(profile.compensation_model)} · {label(profile.employment_type)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Regional Assignment & Coverage" subtitle="שיוך לפי אזור, עיר, רשת גנים, אדמין ידני או איזון עומסים.">
            <div className="camera-infra-list">
              {data.assignments.map((assignment) => (
                <article className="camera-infra-row" key={assignment.id ?? assignment.assignment_key}>
                  <div>
                    <strong>{assignment.gardens?.name ?? "Kindergarten assignment"}</strong>
                    <span>{assignment.region ?? "Region TBD"} · {assignment.city ?? assignment.gardens?.city ?? "City TBD"} · {label(assignment.assignment_method)}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(assignment.status)}>{label(assignment.status)}</StatusBadge>
                  <small>primary {assignment.primary?.full_name ?? "TBD"} · backup {assignment.backup?.full_name ?? "optional"} · workload {assignment.workload_score}/100</small>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Capacity Calculator" subtitle="כמה גנים מפקח יכול לכסות כשמחשבים ביקור, נסיעה, כתיבת דוח, ביקורי המשך, תלונות ודחופים.">
            <div className="camera-infra-list">
              {data.capacity.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.model_key}>
                  <div>
                    <strong>{item.scenario_name}</strong>
                    <span>{item.inspections_per_month} inspections · {item.average_inspection_duration_minutes} min visit · {item.average_travel_time_minutes} min travel · {item.report_writing_minutes} min report</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.overload_risk)}>{item.max_kindergartens_per_inspector} gardens/inspector</StatusBadge>
                  <small>{item.recommended_hiring_point}</small>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Monthly Workload & Scheduling" subtitle="ביקורות חודשיות, המשך, פתע, דחופות ותלונה. אין החלטה רגולטורית אוטומטית.">
            <div className="procedure-list compact-list">
              {data.plans.map((plan) => (
                <div className="mini-row" key={plan.id ?? plan.plan_key}>
                  <span>{plan.region ?? "Region"} · week {plan.week_number ?? "-"}</span>
                  <strong><StatusBadge tone={toneForStatus(plan.overload_status)}>{plan.inspections_due} due</StatusBadge></strong>
                  <small>{plan.inspections_scheduled} scheduled · {plan.overdue_inspections} overdue · {plan.urgent_visits} urgent</small>
                </div>
              ))}
              {data.schedules.map((schedule) => (
                <div className="mini-row" key={schedule.id ?? schedule.schedule_key}>
                  <span>{schedule.gardens?.name ?? "Inspection"} · {label(schedule.inspection_type)}</span>
                  <strong><StatusBadge tone={toneForStatus(schedule.status)}>{label(schedule.status)}</StatusBadge></strong>
                  <small>{dateText(schedule.scheduled_date)} · {schedule.expected_duration_minutes} minutes</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Route Planning Readiness" subtitle="כתובות, עיר, אזור, מסלול יומי וחלון זמן. Google Maps/Waze/Mapbox עתידי בלבד.">
            <div className="camera-infra-list">
              {data.routes.map((route) => (
                <article className="camera-infra-row" key={route.id ?? route.route_key}>
                  <div>
                    <strong>{route.region ?? "Region"} · {route.city ?? "City"}</strong>
                    <span>{route.travel_distance_estimate_km} km estimate · {route.time_window ?? "time window TBD"}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(route.status)}>{label(route.map_provider_readiness)}</StatusBadge>
                  <small>{dateText(route.route_date)}</small>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Compensation & Financial Planning" subtitle="50 ₪/גן לחודש, תשלום לפי ביקורת, שכר קבוע או מודל היברידי. חישוב בלבד, לא תשלום בפועל.">
            <div className="camera-infra-list">
              {data.compensation.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.compensation_key}>
                  <div>
                    <strong>{item.profiles?.full_name ?? "Inspector"} · {money(item.estimated_monthly_payout_nis)}</strong>
                    <span>{label(item.compensation_model)} · {item.assigned_kindergarten_count} gardens · {item.completed_inspections_count} inspections</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.payout_status)}>{label(item.payout_status)}</StatusBadge>
                </article>
              ))}
              {data.forecasts.map((forecast) => (
                <article className="camera-infra-row" key={forecast.id ?? forecast.forecast_key}>
                  <div>
                    <strong>{forecast.scenario_kindergartens} gardens · {forecast.inspectors_needed} inspectors</strong>
                    <span>cost {money(forecast.inspector_cost_nis)} · revenue {money(forecast.expected_revenue_nis)} · margin {money(forecast.contribution_margin_nis)}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(forecast.operational_risk)}>{label(forecast.operational_risk)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Performance & Quality Review" subtitle="ביצועי מפקח, GPS, איכות דוח, מעקב תיקונים, תלונות ומשוב מנהלים.">
            <div className="procedure-list compact-list">
              {data.performance.map((item) => (
                <div className="mini-row" key={item.id ?? item.performance_key}>
                  <span>{item.profiles?.full_name ?? "Inspector"}</span>
                  <strong><StatusBadge tone={toneForScore(Number(item.inspector_performance_score ?? 0))}>{item.inspector_performance_score}/100</StatusBadge></strong>
                  <small>{item.inspections_completed}/{item.inspections_assigned} completed · GPS {item.gps_validation_rate}% · report {item.report_quality_score}</small>
                </div>
              ))}
              {data.quality.map((item) => (
                <div className="mini-row" key={item.id ?? item.review_key}>
                  <span>{label(item.issue_type)}</span>
                  <strong><StatusBadge tone={toneForStatus(item.severity)}>{label(item.severity)}</StatusBadge></strong>
                  <small>{item.quality_task} · due {dateText(item.due_date)}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Training, Certification & Candidate Pipeline" subtitle="הכשרה, מסמכי חובה וגיוס מפקחים לפי אזור לפני סקייל אמיתי.">
            <div className="procedure-list compact-list">
              {data.training.map((item) => (
                <div className="mini-row" key={item.id ?? item.training_key}>
                  <span>{item.module_name}</span>
                  <strong><StatusBadge tone={toneForStatus(item.completion_status)}>{label(item.completion_status)}</StatusBadge></strong>
                  <small>{label(item.module_type)} · {item.trainer ?? "trainer TBD"}</small>
                </div>
              ))}
              {data.certs.map((item) => (
                <div className="mini-row" key={item.id ?? item.certification_key}>
                  <span>{label(item.document_type)}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>{item.notes}</small>
                </div>
              ))}
              {data.candidates.map((item) => (
                <div className="mini-row" key={item.id ?? item.candidate_key}>
                  <span>{item.full_name}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>{item.region ?? "region TBD"} · {item.availability ?? "availability TBD"} · expected {money(item.expected_pay_nis)}</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="SLA, Alerts & Audit Trail" subtitle="SLA לפיקוח חודשי, תלונה, דחוף, דוח ותיקון; התראות למפקחים ולאדמין; audit trail.">
            <div className="procedure-list compact-list">
              {data.slas.map((sla) => (
                <div className="mini-row" key={sla.id ?? sla.sla_key}>
                  <span>{label(sla.sla_type)}</span>
                  <strong><StatusBadge tone={toneForStatus(sla.status)}>{sla.target_hours}h</StatusBadge></strong>
                  <small>{sla.current_breaches} breaches · {sla.notes}</small>
                </div>
              ))}
              {data.alerts.map((alert) => (
                <div className="mini-row" key={alert.id ?? alert.alert_key}>
                  <span>{label(alert.alert_type)}</span>
                  <strong><StatusBadge tone={toneForStatus(alert.severity)}>{label(alert.severity)}</StatusBadge></strong>
                  <small>{label(alert.recipient_type)} · {alert.message}</small>
                </div>
              ))}
              {data.audit.slice(0, 8).map((event) => (
                <div className="mini-row" key={event.id}>
                  <span>{event.event_title}</span>
                  <strong><StatusBadge tone="default">{label(event.event_type)}</StatusBadge></strong>
                  <small>{dateText(event.created_at)}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Workforce Risk Register & Assistant Questions" subtitle="סיכוני כוח אדם, כיסוי, איכות, עלות, SLA, פרטיות, תפעול ומוניטין.">
          <section className="grid cols-2 dashboard-panels">
            <div className="procedure-list compact-list">
              {data.risks.map((risk) => (
                <div className="mini-row" key={risk.id ?? risk.risk_key}>
                  <span>{risk.risk}</span>
                  <strong><StatusBadge tone={toneForStatus(risk.severity)}>{label(risk.severity)}</StatusBadge></strong>
                  <small>{label(risk.category)} · {risk.mitigation}</small>
                </div>
              ))}
            </div>
            <div className="camera-infra-list">
              {[
                ["How many inspectors do we need for 100 kindergartens?", `${forecast100.inspectors_needed ?? "TBD"} inspectors in baseline forecast`],
                ["Which region lacks coverage?", "Use regional assignments and coverage alerts"],
                ["What is inspector cost per kindergarten?", "Compare compensation and financial forecasts"],
                ["Which inspections are overdue?", `${overdueInspections} overdue in workforce plan`],
                ["Which inspectors need training?", "Review training and certification tables"]
              ].map(([question, answer]) => (
                <article className="camera-infra-row" key={question}>
                  <div>
                    <strong>{question}</strong>
                    <span>{answer}</span>
                  </div>
                  <StatusBadge tone="warn">stored data only</StatusBadge>
                </article>
              ))}
            </div>
          </section>
        </CleanSection>

        <CleanSection title="Workforce Actions" subtitle="פעולות ניהול מרכזיות לכוח הפיקוח.">
          <section className="grid cols-4">
            <ActionCard icon={ClipboardCheck} title="National inspections" text="Monthly, overdue and follow-up inspections" href="/dashboard/admin/national-inspections" />
            <ActionCard icon={UsersRound} title="Inspectors" text="Directory and active assignments" href="/dashboard/admin/inspectors" />
            <ActionCard icon={CalendarClock} title="Due inspections" text="Monthly planning and SLA" href="/dashboard/admin/inspections/due" />
            <ActionCard icon={AlertTriangle} title="Late inspections" text={`${overdueInspections} overdue`} href="/dashboard/admin/inspections/late" tone={overdueInspections ? "bad" : "good"} />
            <ActionCard icon={MapPinned} title="Regional coverage" text="City and regional assignment gaps" href="/dashboard/admin/regional-scale-up" />
            <ActionCard icon={Route} title="Route readiness" text="Google Maps, Waze and Mapbox future-ready" href="/dashboard/admin/inspection-workforce" />
            <ActionCard icon={Banknote} title="Financial planning" text={`${money(forecast100.inspector_cost_nis)} cost at 100`} href="/dashboard/admin/scale-100" />
            <ActionCard icon={GraduationCap} title="Training" text={`${data.training.length} modules tracked`} href="/dashboard/admin/inspection-workforce" />
            <ActionCard icon={FileCheck2} title="Certification" text={`${data.certs.length} document checks`} href="/dashboard/admin/inspection-workforce" />
            <ActionCard icon={UserCheck} title="Recruitment" text={`${data.candidates.length} candidates`} href="/dashboard/admin/inspection-workforce" />
            <ActionCard icon={ShieldCheck} title="Privacy boundaries" text="Inspector access stays scoped" href="/dashboard/admin/security-review" />
            <ActionCard icon={BriefcaseBusiness} title="100-garden scale" text="Workforce feeds scale readiness" href="/dashboard/admin/scale-100" />
            <ActionCard icon={TrendingUp} title="Reports" text="National workforce report" href="/dashboard/admin/reports" />
          </section>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
