import Link from "next/link";
import { Banknote, BriefcaseBusiness, CalendarClock, FileSignature, Handshake, LineChart, PackageCheck, RefreshCcw, Target, UsersRound } from "lucide-react";
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

function toneForStatus(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["active", "active_customer", "approved", "signed", "completed", "commercial_ready", "met", "ready_for_review", "sent", "accepted"].includes(value)) return "good";
  if (["preparing", "commercial_ready_with_gaps", "onboarding", "proposal_sent", "demo_scheduled", "demo_completed", "qualified", "draft", "under_review", "in_progress", "open", "pending"].includes(value)) return "warn";
  if (["blocked", "lost", "cancelled", "expired", "rejected", "critical", "high", "failed", "past_due"].includes(value)) return "bad";
  return "default";
}

function scoreTone(score: number): Tone {
  if (score >= 82) return "good";
  if (score >= 58) return "warn";
  return "bad";
}

function dateText(value?: string | null) {
  if (!value) return "לא נקבע";
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function pct(done: number, total: number) {
  return total ? Math.round((done / total) * 100) : 0;
}

export default async function CommercialLaunchPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("commercial launch", async () => {
    const supabase = await createClient();
    const [readiness, pricing, packages, pipeline, demos, offers, contracts, slas, onboarding, handoffs, collateral, scripts, objections, referrals, renewals, churn, forecast, metrics, tasks, checklist] = await Promise.all([
      safeQuery<Row>("commercial launch readiness", () => supabase.from("commercial_launch_readiness_scores" as any).select("*").order("calculated_at", { ascending: false }).limit(1)),
      safeQuery<Row>("commercial pricing models", () => supabase.from("commercial_pricing_models" as any).select("*").eq("active", true).order("effective_from", { ascending: false }).limit(5)),
      safeQuery<Row>("commercial packages", () => supabase.from("commercial_packages" as any).select("*").order("created_at", { ascending: false }).limit(20)),
      safeQuery<Row>("commercial sales pipeline", () => supabase.from("commercial_sales_pipeline" as any).select("*").order("next_follow_up_at", { ascending: true }).limit(120)),
      safeQuery<Row>("commercial demo lifecycle", () => supabase.from("commercial_demo_lifecycle" as any).select("*, commercial_sales_pipeline(kindergarten_name, stage)").order("demo_date", { ascending: true }).limit(80)),
      safeQuery<Row>("commercial offers", () => supabase.from("commercial_offer_summaries" as any).select("*, commercial_sales_pipeline(kindergarten_name, stage)").order("created_at", { ascending: false }).limit(80)),
      safeQuery<Row>("commercial contracts", () => supabase.from("commercial_contract_readiness" as any).select("*, commercial_sales_pipeline(kindergarten_name, stage)").order("created_at", { ascending: false }).limit(80)),
      safeQuery<Row>("commercial sla readiness", () => supabase.from("commercial_sla_readiness" as any).select("*").order("area").limit(80)),
      safeQuery<Row>("commercial onboarding checklists", () => supabase.from("commercial_onboarding_checklists" as any).select("*").order("owner_role").limit(120)),
      safeQuery<Row>("customer success handoffs", () => supabase.from("customer_success_handoffs" as any).select("*, commercial_sales_pipeline(kindergarten_name, stage)").order("created_at", { ascending: false }).limit(80)),
      safeQuery<Row>("launch collateral", () => supabase.from("launch_collateral_items" as any).select("*").order("collateral_type").limit(80)),
      safeQuery<Row>("demo script library", () => supabase.from("demo_script_library" as any).select("*").order("audience").limit(80)),
      safeQuery<Row>("commercial objections", () => supabase.from("commercial_objection_library" as any).select("*").order("category").limit(80)),
      safeQuery<Row>("referral program readiness", () => supabase.from("referral_program_readiness" as any).select("*").order("referral_type").limit(20)),
      safeQuery<Row>("commercial renewal operations", () => supabase.from("commercial_renewal_operations" as any).select("*").order("renewal_date", { ascending: true }).limit(80)),
      safeQuery<Row>("commercial churn risk", () => supabase.from("commercial_churn_risk_signals" as any).select("*").order("risk_level").order("created_at", { ascending: false }).limit(80)),
      safeQuery<Row>("revenue forecast", () => supabase.from("revenue_forecast_snapshots" as any).select("*").order("calculated_at", { ascending: false }).limit(1)),
      safeQuery<Row>("commercial metrics", () => supabase.from("commercial_metrics_snapshots" as any).select("*").order("calculated_at", { ascending: false }).limit(1)),
      safeQuery<Row>("commercial sales tasks", () => supabase.from("commercial_sales_tasks" as any).select("*, commercial_sales_pipeline(kindergarten_name, stage)").order("due_at", { ascending: true }).limit(80)),
      safeQuery<Row>("commercial launch checklist", () => supabase.from("commercial_launch_checklist" as any).select("*").order("category").order("checklist_key").limit(120))
    ]);
    return { readiness, pricing, packages, pipeline, demos, offers, contracts, slas, onboarding, handoffs, collateral, scripts, objections, referrals, renewals, churn, forecast, metrics, tasks, checklist };
  }, {
    readiness: [] as Row[],
    pricing: [] as Row[],
    packages: [] as Row[],
    pipeline: [] as Row[],
    demos: [] as Row[],
    offers: [] as Row[],
    contracts: [] as Row[],
    slas: [] as Row[],
    onboarding: [] as Row[],
    handoffs: [] as Row[],
    collateral: [] as Row[],
    scripts: [] as Row[],
    objections: [] as Row[],
    referrals: [] as Row[],
    renewals: [] as Row[],
    churn: [] as Row[],
    forecast: [] as Row[],
    metrics: [] as Row[],
    tasks: [] as Row[],
    checklist: [] as Row[]
  });

  const data = result.data;
  const score = data.readiness[0];
  const pricing = data.pricing[0];
  const forecast = data.forecast[0];
  const metrics = data.metrics[0];
  const commercialScore = Number(score?.commercial_readiness_score ?? 0);
  const activePipeline = data.pipeline.filter((item) => !["active_customer", "lost", "deferred"].includes(String(item.stage)));
  const signedCustomers = data.contracts.filter((item) => item.status === "signed").length;
  const pilotCustomers = data.pipeline.filter((item) => String(item.notes ?? "").toLowerCase().includes("pilot") || item.stage === "onboarding").length;
  const trialCustomers = data.pipeline.filter((item) => item.stage === "approved").length;
  const pipelineValue = data.pipeline.reduce((sum, item) => sum + Number(item.estimated_annual_revenue_nis ?? 0), 0);
  const weightedMrr = data.pipeline.reduce((sum, item) => sum + (Number(item.estimated_monthly_revenue_nis ?? 0) * Number(item.probability ?? 0)) / 100, 0);
  const renewalRisks = data.renewals.filter((item) => ["high", "critical"].includes(String(item.renewal_risk_level))).length + data.churn.filter((item) => ["high", "critical"].includes(String(item.risk_level))).length;
  const completedChecklist = data.checklist.filter((item) => ["completed", "not_required"].includes(String(item.status))).length;
  const checklistPct = pct(completedChecklist, data.checklist.length);
  const openTasks = data.tasks.filter((task) => !["completed", "cancelled"].includes(String(task.status)));
  const contractReady = data.contracts.filter((contract) => ["signed", "sent", "under_review"].includes(String(contract.status))).length;

  return (
    <DashboardShell role="admin" title="Commercial Launch">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Commercial Launch Readiness"
          title="מוכנות מסחרית ומכירות"
          subtitle="מרכז ניהול למכירה אמיתית: תמחור, pipeline, דמואים, הצעות, חוזים, SLA, העברה ל־Customer Success, חידושים ותחזית הכנסות."
          badge={`${commercialScore}/100`}
          badgeTone={scoreTone(commercialScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/growth">Growth</Link><Link className="button secondary" href="/dashboard/admin/customer-success">Customer Success</Link></>}
        >
          <div className="setup-checklist">
            <span>Gan Batuach Standard</span>
            <span>{money(pricing?.base_price_nis ?? 800)} בסיס</span>
            <span>{money(pricing?.additional_class_price_nis ?? 200)} כיתה נוספת</span>
            <span>חוזים: DRAFT FOR LEGAL REVIEW</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="Commercial score" value={`${commercialScore}/100`} hint={label(score?.status)} tone={scoreTone(commercialScore)} />
          <RoleMetricCard label="Pipeline active" value={activePipeline.length} hint={`${data.pipeline.length} opportunities`} tone={activePipeline.length ? "warn" : "good"} />
          <RoleMetricCard label="Signed customers" value={signedCustomers} hint="contracts signed" tone={signedCustomers ? "good" : "warn"} />
          <RoleMetricCard label="Pilot customers" value={pilotCustomers} hint="handoff/onboarding" tone={pilotCustomers ? "warn" : "default"} />
          <RoleMetricCard label="Trial customers" value={trialCustomers} hint="approved, not active" tone={trialCustomers ? "warn" : "default"} />
          <RoleMetricCard label="Projected MRR" value={money(forecast?.projected_mrr_nis ?? weightedMrr)} hint={`Pipeline ${money(forecast?.pipeline_value_nis ?? pipelineValue)}`} tone="good" />
          <RoleMetricCard label="Renewal risks" value={renewalRisks} hint="high/critical" tone={renewalRisks ? "bad" : "good"} />
          <RoleMetricCard label="Launch checklist" value={`${checklistPct}%`} hint={`${completedChecklist}/${data.checklist.length}`} tone={scoreTone(checklistPct)} />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Pricing Model Center" subtitle="תמחור Gan Batuach Standard, בלי add-ons מפוצלים לערך המרכזי.">
            <article className="card procedure-card">
              <div>
                <StatusBadge tone="good">{pricing?.package_name ?? "Gan Batuach Standard"}</StatusBadge>
                <h3>{money(pricing?.base_price_nis ?? 800)} לחודש</h3>
                <p>כולל כיתה/קבוצת גיל אחת, מנוי שנתי בתשלום חודשי. כל כיתה או קבוצת גיל נוספת: {money(pricing?.additional_class_price_nis ?? 200)} לחודש.</p>
                <small>{pricing?.pilot_pricing_notes ?? "Pilot pricing requires admin approval."}</small>
              </div>
              <div className="procedure-meta">
                <StatusBadge tone="warn">annual commitment</StatusBadge>
                <StatusBadge tone="default">ILS</StatusBadge>
              </div>
            </article>
          </CleanSection>

          <CleanSection title="Package Positioning" subtitle="חבילה אחת ברורה: ניהול, אמון, ציות, תשלומים, מוכנות מצלמות ו־AI.">
            <div className="camera-infra-list">
              {data.packages.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.package_key}>
                  <div>
                    <strong>{item.package_name}</strong>
                    <span>{item.positioning}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Sales Opportunity Dashboard" subtitle="הזדמנויות פתוחות, הכנסה צפויה, הסתברות ופעולת מעקב.">
          {data.pipeline.length === 0 ? <EmptyState title="אין הזדמנויות מסחריות" text="Pipeline מסחרי יופיע כאן לאחר הפעלת המיגרציה או יצירת לידים." /> : (
            <div className="procedure-list">
              {data.pipeline.map((item) => (
                <article className="card procedure-card" key={item.id ?? item.opportunity_key}>
                  <div>
                    <StatusBadge tone={toneForStatus(item.stage)}>{label(item.stage)}</StatusBadge>
                    <h3>{item.kindergarten_name}</h3>
                    <p>{label(item.lead_source)} · {item.city ?? "עיר לא צוינה"} · follow-up {dateText(item.next_follow_up_at)}</p>
                    <small>{item.contact_name ?? "איש קשר לא צוין"} · {item.estimated_classes} כיתות · probability {item.probability}%</small>
                  </div>
                  <div className="procedure-meta">
                    <strong>{money(item.estimated_monthly_revenue_nis)}</strong>
                    <span>{money(item.estimated_annual_revenue_nis)} ARR</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Demo / Proposal / Contract" subtitle="דמו, הצעה וחוזה נשארים מוכנות מסחרית עד אישור משפטי.">
            <div className="camera-infra-list">
              <article className="camera-infra-row"><div><strong>Demo lifecycle</strong><span>{data.demos.length} demos · follow-up and outcome tracking</span></div><StatusBadge tone="warn">{data.demos.filter((demo) => demo.status === "follow_up_needed").length} follow-up</StatusBadge></article>
              <article className="camera-infra-row"><div><strong>Offer generator</strong><span>{data.offers.length} PDF-ready offer summaries</span></div><StatusBadge tone="good">{data.offers.filter((offer) => offer.pdf_ready).length} ready</StatusBadge></article>
              <article className="camera-infra-row"><div><strong>Contract readiness</strong><span>{data.contracts.length} contracts · legal review required</span></div><StatusBadge tone={contractReady ? "warn" : "bad"}>{contractReady} in motion</StatusBadge></article>
              <article className="camera-infra-row"><div><strong>SLA readiness</strong><span>{data.slas.length} service scope and limitations records</span></div><StatusBadge tone="warn">review</StatusBadge></article>
            </div>
          </CleanSection>

          <CleanSection title="Revenue Forecasting" subtitle="MRR, ARR, pipeline value and conversion assumptions.">
            <div className="camera-infra-kpis">
              <RoleMetricCard label="Current MRR" value={money(forecast?.current_mrr_nis)} />
              <RoleMetricCard label="Projected MRR" value={money(forecast?.projected_mrr_nis ?? weightedMrr)} tone="good" />
              <RoleMetricCard label="Current ARR" value={money(forecast?.current_arr_nis)} />
              <RoleMetricCard label="Projected ARR" value={money(forecast?.projected_arr_nis ?? weightedMrr * 12)} tone="good" />
            </div>
            <p className="help-text">ARPK: {money(metrics?.average_revenue_per_kindergarten_nis ?? 800)} · average classes {metrics?.average_classes_per_kindergarten ?? 1}</p>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Customer Success Handoff" subtitle="מה עובר ממכירות לקליטה ותמיכה אחרי סגירה.">
            <div className="camera-infra-list">
              {data.handoffs.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.handoff_key}>
                  <div>
                    <strong>{item.commercial_sales_pipeline?.kindergarten_name ?? item.handoff_key}</strong>
                    <span>{item.known_risks}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Onboarding & Sales Tasks" subtitle="משימות follow-up, הצעה, תשלום, קליטה, הדרכה וחידוש.">
            <div className="camera-infra-list">
              {openTasks.map((task) => (
                <article className="camera-infra-row" key={task.id ?? task.task_key}>
                  <div>
                    <strong>{task.title}</strong>
                    <span>{label(task.task_type)} · due {dateText(task.due_at)}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(task.priority)}>{label(task.priority)}</StatusBadge>
                  <StatusBadge tone={toneForStatus(task.status)}>{label(task.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Collateral, Demo Scripts & Objections" subtitle="חומרי מכירה פנימיים בשפה פשוטה ולא טכנית.">
            <div className="premium-action-grid">
              <ActionCard icon={BriefcaseBusiness} title="Collateral" text={`${data.collateral.length} sales and onboarding items`} href="/dashboard/admin/docs/COMMERCIAL_LAUNCH_READINESS_AND_SALES_OPERATIONS_PLATFORM" />
              <ActionCard icon={Target} title="Demo scripts" text={`${data.scripts.length} audience scripts`} href="/dashboard/admin/docs/COMMERCIAL_LAUNCH_READINESS_AND_SALES_OPERATIONS_PLATFORM" />
              <ActionCard icon={Handshake} title="Objections" text={`${data.objections.length} clear answers`} href="/dashboard/admin/docs/COMMERCIAL_LAUNCH_READINESS_AND_SALES_OPERATIONS_PLATFORM" />
              <ActionCard icon={PackageCheck} title="Referral readiness" text={`${data.referrals.length} referral tracks, not active by default`} href="/dashboard/admin/growth" />
            </div>
          </CleanSection>

          <CleanSection title="Renewal & Churn Risk" subtitle="חידושים, בריאות לקוח וסיכוני נטישה לפני launch מסחרי.">
            {data.renewals.length === 0 && data.churn.length === 0 ? <EmptyState title="אין סיכוני חידוש פעילים" text="סיכונים יופיעו לאחר לקוחות משלמים או סימני churn." /> : (
              <div className="camera-infra-list">
                {[...data.renewals, ...data.churn].slice(0, 8).map((item) => (
                  <article className="camera-infra-row" key={item.id ?? item.renewal_key ?? item.signal_key}>
                    <div>
                      <strong>{item.customer_name ?? item.reason}</strong>
                      <span>{item.recommended_action ?? item.reason}</span>
                    </div>
                    <StatusBadge tone={toneForStatus(item.renewal_risk_level ?? item.risk_level)}>{label(item.renewal_risk_level ?? item.risk_level)}</StatusBadge>
                  </article>
                ))}
              </div>
            )}
          </CleanSection>
        </section>

        <CleanSection title="Commercial Launch Checklist" subtitle="מה חייב לעבוד לפני מכירה מסחרית רחבה.">
          <div className="procedure-list">
            {data.checklist.map((item) => (
              <article className="card procedure-card" key={item.id ?? item.checklist_key}>
                <div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                  <h3>{item.title}</h3>
                  <p>{item.evidence_summary}</p>
                  <small>{label(item.category)} · owner {item.owner ?? "TBD"}</small>
                </div>
                <div className="procedure-meta">
                  <StatusBadge tone={item.required ? "warn" : "default"}>{item.required ? "required" : "optional"}</StatusBadge>
                </div>
              </article>
            ))}
          </div>
        </CleanSection>

        <CleanSection title="Commercial AI Assistant Readiness" subtitle="שאלות שהדשבורד יכול לענות עליהן מתוך CRM/growth data בלבד.">
          <div className="premium-action-grid">
            <ActionCard icon={CalendarClock} title="Follow-up today" text={`${openTasks.length} open commercial tasks`} href="/dashboard/admin/commercial-launch" />
            <ActionCard icon={LineChart} title="Projected MRR" text={money(forecast?.projected_mrr_nis ?? weightedMrr)} href="/dashboard/admin/billing" />
            <ActionCard icon={RefreshCcw} title="Renewal risk" text={`${renewalRisks} high/critical risks`} href="/dashboard/admin/customer-success" />
            <ActionCard icon={UsersRound} title="Strongest demand" text="Use parent demand clusters in Growth" href="/dashboard/admin/growth" />
          </div>
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <ActionCard icon={Banknote} title="Billing operations" text="Subscriptions, invoices, payments, discounts and separation ledger." href="/dashboard/admin/billing" />
          <ActionCard icon={FileSignature} title="Legal review" text="Contracts, privacy, DPA and public claims remain legal-review artifacts." href="/dashboard/admin/legal-review" />
        </section>
      </div>
    </DashboardShell>
  );
}
