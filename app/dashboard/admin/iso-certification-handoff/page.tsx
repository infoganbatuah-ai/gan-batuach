import Link from "next/link";
import { BadgeCheck, BriefcaseBusiness, ClipboardCheck, FileArchive, FileCheck2, LockKeyhole, Scale, ShieldCheck, UserCheck } from "lucide-react";
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

function toneForScore(score: number): Tone {
  if (score >= 82) return "good";
  if (score >= 58) return "warn";
  return "bad";
}

function toneForStatus(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["approved", "approved_for_audit", "completed", "ready", "ready_for_audit", "ready_for_consultant", "ready_for_external_reviewer", "ready_for_review", "verified"].includes(value)) return "good";
  if (["deferred", "draft", "in_progress", "needs_changes", "planned", "prepared", "research", "scheduled", "under_review"].includes(value)) return "warn";
  if (["blocked", "critical", "expired", "failed", "high", "missing", "not_started", "open"].includes(value)) return "bad";
  return "default";
}

function formatDate(value?: string | null) {
  if (!value) return "לא נקבע";
  return new Date(value).toLocaleDateString("he-IL");
}

function jsonList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function openCount(rows: Row[]) {
  return rows.filter((row) => !["completed", "verified", "fixed", "approved", "not_applicable"].includes(String(row.status ?? row.review_status))).length;
}

