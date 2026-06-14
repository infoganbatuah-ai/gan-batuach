import Link from "next/link";
import { AlertTriangle, BadgeCheck, Camera, ClipboardCheck, FileWarning, KeyRound, LockKeyhole, Rocket, Scale, ShieldCheck, Video } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildFinalComplianceSummary } from "@/lib/domain/final-compliance-review";

function toneForScore(score: number): "good" | "warn" | "bad" {
  if (score >= 82) return "good";
  if (score >= 62) return "warn";
  return "bad";
}

function toneForStatus(status?: string | null): "good" | "warn" | "bad" | "default" {
  if (["ready", "passed", "approved", "verified", "fixed", "closed", "enabled", "implemented", "production_ready_after_external_review", "pilot_ready"].includes(String(status))) return "good";
  if (["partial", "in_progress", "requires_external_review", "needs_review", "accepted_risk", "pilot_ready_with_blockers"].includes(String(status))) return "warn";
  if (["open", "blocked", "critical", "high", "not_ready", "failed", "missing"].includes(String(status))) return "bad";
  return "default";
}

function recommendationLabel(value: string) {
  if (value === "production_ready_after_external_review") return "Production ready after external review";
  if (value === "pilot_ready") return "Pilot ready";
  if (value === "pilot_ready_with_blockers") return "Pilot ready with blockers";
  return "Not ready";
}

function yesNo(value: boolean) {
  return value ? "מאושר" : "דורש תיקון";
}

export default async function AdminFinalComplianceReviewPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("final compliance review", async () => {
    const supabase = await createClient();
    const [modesRes, verticalRes, aiCapabilitiesRes, aiReviewsRes, cameraRes, securityRes, privacyRes, retentionRes, holdsRes, mfaRes, auditRes, isoControlsRes, isoEvidenceRes, isoGapsRes, launchScoresRes, launchBlockersRes, finalGapsRes, legalItemsRes, pipelineFindingsRes, scoreRes, cameraAuditRes, storageEvidenceRes] = await Promise.all([
      supabase.from("regulatory_policy_modes" as any).select("*").order("vertical_key"),
      supabase.from("vertical_capability_matrix" as any).select("*").eq("vertical_key", "gan_batuach").order("capability_category").order("capability_name").limit(250),
      supabase.from("ai_vertical_capability_matrix" as any).select("*").eq("vertical_key", "gan_batuach").order("capability_key").limit(180),
      supabase.from("ai_governance_reviews" as any).select("*").order("created_at", { ascending: false }).limit(120),
      supabase.from("camera_compliance_checks" as any).select("*").order("check_area").limit(120),
      supabase.from("security_readiness_checks" as any).select("*").order("category").limit(350),
      supabase.from("privacy_rights_requests" as any).select("*").order("created_at", { ascending: false }).limit(120),
      supabase.from("data_retention_policies" as any).select("*").order("data_category").limit(160),
      supabase.from("legal_holds" as any).select("*").order("created_at", { ascending: false }).limit(120),
      supabase.from("mfa_enforcement_policies" as any).select("*").order("role_key").limit(120),
      supabase.from("audit_event_catalog" as any).select("*").order("category").limit(250),
      supabase.from("iso_controls" as any).select("*").order("standard").limit(250),
      supabase.from("iso_evidence_items" as any).select("*").order("standard").limit(250),
      supabase.from("iso_gap_analysis_items" as any).select("*").order("severity").limit(160),
      supabase.from("production_readiness_score" as any).select("*").order("readiness_area").limit(120),
      supabase.from("launch_blockers" as any).select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("final_compliance_gaps" as any).select("*").order("severity").order("due_date").limit(200),
      supabase.from("legal_review_items" as any).select("*").order("risk_level").order("target_review_date").limit(120),
      supabase.from("security_pipeline_findings" as any).select("*").order("severity").limit(120),
      supabase.from("final_regulatory_readiness_score" as any).select("*").order("created_at", { ascending: false }).limit(1),
      supabase.from("camera_access_audit_trail" as any).select("id,action,status,created_at").order("created_at", { ascending: false }).limit(20),
      supabase.from("iso_evidence_items" as any).select("*").in("evidence_type", ["camera_privacy", "encryption", "audit_log"]).limit(80)
    ]);
    [modesRes, verticalRes, aiCapabilitiesRes, aiReviewsRes, cameraRes, securityRes, privacyRes, retentionRes, holdsRes, mfaRes, auditRes, isoControlsRes, isoEvidenceRes, isoGapsRes, launchScoresRes, launchBlockersRes, finalGapsRes, legalItemsRes, pipelineFindingsRes, scoreRes, cameraAuditRes, storageEvidenceRes].forEach((query, index) => logSupabaseError(`final compliance query ${index}`, (query as any).error));
    const summary = buildFinalComplianceSummary({
      regulatoryModes: modesRes.data ?? [],
      verticalCapabilities: verticalRes.data ?? [],
      aiCapabilities: aiCapabilitiesRes.data ?? [],
      aiGovernanceReviews: aiReviewsRes.data ?? [],
      cameraChecks: cameraRes.data ?? [],
      securityChecks: securityRes.data ?? [],
      privacyRequests: privacyRes.data ?? [],
      retentionPolicies: retentionRes.data ?? [],
      legalHolds: holdsRes.data ?? [],
      mfaPolicies: mfaRes.data ?? [],
      auditCatalog: auditRes.data ?? [],
      isoControls: isoControlsRes.data ?? [],
      isoEvidence: isoEvidenceRes.data ?? [],
      isoGaps: isoGapsRes.data ?? [],
      launchScores: launchScoresRes.data ?? [],
      launchBlockers: launchBlockersRes.data ?? [],
      finalGaps: finalGapsRes.data ?? [],
      legalReviewItems: legalItemsRes.data ?? [],
      securityPipelineFindings: pipelineFindingsRes.data ?? [],
      readinessSnapshot: scoreRes.data?.[0] ?? null
    });
    return {
      modes: modesRes.data ?? [],
      verticalCapabilities: verticalRes.data ?? [],
      aiCapabilities: aiCapabilitiesRes.data ?? [],
      aiReviews: aiReviewsRes.data ?? [],
      cameraChecks: cameraRes.data ?? [],
      securityChecks: securityRes.data ?? [],
      privacyRequests: privacyRes.data ?? [],
      retentionPolicies: retentionRes.data ?? [],
      legalHolds: holdsRes.data ?? [],
      mfaPolicies: mfaRes.data ?? [],
      auditCatalog: auditRes.data ?? [],
      isoControls: isoControlsRes.data ?? [],
      isoEvidence: isoEvidenceRes.data ?? [],
      isoGaps: isoGapsRes.data ?? [],
      launchScores: launchScoresRes.data ?? [],
      launchBlockers: launchBlockersRes.data ?? [],
      finalGaps: finalGapsRes.data ?? [],
      legalItems: legalItemsRes.data ?? [],
      pipelineFindings: pipelineFindingsRes.data ?? [],
      scoreSnapshot: scoreRes.data?.[0] ?? null,
      cameraAudit: cameraAuditRes.data ?? [],
      storageEvidence: storageEvidenceRes.data ?? [],
      summary,
      queryError: [modesRes.error, verticalRes.error, cameraRes.error, securityRes.error, finalGapsRes.error, legalItemsRes.error].some(Boolean)
        ? "חלק מנתוני הסקירה הסופית לא נטענו. ייתכן שמיגרציית Phase 159 או אחת ממיגרציות הרגולציה עדיין לא רצה."
        : null
    };
  }, {
    modes: [] as any[],
    verticalCapabilities: [] as any[],
    aiCapabilities: [] as any[],
    aiReviews: [] as any[],
    cameraChecks: [] as any[],
    securityChecks: [] as any[],
    privacyRequests: [] as any[],
    retentionPolicies: [] as any[],
    legalHolds: [] as any[],
    mfaPolicies: [] as any[],
    auditCatalog: [] as any[],
    isoControls: [] as any[],
    isoEvidence: [] as any[],
    isoGaps: [] as any[],
    launchScores: [] as any[],
    launchBlockers: [] as any[],
    finalGaps: [] as any[],
    legalItems: [] as any[],
    pipelineFindings: [] as any[],
    scoreSnapshot: null as any,
    cameraAudit: [] as any[],
    storageEvidence: [] as any[],
    summary: buildFinalComplianceSummary(),
    queryError: null as string | null
  });

  const { summary } = result.data;
  const openFinalGaps = result.data.finalGaps.filter((gap: any) => !["fixed", "verified", "accepted_risk"].includes(String(gap.status)));
  const productionBlockers = openFinalGaps.filter((gap: any) => gap.blocks_production);
  const restrictedCapabilities = result.data.verticalCapabilities.filter((capability: any) => ["audio_analytics", "speech_recognition", "keyword_detection", "face_recognition", "face_matching", "persistent_child_identity_tracking", "gait_recognition", "soft_biometric_matching", "cross_day_skeleton_identity", "contextual_child_association"].includes(String(capability.capability_key)));
  const allowedCapabilities = result.data.verticalCapabilities.filter((capability: any) => ["pose_estimation", "skeleton_tracking", "skeleton_analytics", "motion_analytics", "motion_anomaly_detection", "fall_detection", "inactivity_detection", "crowding_detection", "restricted_area_detection", "safety_anomaly_detection"].includes(String(capability.capability_key)));
  const auditImplemented = result.data.auditCatalog.filter((event: any) => event.required && event.implemented).length;
  const auditRequired = result.data.auditCatalog.filter((event: any) => event.required).length;
  const auditCoverage = auditRequired ? Math.round((auditImplemented / auditRequired) * 100) : 0;

  return (
    <DashboardShell role="admin" title="Final Compliance Review">
      <PremiumDashboardHero
        eyebrow="Final Internal Review"
        title="סקירת רגולציה, פרטיות, אבטחה והשקה סופית"
        subtitle="בדיקה פנימית אחרונה לפני פיילוט או ייצור. אינה מחליפה ייעוץ משפטי, ISO audit או penetration test."
        badge={`${summary.finalReadinessScore}/100`}
        badgeTone={toneForScore(summary.finalReadinessScore)}
        actions={<Link className="button secondary" href="/dashboard/admin/launch-readiness">Launch readiness</Link>}
      >
        <div className="mini-stack">
          <span>{recommendationLabel(summary.recommendation)}</span>
          <span>Critical blockers {summary.criticalBlockers.length}</span>
          <span>Legal review {summary.legalReviewItems.length}</span>
        </div>
      </PremiumDashboardHero>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <RoleMetricCard label="Regulatory" value={`${summary.regulatoryScore}%`} hint="Gan Batuach Israel mode" tone={toneForScore(summary.regulatoryScore)} />
        <RoleMetricCard label="Privacy" value={`${summary.privacyScore}%`} hint="Rights, retention, legal holds" tone={toneForScore(summary.privacyScore)} />
        <RoleMetricCard label="Security" value={`${summary.securityScore}%`} hint="MFA, RLS, audit, encryption" tone={toneForScore(summary.securityScore)} />
        <RoleMetricCard label="Camera" value={`${summary.cameraScore}%`} hint="Tokens, logs, privacy" tone={toneForScore(summary.cameraScore)} />
        <RoleMetricCard label="AI governance" value={`${summary.aiGovernanceScore}%`} hint="Human review and restrictions" tone={toneForScore(summary.aiGovernanceScore)} />
        <RoleMetricCard label="ISO" value={`${summary.isoScore}%`} hint="27001, 27017, 27701" tone={toneForScore(summary.isoScore)} />
        <RoleMetricCard label="Launch" value={`${summary.launchScore}%`} hint="Production validation" tone={toneForScore(summary.launchScore)} />
        <RoleMetricCard label="Audit coverage" value={`${auditCoverage}%`} hint={`${auditImplemented}/${auditRequired} events`} tone={toneForScore(auditCoverage)} />
      </section>

      <CleanSection title="החלטת מוכנות" subtitle="המלצה פנימית שמרנית לפי חסמים, legal review וגאפי ייצור.">
        <div className="procedure-list compact-list">
          <div className="mini-row">
            <span>Recommendation</span>
            <strong><StatusBadge tone={toneForStatus(summary.recommendation)}>{recommendationLabel(summary.recommendation)}</StatusBadge></strong>
            <small>Production requires external legal, ISO, cloud security, payment and penetration-test review.</small>
          </div>
          <div className="mini-row">
            <span>GAN_BATUACH_ISRAEL_MODE</span>
            <strong><StatusBadge tone={summary.ganBatuachIsraelModeEnabled ? "good" : "bad"}>{yesNo(summary.ganBatuachIsraelModeEnabled)}</StatusBadge></strong>
            <small>Audio, face recognition and biometric child identification must remain disabled or legal-review only.</small>
          </div>
          <div className="mini-row">
            <span>Restricted capabilities</span>
            <strong><StatusBadge tone={summary.restrictedCapabilitiesOk ? "good" : "bad"}>{yesNo(summary.restrictedCapabilitiesOk)}</StatusBadge></strong>
            <small>Audio, speech, keyword, face, gait, soft biometric and cross-day identity checks.</small>
          </div>
          <div className="mini-row">
            <span>Allowed AI capabilities</span>
            <strong><StatusBadge tone={summary.allowedCapabilitiesHumanReviewed ? "good" : "bad"}>{yesNo(summary.allowedCapabilitiesHumanReviewed)}</StatusBadge></strong>
            <small>Pose, skeleton, motion, fall/inactivity/crowding/restricted-area signals require human review.</small>
          </div>
        </div>
      </CleanSection>

      <section className="grid cols-2 dashboard-panels">
        <CleanSection title="Critical blockers" subtitle="חסמים קריטיים מונעים פיילוט עד סגירה או החלטה פורמלית.">
          {summary.criticalBlockers.length === 0 ? <EmptyState title="אין critical blockers פתוחים" /> : (
            <div className="procedure-list compact-list">
              {summary.criticalBlockers.slice(0, 10).map((gap: any) => (
                <div className="mini-row" key={gap.id ?? gap.gap_key}>
                  <span>{gap.gap_title ?? gap.title ?? "Launch blocker"}</span>
                  <strong><StatusBadge tone="bad">{gap.severity ?? gap.status}</StatusBadge></strong>
                  <small>{gap.remediation_plan ?? gap.description ?? gap.result_summary}</small>
                </div>
              ))}
            </div>
          )}
        </CleanSection>
        <CleanSection title="Legal review items" subtitle="נושאים שאסור להפוך לייצור לפני סקירה חיצונית.">
          {summary.legalReviewItems.length === 0 ? <EmptyState title="אין legal review פתוח" /> : (
            <div className="procedure-list compact-list">
              {summary.legalReviewItems.map((item: any) => (
                <div className="mini-row" key={item.id}>
                  <span>{item.item_title}</span>
                  <strong><StatusBadge tone={toneForStatus(item.risk_level)}>{item.risk_level}</StatusBadge></strong>
                  <small>{item.affected_module} · {item.required_external_review} · {item.legal_question}</small>
                </div>
              ))}
            </div>
          )}
        </CleanSection>
      </section>

      <section className="grid cols-3 dashboard-panels">
        <CleanSection title="Gan Batuach capability policy" subtitle="בדיקת יכולות מותרות/מוגבלות לפי Israel Mode.">
          <div className="procedure-list compact-list">
            {restrictedCapabilities.slice(0, 10).map((capability: any) => (
              <div className="mini-row" key={capability.id}>
                <span>{capability.capability_name}</span>
                <strong><StatusBadge tone={["disabled", "legal_review_required"].includes(String(capability.capability_status)) ? "good" : "bad"}>{capability.capability_status}</StatusBadge></strong>
                <small>{capability.legal_status} · parent visible {String(capability.parent_visible_allowed)}</small>
              </div>
            ))}
            {restrictedCapabilities.length === 0 ? <EmptyState title="אין רשומות restricted להצגה" /> : null}
          </div>
        </CleanSection>
        <CleanSection title="Allowed AI with review" subtitle="יכולות מותרות רק כזיהוי/המלצה, ללא החלטות אוטומטיות.">
          <div className="procedure-list compact-list">
            {allowedCapabilities.slice(0, 10).map((capability: any) => (
              <div className="mini-row" key={capability.id}>
                <span>{capability.capability_name}</span>
                <strong><StatusBadge tone={capability.human_review_required ? "good" : "bad"}>{capability.human_review_required ? "human review" : "missing review"}</StatusBadge></strong>
                <small>{capability.capability_status} · parent visible {String(capability.parent_visible_allowed)}</small>
              </div>
            ))}
            {allowedCapabilities.length === 0 ? <EmptyState title="אין רשומות allowed להצגה" /> : null}
          </div>
        </CleanSection>
        <CleanSection title="Camera compliance" subtitle="אין RTSP ישיר, אין סודות בדפדפן, token קצר, child checked-in ושעות צפייה.">
          <div className="procedure-list compact-list">
            {result.data.cameraChecks.slice(0, 9).map((check: any) => (
              <div className="mini-row" key={check.id}>
                <span>{check.title}</span>
                <strong><StatusBadge tone={toneForStatus(check.status)}>{check.status}</StatusBadge></strong>
                <small>{check.check_area} · {check.readiness_score}/100</small>
              </div>
            ))}
          </div>
        </CleanSection>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <CleanSection title="Final compliance gaps" subtitle="גאפים פתוחים לפי תחום, חומרה וחסימת פיילוט/ייצור.">
          {openFinalGaps.length === 0 ? <EmptyState title="אין גאפים פתוחים" /> : (
            <div className="procedure-list compact-list">
              {openFinalGaps.slice(0, 14).map((gap: any) => (
                <div className="mini-row" key={gap.id}>
                  <span>{gap.gap_title}</span>
                  <strong><StatusBadge tone={toneForStatus(gap.severity)}>{gap.severity}</StatusBadge></strong>
                  <small>{gap.gap_area} · {gap.status} · {gap.blocks_pilot ? "blocks pilot" : gap.blocks_production ? "blocks production" : "tracked"}</small>
                </div>
              ))}
            </div>
          )}
        </CleanSection>
        <CleanSection title="ISO and launch gaps" subtitle="פערי ISO, CI/CD, branch protection ובדיקות חיצוניות.">
          <div className="procedure-list compact-list">
            {summary.isoGaps.slice(0, 8).map((gap: any) => (
              <div className="mini-row" key={gap.id}>
                <span>{gap.gap_description}</span>
                <strong><StatusBadge tone={toneForStatus(gap.severity)}>{gap.severity}</StatusBadge></strong>
                <small>{gap.standard} · {gap.status}</small>
              </div>
            ))}
            {productionBlockers.slice(0, 6).map((gap: any) => (
              <div className="mini-row" key={gap.id}>
                <span>{gap.gap_title}</span>
                <strong><StatusBadge tone="warn">production</StatusBadge></strong>
                <small>{gap.required_evidence}</small>
              </div>
            ))}
          </div>
        </CleanSection>
      </section>

      <CleanSection title="Review checklist for external reviewers" subtitle="מה למסור לעורך דין פרטיות, ISO consultant, penetration tester, cloud reviewer ו-payment/accounting reviewer.">
        <div className="premium-action-grid">
          <ActionCard title="Privacy lawyer" text="AI, cameras, retention, parent visibility" href="/dashboard/admin/regulatory" icon={Scale} />
          <ActionCard title="ISO consultant" text="Evidence pack, SoA, policies, suppliers" href="/dashboard/admin/iso-evidence" icon={BadgeCheck} />
          <ActionCard title="Penetration tester" text="Auth, APIs, uploads, cameras, payments" href="/dashboard/admin/security-pipeline" icon={LockKeyhole} />
          <ActionCard title="Cloud security" text="Vercel, Supabase, GitHub, RLS, storage" href="/dashboard/admin/security" icon={ShieldCheck} />
          <ActionCard title="Camera legal" text="Streaming, watermark, sessions, no RTSP" href="/dashboard/admin/camera-compliance" icon={Video} />
          <ActionCard title="MFA and identity" text={`${result.data.mfaPolicies.length} role policies`} href="/dashboard/admin/identity-security" icon={KeyRound} />
          <ActionCard title="Launch blockers" text={`${summary.criticalBlockers.length} critical`} href="/dashboard/admin/launch-readiness" icon={Rocket} />
          <ActionCard title="Camera audit" text={`${result.data.cameraAudit.length} recent audit rows`} href="/dashboard/admin/audit-logs" icon={Camera} />
        </div>
      </CleanSection>

      <section className="grid cols-4 dashboard-panels">
        <article className="card compact-card"><AlertTriangle /><h3>No certification claim</h3><p>הסקירה היא פנימית בלבד ואינה ISO certificate, legal opinion או penetration-test approval.</p></article>
        <article className="card compact-card"><FileWarning /><h3>Parent boundaries</h3><p>הורים רואים רק מידע מאושר: ילד שלהם, מסמכים מאושרים, עדכונים מאושרים ושידורים מורשים.</p></article>
        <article className="card compact-card"><ClipboardCheck /><h3>Audit coverage</h3><p>נדרש audit לכל צפייה במצלמה, גישה רפואית, הורדה, שינוי תפקיד, AI review ותשלום.</p></article>
        <article className="card compact-card"><ShieldCheck /><h3>Production gate</h3><p>ייצור דורש סגירת critical/high, בדיקות ירוקות וסקירה חיצונית.</p></article>
      </section>
    </DashboardShell>
  );
}
