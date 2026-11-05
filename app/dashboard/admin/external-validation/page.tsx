import Link from "next/link";
import { AppWindow, BadgeCheck, Banknote, Camera, ClipboardCheck, FileArchive, Gavel, LockKeyhole, ShieldAlert, ShieldCheck, UserCheck } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, any>;
type Tone = "default" | "good" | "warn" | "bad";

async function safeQuery<T>(label: string, run: () => any) {
  try {
    const result = (await run()) as { data: T[] | null; error: any };
    logSupabaseError(label, result.error);
    return { data: result.error ? [] : result.data ?? [], available: !result.error };
  } catch (error) {
    logSupabaseError(label, error);
    return { data: [] as T[], available: false };
  }
}

function label(value?: string | null) {
  return String(value ?? "לא ידוע").replaceAll("_", " ");
}

function scoreTone(score: number): Tone {
  if (score >= 82) return "good";
  if (score >= 58) return "warn";
  return "bad";
}

function toneForStatus(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["approved", "approved_with_conditions", "verified", "closed", "completed", "mitigated", "ready", "received", "issued"].includes(value)) return "good";
  if (["planned", "open", "assigned", "under_review", "sent_to_reviewer", "changes_requested", "under_retest", "re_review", "in_progress", "pending", "not_started"].includes(value)) return "warn";
  if (["critical", "high", "blocked", "rejected", "failed", "not_issued"].includes(value)) return "bad";
  return "default";
}