export default async function IsoCertificationHandoffPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("iso certification handoff", async () => {
    const supabase = await createClient();
    const [scores, scopes, stages, packages, binder, soa, risks, treatments, audits, reviews, policies, procedures, reviewerModes, checklists, gaps, timeline, actions, bodies, estimates, guardrails, copyAudit] = await Promise.all([
      safeQuery<Row>("iso external process readiness scores", () => supabase.from("iso_external_process_readiness_scores" as any).select("*").order("calculated_at", { ascending: false }).limit(1)),
      safeQuery<Row>("iso certification scopes", () => supabase.from("iso_certification_scopes" as any).select("*").order("created_at", { ascending: false }).limit(10)),
      safeQuery<Row>("iso certification process stages", () => supabase.from("iso_certification_process_stages" as any).select("*").order("created_at").limit(20)),
      safeQuery<Row>("iso external handoff packages", () => supabase.from("iso_external_handoff_packages" as any).select("*").order("package_type").limit(30)),
      safeQuery<Row>("iso evidence binder finalization", () => supabase.from("iso_evidence_binder_finalization" as any).select("*").order("evidence_category").limit(40)),
      safeQuery<Row>("iso statement of applicability", () => supabase.from("iso_statement_of_applicability" as any).select("*").order("control_id").limit(250)),
      safeQuery<Row>("risk register", () => supabase.from("risk_register" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("risk treatment plan", () => supabase.from("risk_treatment_plan" as any).select("*").order("target_date", { ascending: true }).limit(120)),
      safeQuery<Row>("internal audits", () => supabase.from("internal_audits" as any).select("*").order("audit_date", { ascending: false }).limit(80)),
      safeQuery<Row>("management reviews", () => supabase.from("management_reviews" as any).select("*").order("review_date", { ascending: true }).limit(40)),
      safeQuery<Row>("security policies repository", () => supabase.from("security_policies_repository" as any).select("*").order("policy_type").limit(120)),
      safeQuery<Row>("security procedures", () => supabase.from("security_procedures" as any).select("*").order("procedure_type").limit(120)),
      safeQuery<Row>("iso external reviewer access modes", () => supabase.from("iso_external_reviewer_access_modes" as any).select("*").order("reviewer_type").limit(20)),
      safeQuery<Row>("iso final readiness checklists", () => supabase.from("iso_final_readiness_checklists" as any).select("*").order("standard").order("area").limit(80)),
      safeQuery<Row>("iso certification gaps", () => supabase.from("iso_certification_gaps" as any).select("*").order("severity").order("due_date", { ascending: true }).limit(120)),
      safeQuery<Row>("iso certification timeline", () => supabase.from("iso_certification_timeline" as any).select("*").order("target_date", { ascending: true }).limit(30)),
      safeQuery<Row>("iso external action items", () => supabase.from("iso_external_action_items" as any).select("*").order("due_date", { ascending: true }).limit(60)),
      safeQuery<Row>("iso certification body options", () => supabase.from("iso_certification_body_options" as any).select("*").order("provider_name").limit(20)),
      safeQuery<Row>("iso cost timeline estimates", () => supabase.from("iso_cost_timeline_estimates" as any).select("*").order("created_at", { ascending: false }).limit(5)),
      safeQuery<Row>("iso certification claim guardrails", () => supabase.from("iso_certification_claim_guardrails" as any).select("*").order("guardrail_key").limit(30)),
      safeQuery<Row>("iso public copy audit items", () => supabase.from("iso_public_copy_audit_items" as any).select("*").order("risk_type").limit(40))
    ]);
    return { scores, scopes, stages, packages, binder, soa, risks, treatments, audits, reviews, policies, procedures, reviewerModes, checklists, gaps, timeline, actions, bodies, estimates, guardrails, copyAudit };
  }, {
    scores: [] as Row[],
    scopes: [] as Row[],
    stages: [] as Row[],
    packages: [] as Row[],
    binder: [] as Row[],
    soa: [] as Row[],
    risks: [] as Row[],
    treatments: [] as Row[],
    audits: [] as Row[],
    reviews: [] as Row[],
    policies: [] as Row[],
    procedures: [] as Row[],
    reviewerModes: [] as Row[],
    checklists: [] as Row[],
    gaps: [] as Row[],
    timeline: [] as Row[],
    actions: [] as Row[],
    bodies: [] as Row[],
    estimates: [] as Row[],
    guardrails: [] as Row[],
    copyAudit: [] as Row[]
  });

  const data = result.data;
  const score = data.scores[0] ?? {};
  const overall = Number(score.overall_handoff_score ?? 0);
  const blockers = jsonList(score.remaining_blockers);
  const scope = data.scopes[0];
  const readyBinder = data.binder.filter((item) => ["ready_for_review", "approved"].includes(String(item.status))).length;
  const applicableSoa = data.soa.filter((item) => item.applicable !== false).length;
  const policyReady = data.policies.filter((item) => item.certification_ready || ["approved", "ready_for_review"].includes(String(item.approval_status ?? item.status))).length;
  const procedureReady = data.procedures.filter((item) => item.certification_ready || ["approved", "ready_for_review"].includes(String(item.approval_status ?? item.status))).length;
  const criticalGaps = data.gaps.filter((gap) => ["critical", "high"].includes(String(gap.severity)) && !["verified", "fixed", "accepted_risk"].includes(String(gap.status)));
  const pendingActions = data.actions.filter((action) => !["completed", "deferred"].includes(String(action.status)));

  return (
    <DashboardShell role="admin" title="ISO Certification Handoff">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="ISO External Process Readiness"
          title="מסירת ISO ליועץ, מבקר וגוף הסמכה"
          subtitle="מרכז מסירה חיצוני ל-ISO 27001, ISO 27017 ו-ISO 27701. אין כאן הצהרת הסמכה, ואין חשיפה של ילדים, מידע רפואי, מצלמות, תשלומים או סודות."
          badge={`${overall}/100`}
          badgeTone={toneForScore(overall)}
          actions={<><Link className="button primary" href="/dashboard/admin/iso-evidence">ראיות ISO</Link><Link className="button secondary" href="/dashboard/admin/security-review">בדיקת חדירה</Link></>}
        >
          <div className="setup-checklist">
            <span>Readiness only</span>
            <span>No certification claim</span>
            <span>Metadata-only reviewer access</span>
            <span>External approval required</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="Overall handoff" value={`${overall}/100`} hint={label(score.certification_stage)} tone={toneForScore(overall)} />
          <RoleMetricCard label="ISO 27001" value={`${score.iso_27001_readiness ?? 0}%`} hint="security management" tone={toneForScore(Number(score.iso_27001_readiness ?? 0))} />
          <RoleMetricCard label="ISO 27017" value={`${score.iso_27017_readiness ?? 0}%`} hint="cloud/SaaS controls" tone={toneForScore(Number(score.iso_27017_readiness ?? 0))} />
          <RoleMetricCard label="ISO 27701" value={`${score.iso_27701_readiness ?? 0}%`} hint="privacy controls" tone={toneForScore(Number(score.iso_27701_readiness ?? 0))} />
          <RoleMetricCard label="Evidence" value={`${score.evidence_completeness ?? 0}%`} hint={`${readyBinder}/${data.binder.length} binder categories`} tone={toneForScore(Number(score.evidence_completeness ?? 0))} />
          <RoleMetricCard label="Reviewer access" value={`${score.external_reviewer_status_score ?? 0}%`} hint={`${data.reviewerModes.length} safe modes`} tone={toneForScore(Number(score.external_reviewer_status_score ?? 0))} />
          <RoleMetricCard label="Open gaps" value={openCount(data.gaps)} hint={`${criticalGaps.length} high/critical`} tone={criticalGaps.length ? "bad" : "warn"} />
          <RoleMetricCard label="External actions" value={pendingActions.length} hint="cannot complete internally" tone={pendingActions.length ? "warn" : "good"} />
        </section>

        <CleanSection title="Certification Scope" subtitle="מה נכנס לתהליך ומה נשאר מחוץ לתחום בשלב הזה.">
          {!scope ? <EmptyState title="לא הוגדר scope" /> : (
            <section className="grid cols-2">
              <article className="card compact-card">
                <BadgeCheck />
                <h3>Included</h3>
                <div className="setup-checklist">{jsonList(scope.included_items).map((item) => <span key={item}>{item}</span>)}</div>
              </article>
              <article className="card compact-card">
                <LockKeyhole />
                <h3>Excluded / protected</h3>
                <div className="setup-checklist">{jsonList(scope.excluded_items).map((item) => <span key={item}>{item}</span>)}</div>
              </article>
            </section>
          )}
        </CleanSection>

        {blockers.length > 0 && (
          <CleanSection title="Remaining Blockers" subtitle="צעדים שחייבים להיסגר מול גורמים חיצוניים לפני הסמכה אמיתית.">
            <div className="procedure-list compact-list">
              {blockers.map((blocker) => (
                <div className="mini-row" key={blocker}>
                  <span>{blocker}</span>
                  <strong><StatusBadge tone="bad">external</StatusBadge></strong>
                  <small>לא ניתן להצהיר על הסמכה לפני סגירה חיצונית.</small>
                </div>
              ))}
            </div>
          </CleanSection>
        )}

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Certification Process Stages" subtitle="שלבי תהליך ISO. Certified נשאר חסום עד תעודה חיצונית.">
            <div className="camera-infra-list">
              {data.stages.map((stage) => (
                <article className="camera-infra-row" key={stage.id ?? stage.stage_key}>
                  <div>
                    <strong>{label(stage.stage)}</strong>
                    <span>{stage.notes}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(stage.status)}>{label(stage.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Handoff Packages" subtitle="מסמכים למסירה ליועץ, גוף הסמכה, הנהלה ומבקר.">
            <div className="procedure-list">
              {data.packages.map((pkg) => (
                <article className="card procedure-card" key={pkg.id ?? pkg.package_key}>
                  <div>
                    <StatusBadge tone={toneForStatus(pkg.status)}>{label(pkg.status)}</StatusBadge>
                    <h3>{pkg.title}</h3>
                    <p>{pkg.document_path}</p>
                    <small>{pkg.sensitive_data_excluded ? "Sensitive data excluded" : "Needs review"}</small>
                  </div>
                  <FileArchive />
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Evidence Binder Finalization" subtitle="קטגוריות ראיות לביקורת: access, MFA, audit, encryption, backup, privacy, AI, camera, CI/CD ו-PT.">
          <div className="procedure-list">
            {data.binder.map((item) => (
              <article className="card procedure-card" key={item.id ?? item.binder_key}>
                <div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                  <h3>{label(item.evidence_category)}</h3>
                  <p>{item.notes}</p>
                  <small>{item.approved_count}/{item.evidence_count} approved · {item.missing_count} missing</small>
                </div>
              </article>
            ))}
          </div>
        </CleanSection>

        <section className="grid cols-3 dashboard-panels">
          <CleanSection title="SoA / Controls" subtitle="Statement of Applicability מוכן לסקירת יועץ, לא לאישור סופי.">
            <div className="setup-checklist">
              <span>{applicableSoa} applicable controls</span>
              <span>{data.soa.length} SoA records</span>
              <span>{data.checklists.length} final checklist items</span>
            </div>
            <div className="camera-infra-list">
              {data.checklists.slice(0, 8).map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.checklist_key}>
                  <div><strong>{item.title}</strong><span>{label(item.standard)} · {item.evidence_summary}</span></div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Risk Treatment" subtitle="סיכונים, טיפול, residual risk ואישור קבלה.">
            <div className="setup-checklist">
              <span>{data.risks.length} risks</span>
              <span>{data.treatments.length} treatment plans</span>
              <span>{data.audits.length} internal audits</span>
            </div>
            <div className="camera-infra-list">
              {data.treatments.slice(0, 8).map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.treatment_key}>
                  <div><strong>{label(item.treatment_type)}</strong><span>{item.evidence ?? item.residual_risk}</span></div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Policies / Procedures" subtitle="אישור, owner, גרסה, תוקף וסקירה הבאה.">
            <div className="setup-checklist">
              <span>{policyReady}/{data.policies.length} policies ready</span>
              <span>{procedureReady}/{data.procedures.length} procedures ready</span>
              <span>{data.reviews.length} management reviews</span>
            </div>
            <div className="camera-infra-list">
              {data.reviews.map((review) => (
                <article className="camera-infra-row" key={review.id ?? review.review_key}>
                  <div><strong>{label(review.review_scope)}</strong><span>{formatDate(review.review_date)} · {review.reviewer_name}</span></div>
                  <StatusBadge tone={toneForStatus(review.review_status)}>{label(review.review_status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Safe External Reviewer Modes" subtitle="גישה למטא-דאטה בלבד. אין ילדים, רפואי, raw camera, raw AI, תשלומים, מפתחות או signed URLs.">
            <div className="procedure-list compact-list">
              {data.reviewerModes.map((mode) => (
                <div className="mini-row" key={mode.id ?? mode.mode_key}>
                  <span>{label(mode.reviewer_type)}</span>
                  <strong><StatusBadge tone={toneForStatus(mode.access_status)}>{label(mode.access_status)}</StatusBadge></strong>
                  <small>{mode.export_allowed ? "Export with admin approval" : "View-only readiness"} · blocks {jsonList(mode.blocked_resources).length} sensitive areas</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Gap Remediation Tracker" subtitle="פערי הסמכה, owner, תוכנית תיקון וראיה לאחר תיקון.">
            <div className="procedure-list compact-list">
              {data.gaps.map((gap) => (
                <div className="mini-row" key={gap.id ?? gap.gap_key}>
                  <span>{gap.gap}</span>
                  <strong><StatusBadge tone={toneForStatus(gap.severity)}>{label(gap.severity)}</StatusBadge></strong>
                  <small>{label(gap.standard)} · {label(gap.status)} · {formatDate(gap.due_date)}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Timeline and External Actions" subtitle="מה תלוי ביועץ, גוף הסמכה, עורך דין פרטיות, PT, ספקי ענן ותשלומים.">
            <div className="camera-infra-list">
              {data.timeline.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.timeline_key}>
                  <div><strong>{label(item.stage)}</strong><span>{formatDate(item.target_date)} · {item.notes}</span></div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
              {pendingActions.slice(0, 8).map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.action_key}>
                  <div><strong>{item.title}</strong><span>{label(item.action_type)} · {formatDate(item.due_date)}</span></div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Certification Body Comparison" subtitle="אפשרויות לבדיקה בלבד. אין בחירה אוטומטית ואין תהליך הסמכה פעיל.">
            <div className="procedure-list compact-list">
              {data.bodies.map((body) => (
                <div className="mini-row" key={body.id ?? body.provider_key}>
                  <span>{body.provider_name}</span>
                  <strong><StatusBadge tone={toneForStatus(body.status)}>{label(body.status)}</StatusBadge></strong>
                  <small>{jsonList(body.standards_supported).join(", ")} · {body.estimated_timeline_weeks ? `${body.estimated_timeline_weeks} weeks` : "timeline TBD"}</small>
                </div>
              ))}
              {data.estimates.map((estimate) => (
                <div className="mini-row" key={estimate.id ?? estimate.estimate_key}>
                  <span>Cost and timeline estimate</span>
                  <strong><StatusBadge tone="warn">{label(estimate.confidence_level)}</StatusBadge></strong>
                  <small>{estimate.expected_timeline_weeks ?? "TBD"} weeks · internal work {estimate.internal_work_days ?? "TBD"} days</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Certification Claims Guardrails" subtitle="מונע ניסוחים כמו ISO certified, legally approved או regulator approved לפני אישור חיצוני.">
            <div className="procedure-list compact-list">
              {data.guardrails.map((item) => (
                <div className="mini-row" key={item.id ?? item.guardrail_key}>
                  <span>Forbidden: {item.prohibited_claim}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>Use: {item.allowed_wording}</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Public Website Copy Audit" subtitle="בדיקת claims ציבוריים: הסמכה, חוקיות, AI ובטיחות.">
            <div className="procedure-list compact-list">
              {data.copyAudit.map((item) => (
                <div className="mini-row" key={item.id ?? item.item_key}>
                  <span>{item.risky_claim}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>{item.recommendation}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="External Reviewer Handoff" subtitle="החבילה מוכנה למסירה מבוקרת לגורמים חיצוניים, אבל אישור אמיתי חייב להגיע מהם.">
          <section className="grid cols-4">
            <ActionCard icon={Scale} title="ISO consultant" text="Gap analysis, SoA, risk treatment and evidence review." href="/dashboard/admin/iso-certification-handoff" />
            <ActionCard icon={BadgeCheck} title="Certification body" text="Scope, controls, management system and audit binder readiness." href="/dashboard/admin/iso-evidence" />
            <ActionCard icon={ShieldCheck} title="Security reviewer" text="PT readiness, CI/CD gates, audit logs and cloud controls." href="/dashboard/admin/security-review" />
            <ActionCard icon={UserCheck} title="Privacy reviewer" text="DPIA, retention, AI/camera privacy and data subject rights." href="/dashboard/admin/legal-review" />
          </section>
          <section className="grid cols-4">
            <article className="card compact-card"><FileCheck2 /><h3>No claim</h3><p>ISO readiness בלבד עד תעודה חיצונית.</p></article>
            <article className="card compact-card"><LockKeyhole /><h3>No sensitive data</h3><p>אין child, medical, camera, payment או secrets.</p></article>
            <article className="card compact-card"><ClipboardCheck /><h3>Audited review</h3><p>כל צפייה של reviewer צריכה audit trail.</p></article>
            <article className="card compact-card"><BriefcaseBusiness /><h3>External dependencies</h3><p>יועץ, גוף הסמכה, PT, Legal וספקי ענן.</p></article>
          </section>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
