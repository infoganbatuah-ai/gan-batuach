import Link from "next/link";
import { Archive, BookOpenCheck, Boxes, ClipboardCheck, Cloud, FileArchive, FileCheck2, FileWarning, Scale, ShieldCheck, UserCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildIsoEvidenceSummary } from "@/lib/domain/iso-evidence";

function toneForScore(score: number): "good" | "warn" | "bad" {
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

function toneForStatus(status?: string | null): "good" | "warn" | "bad" | "default" {
  if (["approved", "reviewed", "uploaded", "implemented", "completed", "fixed", "verified", "ready", "signed"].includes(String(status))) return "good";
  if (["draft", "under_review", "needs_review", "in_progress", "planned", "scheduled", "due"].includes(String(status))) return "warn";
  if (["missing", "expired", "blocked", "open", "critical", "high", "overdue", "not_started"].includes(String(status))) return "bad";
  return "default";
}

function standardLabel(value?: string | null) {
  if (value === "iso_27001") return "ISO 27001";
  if (value === "iso_27017") return "ISO 27017";
  if (value === "iso_27701") return "ISO 27701";
  if (value === "combined") return "Combined";
  return value ?? "ISO";
}

function formatDate(value?: string | null) {
  if (!value) return "לא נקבע";
  return new Date(value).toLocaleDateString("he-IL");
}

export default async function AdminIsoEvidencePage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("iso evidence", async () => {
    const supabase = await createClient();
    const [evidenceRes, soaRes, policiesRes, proceduresRes, suppliersRes, accessReviewsRes, gapsRes, actionsRes, binderRes, scheduleRes, controlsRes, risksRes] = await Promise.all([
      supabase.from("iso_evidence_items" as any).select("*").order("standard").order("control_id", { nullsFirst: false }).limit(300),
      supabase.from("iso_statement_of_applicability" as any).select("*").order("control_id").limit(200),
      supabase.from("security_policies_repository" as any).select("*").order("policy_type").limit(200),
      supabase.from("security_procedures" as any).select("*").order("procedure_type").limit(200),
      supabase.from("iso_supplier_evidence" as any).select("*").order("risk_rating").limit(120),
      supabase.from("iso_access_reviews" as any).select("*").order("next_review_due_at", { ascending: true }).limit(120),
      supabase.from("iso_gap_analysis_items" as any).select("*").order("severity").order("due_date", { ascending: true }).limit(200),
      supabase.from("iso_corrective_actions" as any).select("*").order("due_date", { ascending: true }).limit(200),
      supabase.from("iso_audit_binder_exports" as any).select("*").order("created_at", { ascending: false }).limit(80),
      supabase.from("iso_review_schedule_items" as any).select("*").order("next_review_due_at", { ascending: true }).limit(120),
      supabase.from("iso_controls" as any).select("*").order("standard").order("control_id").limit(300),
      supabase.from("risk_register" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(150)
    ]);
    [evidenceRes, soaRes, policiesRes, proceduresRes, suppliersRes, accessReviewsRes, gapsRes, actionsRes, binderRes, scheduleRes, controlsRes, risksRes].forEach((query, index) => logSupabaseError(`iso evidence query ${index}`, (query as any).error));
    const summary = buildIsoEvidenceSummary({
      evidence: evidenceRes.data ?? [],
      soa: soaRes.data ?? [],
      policies: policiesRes.data ?? [],
      procedures: proceduresRes.data ?? [],
      suppliers: suppliersRes.data ?? [],
      accessReviews: accessReviewsRes.data ?? [],
      gaps: gapsRes.data ?? [],
      binderExports: binderRes.data ?? [],
      reviewSchedule: scheduleRes.data ?? []
    });
    return {
      evidence: evidenceRes.data ?? [],
      soa: soaRes.data ?? [],
      policies: policiesRes.data ?? [],
      procedures: proceduresRes.data ?? [],
      suppliers: suppliersRes.data ?? [],
      accessReviews: accessReviewsRes.data ?? [],
      gaps: gapsRes.data ?? [],
      actions: actionsRes.data ?? [],
      binderExports: binderRes.data ?? [],
      reviewSchedule: scheduleRes.data ?? [],
      controls: controlsRes.data ?? [],
      risks: risksRes.data ?? [],
      summary,
      queryError: [evidenceRes.error, soaRes.error, policiesRes.error, proceduresRes.error, suppliersRes.error, accessReviewsRes.error, gapsRes.error, actionsRes.error, binderRes.error, scheduleRes.error].some(Boolean)
        ? "חלק מנתוני ISO Evidence לא נטענו. ייתכן שמיגרציית PHASE 158 עדיין לא הורצה."
        : null
    };
  }, {
    evidence: [] as any[],
    soa: [] as any[],
    policies: [] as any[],
    procedures: [] as any[],
    suppliers: [] as any[],
    accessReviews: [] as any[],
    gaps: [] as any[],
    actions: [] as any[],
    binderExports: [] as any[],
    reviewSchedule: [] as any[],
    controls: [] as any[],
    risks: [] as any[],
    summary: buildIsoEvidenceSummary(),
    queryError: null as string | null
  });

  const { summary } = result.data;
  const approvedEvidence = result.data.evidence.filter((item: any) => item.status === "approved" || item.status === "reviewed").length;
  const openActions = result.data.actions.filter((action: any) => !["verified", "cancelled"].includes(String(action.status)));
  const highSupplierRisk = result.data.suppliers.filter((supplier: any) => ["critical", "high"].includes(String(supplier.risk_rating)) && (supplier.dpa_status !== "signed" || supplier.security_review_status !== "approved"));
  const policiesNeedingReview = result.data.policies.filter((policy: any) => !["approved", "retired"].includes(String(policy.approval_status ?? policy.status)));
  const overdueReviews = result.data.reviewSchedule.filter((item: any) => ["overdue", "blocked"].includes(String(item.status)));

  return (
    <DashboardShell role="admin" title="ISO Evidence">
      <PremiumDashboardHero
        eyebrow="ISO Evidence Pack"
        title="מרכז ראיות, מדיניות ותיק ביקורת ISO"
        subtitle="הכנת ISO 27001, ISO 27017 ו-ISO 27701: ראיות, Statement of Applicability, ספקים, נהלים, גאפים ותיק audit חיצוני."
        badge={`${summary.auditReadinessScore}/100`}
        badgeTone={toneForScore(summary.auditReadinessScore)}
        actions={<Link className="button secondary" href="/dashboard/admin/iso-readiness">מוכנות ISO</Link>}
      >
        <div className="mini-stack">
          <span>Evidence {result.data.evidence.length}</span>
          <span>Policies {result.data.policies.length}</span>
          <span>Open gaps {summary.openGaps.length}</span>
        </div>
      </PremiumDashboardHero>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <RoleMetricCard label="ISO 27001 Evidence" value={`${summary.iso27001Evidence}%`} hint="Security evidence" tone={toneForScore(summary.iso27001Evidence)} />
        <RoleMetricCard label="ISO 27017 Evidence" value={`${summary.iso27017Evidence}%`} hint="Cloud evidence" tone={toneForScore(summary.iso27017Evidence)} />
        <RoleMetricCard label="ISO 27701 Evidence" value={`${summary.iso27701Evidence}%`} hint="Privacy evidence" tone={toneForScore(summary.iso27701Evidence)} />
        <RoleMetricCard label="Approved evidence" value={`${approvedEvidence}/${result.data.evidence.length}`} hint="Reviewed or approved" tone={toneForScore(result.data.evidence.length ? (approvedEvidence / result.data.evidence.length) * 100 : 0)} />
        <RoleMetricCard label="Policy coverage" value={`${summary.policyCoverage}%`} hint="Policies and procedures" tone={toneForScore(summary.policyCoverage)} />
        <RoleMetricCard label="Supplier coverage" value={`${summary.supplierCoverage}%`} hint="Security, privacy, contract, DPA" tone={toneForScore(summary.supplierCoverage)} />
        <RoleMetricCard label="SoA coverage" value={`${summary.soaCoverage}%`} hint="Applicability readiness" tone={toneForScore(summary.soaCoverage)} />
        <RoleMetricCard label="Open actions" value={openActions.length} hint="Corrective action workflow" tone={openActions.length ? "warn" : "good"} />
      </section>

      <CleanSection title="מה חסר לביקורת חיצונית" subtitle="פערים שמונעים audit pack נקי ומוכן למסירה.">
        {summary.openGaps.length === 0 && summary.missingEvidence.length === 0 ? <EmptyState title="אין פערי ISO פתוחים" text="כאשר ראיה, מדיניות או בקרת ספק יחסר, הוא יופיע כאן." /> : (
          <div className="procedure-list compact-list">
            {summary.openGaps.slice(0, 8).map((gap: any) => (
              <div className="mini-row" key={gap.id}>
                <span>{gap.gap_description}</span>
                <strong><StatusBadge tone={toneForStatus(gap.severity)}>{gap.severity}</StatusBadge></strong>
                <small>{standardLabel(gap.standard)} · {gap.remediation_plan}</small>
              </div>
            ))}
            {summary.missingEvidence.slice(0, 6).map((item: any) => (
              <div className="mini-row" key={item.id}>
                <span>{item.title}</span>
                <strong><StatusBadge tone={toneForStatus(item.status)}>{item.status}</StatusBadge></strong>
                <small>{standardLabel(item.standard)} · {item.notes ?? "נדרשת ראיה פורמלית"}</small>
              </div>
            ))}
          </div>
        )}
      </CleanSection>

      <section className="grid cols-2 dashboard-panels">
        <CleanSection title="מאגר ראיות ISO" subtitle="מטא-דאטה בלבד. אין סודות, מידע רפואי, raw camera או פרטי ילדים בתיק audit.">
          {result.data.evidence.length === 0 ? <EmptyState title="אין ראיות להצגה" /> : (
            <div className="procedure-list compact-list">
              {result.data.evidence.slice(0, 12).map((item: any) => (
                <div className="mini-row" key={item.id}>
                  <span>{item.title}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{item.status}</StatusBadge></strong>
                  <small>{standardLabel(item.standard)} · {item.evidence_type} · {item.sensitivity}</small>
                </div>
              ))}
            </div>
          )}
        </CleanSection>
        <CleanSection title="Statement of Applicability" subtitle="מיפוי בקרות, תחולתן, הצדקה וקישור לראיות.">
          {result.data.soa.length === 0 ? <EmptyState title="SoA עדיין לא מולא" /> : (
            <div className="procedure-list compact-list">
              {result.data.soa.map((item: any) => (
                <div className="mini-row" key={item.id}>
                  <span>{item.control_id} · {item.control_title}</span>
                  <strong><StatusBadge tone={toneForStatus(item.implementation_status)}>{item.implementation_status}</StatusBadge></strong>
                  <small>{item.applicable ? "Applicable" : "Not applicable"} · Review {formatDate(item.next_review_date)}</small>
                </div>
              ))}
            </div>
          )}
        </CleanSection>
      </section>

      <section className="grid cols-3 dashboard-panels">
        <CleanSection title="מדיניות ונהלים" subtitle="Repository פורמלי למדיניות, גרסאות, אישור וסקירה.">
          <div className="procedure-list compact-list">
            {policiesNeedingReview.slice(0, 8).map((policy: any) => (
              <div className="mini-row" key={policy.id}>
                <span>{policy.title}</span>
                <strong><StatusBadge tone={toneForStatus(policy.approval_status ?? policy.status)}>{policy.approval_status ?? policy.status}</StatusBadge></strong>
                <small>{policy.policy_type} · v{policy.version}</small>
              </div>
            ))}
            {result.data.procedures.slice(0, 6).map((procedure: any) => (
              <div className="mini-row" key={procedure.id}>
                <span>{procedure.title}</span>
                <strong><StatusBadge tone={toneForStatus(procedure.status)}>{procedure.status}</StatusBadge></strong>
                <small>{procedure.procedure_type} · {procedure.related_policy_key ?? "policy"}</small>
              </div>
            ))}
          </div>
        </CleanSection>
        <CleanSection title="ספקים וענן" subtitle="Supabase, Vercel, GitHub, הודעות, תשלומים, מצלמות ו-AI.">
          <div className="procedure-list compact-list">
            {result.data.suppliers.map((supplier: any) => (
              <div className="mini-row" key={supplier.id}>
                <span>{supplier.supplier_name}</span>
                <strong><StatusBadge tone={toneForStatus(supplier.risk_rating)}>{supplier.risk_rating}</StatusBadge></strong>
                <small>Security {supplier.security_review_status} · DPA {supplier.dpa_status}</small>
              </div>
            ))}
          </div>
        </CleanSection>
        <CleanSection title="Access reviews" subtitle="ראיות לסקירת משתמשים, הרשאות וחשבונות לא פעילים.">
          <div className="procedure-list compact-list">
            {result.data.accessReviews.map((review: any) => (
              <div className="mini-row" key={review.id}>
                <span>{review.scope}</span>
                <strong><StatusBadge tone={toneForStatus(review.review_status)}>{review.review_status}</StatusBadge></strong>
                <small>Due {formatDate(review.next_review_due_at)} · Revoked {review.revoked_access_count ?? 0}</small>
              </div>
            ))}
          </div>
        </CleanSection>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <CleanSection title="Corrective actions" subtitle="Gap → owner → evidence → review → verified.">
          {openActions.length === 0 ? <EmptyState title="אין פעולות תיקון פתוחות" /> : (
            <div className="procedure-list compact-list">
              {openActions.slice(0, 12).map((action: any) => (
                <div className="mini-row" key={action.id}>
                  <span>{action.title}</span>
                  <strong><StatusBadge tone={toneForStatus(action.status)}>{action.status}</StatusBadge></strong>
                  <small>{action.owner_role} · Due {formatDate(action.due_date)}</small>
                </div>
              ))}
            </div>
          )}
        </CleanSection>
        <CleanSection title="Review schedule" subtitle="מחזורי סקירה למדיניות, ספקים, גישה, גיבוי, פרטיות ו-AI.">
          <div className="procedure-list compact-list">
            {result.data.reviewSchedule.map((item: any) => (
              <div className="mini-row" key={item.id}>
                <span>{item.title}</span>
                <strong><StatusBadge tone={toneForStatus(item.status)}>{item.status}</StatusBadge></strong>
                <small>{item.review_area} · {item.cadence} · {formatDate(item.next_review_due_at)}</small>
              </div>
            ))}
            {overdueReviews.length ? <div className="mini-row"><span>Reviews requiring attention</span><strong className="pill bad">{overdueReviews.length}</strong><small>יש להשלים לפני audit חיצוני</small></div> : null}
          </div>
        </CleanSection>
      </section>

      <CleanSection title="Audit binder readiness" subtitle="הכנה לייצוא עתידי של PDF/ZIP/CSV בלי מידע רגיש או סודות.">
        <div className="premium-action-grid">
          <ActionCard title="Policies" text={`${result.data.policies.length} policy records`} href="/dashboard/admin/policies" icon={BookOpenCheck} />
          <ActionCard title="Procedures" text={`${result.data.procedures.length} procedure records`} href="/dashboard/admin/iso-evidence" icon={ClipboardCheck} />
          <ActionCard title="Risk register" text={`${result.data.risks.length + result.data.gaps.length} risk and gap records`} href="/dashboard/admin/security" icon={FileWarning} />
          <ActionCard title="Cloud assets" text={`${result.data.controls.length} mapped controls`} href="/dashboard/admin/iso-readiness" icon={Cloud} />
          <ActionCard title="Suppliers" text={`${highSupplierRisk.length} high-risk reviews incomplete`} href="/dashboard/admin/iso-evidence" icon={Boxes} />
          <ActionCard title="Audit logs" text="Immutable, medical, camera and document logs" href="/dashboard/admin/audit-logs" icon={Archive} />
          <ActionCard title="Privacy evidence" text="DPIA, rights, retention and AI boundaries" href="/dashboard/admin/privacy-rights" icon={ShieldCheck} />
          <ActionCard title="Binder exports" text={`${summary.binderReadiness}% readiness`} href="/dashboard/admin/iso-evidence" icon={FileArchive} />
        </div>
      </CleanSection>

      <section className="grid cols-4 dashboard-panels">
        <article className="card compact-card"><FileCheck2 /><h3>No certificate claim</h3><p>המערכת מכינה ראיות בלבד. הסמכה ניתנת רק על ידי גורם חיצוני.</p></article>
        <article className="card compact-card"><Scale /><h3>Auditor safe view</h3><p>בעתיד: גישה מוגבלת למטא-דאטה, בלי ילדים, רפואי, מצלמות, סודות או תשלומים.</p></article>
        <article className="card compact-card"><UserCheck /><h3>Access evidence</h3><p>סקירת הרשאות תקופתית, משתמשים בעלי הרשאות, חשבונות לא פעילים וביטולים.</p></article>
        <article className="card compact-card"><FileWarning /><h3>Open gaps</h3><p>{summary.openGaps.length} פערים פתוחים דורשים בעלים, מועד, ראיה ואימות.</p></article>
      </section>
    </DashboardShell>
  );
}