export default async function ExternalValidationPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("external validation", async () => {
    const supabase = await createClient();
    const [scores, reviewers, scopes, findings, legalItems, securityFindings, pt, isoConsultant, isoCertification, evidence, providerEvidence, launchBlockers, mobileSubmission] = await Promise.all([
      safeQuery<Row>("external validation scores", () => supabase.from("external_validation_scores" as any).select("*").order("calculated_at", { ascending: false }).limit(1)),
      safeQuery<Row>("external reviewers", () => supabase.from("external_reviewers" as any).select("*").order("reviewer_type").limit(80)),
      safeQuery<Row>("external review scopes", () => supabase.from("external_review_scopes" as any).select("*").order("scope_type").limit(120)),
      safeQuery<Row>("external validation findings", () => supabase.from("external_validation_findings" as any).select("*").order("severity").order("due_date").limit(120)),
      safeQuery<Row>("legal review items", () => supabase.from("legal_review_items" as any).select("*").order("risk_level").order("target_review_date").limit(80)),
      safeQuery<Row>("external security findings", () => supabase.from("external_security_findings" as any).select("*").order("severity").order("due_date").limit(80)),
      safeQuery<Row>("penetration test execution", () => supabase.from("penetration_test_execution" as any).select("*").order("created_at", { ascending: false }).limit(20)),
      safeQuery<Row>("iso consultant execution", () => supabase.from("iso_consultant_execution" as any).select("*").order("created_at", { ascending: false }).limit(20)),
      safeQuery<Row>("iso certification execution", () => supabase.from("iso_certification_execution" as any).select("*").order("created_at", { ascending: false }).limit(20)),
      safeQuery<Row>("external evidence vault", () => supabase.from("external_evidence_vault" as any).select("*").order("evidence_type").limit(80)),
      safeQuery<Row>("provider compliance evidence", () => supabase.from("provider_compliance_evidence" as any).select("*").order("provider_type").limit(80)),
      safeQuery<Row>("launch blockers", () => supabase.from("launch_blockers" as any).select("*").order("severity").limit(80)),
      safeQuery<Row>("mobile submission", () => supabase.from("mobile_store_submission_status" as any).select("*").order("platform").limit(40))
    ]);
    return {
      scores: scores.data, reviewers: reviewers.data, scopes: scopes.data, findings: findings.data,
      legalItems: legalItems.data, securityFindings: securityFindings.data, pt: pt.data,
      isoConsultant: isoConsultant.data, isoCertification: isoCertification.data,
      evidence: evidence.data, providerEvidence: providerEvidence.data,
      launchBlockers: launchBlockers.data, mobileSubmission: mobileSubmission.data,
      availability: [scores, reviewers, scopes, findings, legalItems, securityFindings, pt, isoConsultant, isoCertification, evidence, providerEvidence, launchBlockers, mobileSubmission].map((source) => source.available)
    };
  }, {
    scores: [] as Row[],
    reviewers: [] as Row[],
    scopes: [] as Row[],
    findings: [] as Row[],
    legalItems: [] as Row[],
    securityFindings: [] as Row[],
    pt: [] as Row[],
    isoConsultant: [] as Row[],
    isoCertification: [] as Row[],
    evidence: [] as Row[],
    providerEvidence: [] as Row[],
    launchBlockers: [] as Row[],
    mobileSubmission: [] as Row[],
    availability: Array<boolean>(13).fill(false)
  });

  const data = result.data;
  const available = data.availability;
  const unavailable = "לא זמין";
  const queryError = result.error ?? (available.some((value) => !value) ? "לא ניתן לטעון חלק מהנתונים כרגע" : null);
  const score = data.scores[0] ?? {};
  const overall = Number(score.external_validation_score ?? 0);
  const openFindings = data.findings.filter((item) => !["verified", "closed", "accepted_risk"].includes(String(item.status)));
  const criticalBlockers = openFindings.filter((item) => item.blocks_launch || ["critical", "high"].includes(String(item.severity))).length;
  const legalOpen = data.legalItems.filter((item) => !["approved", "approved_with_conditions", "closed", "accepted_risk"].includes(String(item.current_status))).length;
  const securityOpen = data.securityFindings.filter((item) => !["verified", "closed", "accepted_risk"].includes(String(item.status))).length;
  const activeReviewers = data.reviewers.filter((item) => ["engaged", "active", "waiting_feedback"].includes(String(item.status))).length;
  const evidenceReceived = data.evidence.filter((item) => ["received", "reviewed", "approved"].includes(String(item.status))).length;
  const launchCritical = data.launchBlockers.filter((item) => String(item.status) === "open" && String(item.severity) === "critical").length;
  const blockers = Array.isArray(score.blockers) ? score.blockers : [];

  return (
    <DashboardShell role="admin" title="External Validation">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="External Validation Execution"
          title="אימות חיצוני לפני Production מלא"
          subtitle="מרכז אחד לניהול עורכי דין, פרטיות, מצלמות, AI, בדיקת חדירה, ISO, חנויות מובייל, תשלומים וספקים. זה לא אישור משפטי, לא ISO ולא בדיקת חדירה בפועל."
          badge={available[0] ? `${overall}/100` : unavailable}
          badgeTone={available[0] ? scoreTone(overall) : "default"}
          actions={<><Link className="button primary" href="/dashboard/admin/legal-review">Legal review</Link><Link className="button secondary" href="/dashboard/admin/security-review">Security review</Link></>}
        >
          <div className="setup-checklist">
            <span>No ISO certification claim</span>
            <span>No legal approval claim</span>
            <span>No real PT by Codex</span>
            <span>External professionals required</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={queryError} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="Validation score" value={available[0] ? `${overall}/100` : unavailable} hint={available[0] ? label(score.launch_recommendation) : unavailable} tone={available[0] ? scoreTone(overall) : "default"} />
          <RoleMetricCard label="Reviewers" value={available[1] ? `${activeReviewers}/${data.reviewers.length}` : unavailable} hint="engaged / total" tone={available[1] ? activeReviewers ? "good" : "warn" : "default"} />
          <RoleMetricCard label="Open findings" value={available[3] ? openFindings.length : unavailable} hint={available[3] ? `${criticalBlockers} launch blockers` : unavailable} tone={available[3] ? criticalBlockers ? "bad" : "warn" : "default"} />
          <RoleMetricCard label="Legal open" value={available[4] ? legalOpen : unavailable} hint="review items" tone={available[4] ? legalOpen ? "warn" : "good" : "default"} />
          <RoleMetricCard label="Security open" value={available[5] ? securityOpen : unavailable} hint="PT findings" tone={available[5] ? securityOpen ? "bad" : "good" : "default"} />
          <RoleMetricCard label="ISO readiness" value={available[0] ? `${score.iso_readiness ?? 0}%` : unavailable} hint="consultant/cert body" tone={available[0] ? scoreTone(Number(score.iso_readiness ?? 0)) : "default"} />
          <RoleMetricCard label="Evidence vault" value={available[9] ? `${evidenceReceived}/${data.evidence.length}` : unavailable} hint="reports and approvals" tone={available[9] ? evidenceReceived ? "good" : "warn" : "default"} />
          <RoleMetricCard label="Critical blockers" value={available[11] ? launchCritical : unavailable} hint="launch readiness" tone={available[11] ? launchCritical ? "bad" : "good" : "default"} />
        </section>

        <CleanSection title="External Blockers" subtitle="חסמים שלא ניתן לפתור פנימית בלבד.">
          {!available[0] ? <EmptyState title="נתוני החסמים החיצוניים לא זמינים" text="לא ניתן לטעון את הנתונים כרגע." /> : blockers.length ? (
            <div className="procedure-list compact-list">
              {blockers.map((blocker: string) => (
                <div className="mini-row" key={blocker}>
                  <span>{blocker}</span>
                  <strong><StatusBadge tone="bad">external</StatusBadge></strong>
                  <small>דורש איש מקצוע או גוף חיצוני מוסמך.</small>
                </div>
              ))}
            </div>
          ) : <EmptyState title="אין חסמים חיצוניים רשומים" />}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Reviewers Registry" subtitle="מי בודק מה, ומה סטטוס ההתקשרות.">
            {!available[1] ? <EmptyState title="נתוני הסוקרים לא זמינים" text="לא ניתן לטעון את הנתונים כרגע." /> : <div className="camera-infra-list">
              {data.reviewers.map((reviewer) => (
                <article className="camera-infra-row" key={reviewer.id ?? reviewer.reviewer_key}>
                  <div>
                    <strong>{reviewer.reviewer_name}</strong>
                    <span>{label(reviewer.reviewer_type)} · {reviewer.assigned_scope}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(reviewer.status)}>{label(reviewer.status)}</StatusBadge>
                  <StatusBadge tone="default">{reviewer.findings_count ?? 0} findings</StatusBadge>
                </article>
              ))}
            </div>}
          </CleanSection>

          <CleanSection title="External Review Scopes" subtitle="היקף, החרגות, reviewer וחבילת ראיות.">
            {!available[2] ? <EmptyState title="היקפי הבדיקה לא זמינים" text="לא ניתן לטעון את הנתונים כרגע." /> : <div className="camera-infra-list">
              {data.scopes.map((scope) => (
                <article className="camera-infra-row" key={scope.id ?? scope.scope_key}>
                  <div>
                    <strong>{scope.scope_name}</strong>
                    <span>{scope.evidence_package} · {scope.notes}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(scope.status)}>{label(scope.status)}</StatusBadge>
                </article>
              ))}
            </div>}
          </CleanSection>
        </section>

        <CleanSection title="Unified External Findings" subtitle="Legal, Privacy, Camera, AI, PT, ISO, App Store, Payment and Cloud findings. Critical findings block launch.">
          {!available[3] ? <EmptyState title="הממצאים לא זמינים" text="לא ניתן לטעון את הנתונים כרגע." /> : <div className="communication-template-grid">
            {data.findings.map((finding) => (
              <article className="communication-template-card" key={finding.id ?? finding.finding_key}>
                <div>
                  <strong>{finding.finding_title}</strong>
                  <span>{label(finding.finding_source)} · {finding.description}</span>
                  <small>{finding.recommendation}</small>
                </div>
                <StatusBadge tone={toneForStatus(finding.severity)}>{label(finding.severity)}</StatusBadge>
                <StatusBadge tone={toneForStatus(finding.status)}>{label(finding.status)}</StatusBadge>
              </article>
            ))}
          </div>}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Penetration Test Execution" subtitle="מעקב אחרי PT חיצוני מורשה בלבד. אין בדיקות הרסניות ואין production אמיתי בלי אישור.">
            <div className="procedure-list compact-list">
              {!available[6] ? <EmptyState title="רשומות בדיקת החדירה לא זמינות" text="לא ניתן לטעון את הנתונים כרגע." /> : data.pt.map((item) => (
                <div className="mini-row" key={item.id ?? item.execution_key}>
                  <span>{item.testing_company ?? "TBD"} · {item.environment}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>{item.rules_of_engagement} · remediation {label(item.remediation_status)}</small>
                </div>
              ))}
              {!available[5] ? <EmptyState title="ממצאי האבטחה לא זמינים" text="לא ניתן לטעון את הנתונים כרגע." /> : data.securityFindings.map((item) => (
                <div className="mini-row" key={item.id ?? item.finding_key}>
                  <span>{item.finding_title}</span>
                  <strong><StatusBadge tone={toneForStatus(item.severity)}>{label(item.severity)}</StatusBadge></strong>
                  <small>{item.recommendation}</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="ISO Execution" subtitle="ISO consultant ו-certification body. לא מסמנים certified בלי תעודה רשמית.">
            <div className="procedure-list compact-list">
              {!available[7] ? <EmptyState title="רשומות יועץ ISO לא זמינות" text="לא ניתן לטעון את הנתונים כרגע." /> : data.isoConsultant.map((item) => (
                <div className="mini-row" key={item.id ?? item.execution_key}>
                  <span>{item.iso_consultant ?? "ISO consultant TBD"}</span>
                  <strong><StatusBadge tone={toneForStatus(item.gap_analysis_status)}>{label(item.gap_analysis_status)}</StatusBadge></strong>
                  <small>gaps {item.gaps_found} · evidence {item.evidence_reviewed}</small>
                </div>
              ))}
              {!available[8] ? <EmptyState title="רשומות גוף ההסמכה לא זמינות" text="לא ניתן לטעון את הנתונים כרגע." /> : data.isoCertification.map((item) => (
                <div className="mini-row" key={item.id ?? item.execution_key}>
                  <span>{item.certification_body ?? "Certification body TBD"}</span>
                  <strong><StatusBadge tone={toneForStatus(item.certificate_status)}>{label(item.certificate_status)}</StatusBadge></strong>
                  <small>decision {label(item.certification_decision)} · stage 1 {label(item.stage_1_audit_readiness)}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Provider Compliance Evidence" subtitle="ספקי Email/SMS/WhatsApp/Push/Payments/Invoices/Camera/AI/Cloud.">
            {!available[10] ? <EmptyState title="נתוני ראיות הספקים לא זמינים" text="לא ניתן לטעון את הנתונים כרגע." /> : <div className="camera-infra-list">
              {data.providerEvidence.map((provider) => (
                <article className="camera-infra-row" key={provider.id ?? provider.evidence_key}>
                  <div>
                    <strong>{provider.provider_name}</strong>
                    <span>{provider.notes}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(provider.integration_risk)}>{label(provider.integration_risk)}</StatusBadge>
                  <StatusBadge tone={toneForStatus(provider.security_review_status)}>{label(provider.security_review_status)}</StatusBadge>
                </article>
              ))}
            </div>}
          </CleanSection>

          <CleanSection title="Evidence Vault" subtitle="מטאדאטה לראיות חיצוניות. מסמכים רגישים נשארים פרטיים ומבוקרי גישה.">
            {!available[9] ? <EmptyState title="מטאדאטה הראיות לא זמינה" text="לא ניתן לטעון את הנתונים כרגע." /> : <div className="camera-infra-list">
              {data.evidence.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.evidence_key}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{label(item.evidence_type)} · {item.external_reference ?? "external file pending"}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                  <StatusBadge tone={toneForStatus(item.sensitivity)}>{label(item.sensitivity)}</StatusBadge>
                </article>
              ))}
            </div>}
          </CleanSection>
        </section>

        <CleanSection title="Connected Work Centers" subtitle="המרכז הזה מחבר, לא מחליף, את מסכי הביצוע הקיימים.">
          <section className="grid cols-4">
            <ActionCard icon={Gavel} title="Legal review" text={available[4] ? `${legalOpen} open legal items` : unavailable} href="/dashboard/admin/legal-review" tone={available[4] ? legalOpen ? "warn" : "good" : "default"} />
            <ActionCard icon={Camera} title="Camera review" text={available[0] ? `${score.camera_compliance_review ?? 0}% readiness` : unavailable} href="/dashboard/admin/camera-compliance" />
            <ActionCard icon={ShieldAlert} title="Security review" text={available[5] ? `${securityOpen} open findings` : unavailable} href="/dashboard/admin/security-review" tone={available[5] ? securityOpen ? "bad" : "good" : "default"} />
            <ActionCard icon={BadgeCheck} title="ISO handoff" text={available[0] ? `${score.iso_readiness ?? 0}% ISO readiness` : unavailable} href="/dashboard/admin/iso-certification-handoff" />
            <ActionCard icon={AppWindow} title="App Store review" text={available[0] ? `${score.app_store_readiness ?? 0}% mobile readiness` : unavailable} href="/dashboard/admin/mobile-submission" />
            <ActionCard icon={Banknote} title="Payments" text={available[0] ? `${score.payment_review ?? 0}% payment review` : unavailable} href="/dashboard/admin/provider-production" />
            <ActionCard icon={FileArchive} title="Evidence" text={available[9] ? `${evidenceReceived} received/reviewed` : unavailable} href="/dashboard/admin/iso-evidence" />
            <ActionCard icon={UserCheck} title="Launch blockers" text={available[11] ? `${launchCritical} critical open` : unavailable} href="/dashboard/admin/launch-readiness" tone={available[11] ? launchCritical ? "bad" : "good" : "default"} />
            <ActionCard icon={LockKeyhole} title="Claims guardrails" text="No ISO/legal/security claims before approval" href="/dashboard/admin/final-compliance-review" />
            <ActionCard icon={ShieldCheck} title="Capability matrix" text="Sensitive AI remains restricted" href="/dashboard/admin/capability-legal-review" />
            <ActionCard icon={ClipboardCheck} title="Master QA" text="Remediation and verification" href="/dashboard/admin/master-qa" />
          </section>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
