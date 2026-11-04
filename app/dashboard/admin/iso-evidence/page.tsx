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
    const safeQuery = async (index: number, run: () => PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>) => {
      try {
        const query = await run();
        logSupabaseError(`iso evidence query ${index}`, query.error);
        return { data: query.error ? [] : query.data ?? [], available: !query.error };
      } catch (error) {
        logSupabaseError(`iso evidence query ${index}`, error);
        return { data: [], available: false };
      }
    };
    const [evidenceRes, soaRes, policiesRes, proceduresRes, suppliersRes, accessReviewsRes, gapsRes, actionsRes, binderRes, scheduleRes, controlsRes, risksRes] = await Promise.all([
      safeQuery(0, () => supabase.from("iso_evidence_items" as any).select("*").order("standard").order("control_id").limit(300)),
      safeQuery(1, () => supabase.from("iso_statement_of_applicability" as any).select("*").order("control_id").limit(200)),
      safeQuery(2, () => supabase.from("security_policies_repository" as any).select("*").order("policy_type").limit(200)),
      safeQuery(3, () => supabase.from("security_procedures" as any).select("*").order("procedure_type").limit(200)),
      safeQuery(4, () => supabase.from("iso_supplier_evidence" as any).select("*").order("risk_rating").limit(120)),
      safeQuery(5, () => supabase.from("iso_access_reviews" as any).select("*").order("next_review_due_at", { ascending: true }).limit(120)),
      safeQuery(6, () => supabase.from("iso_gap_analysis_items" as any).select("*").order("severity").order("due_date", { ascending: true }).limit(200)),
      safeQuery(7, () => supabase.from("iso_corrective_actions" as any).select("*").order("due_date", { ascending: true }).limit(200)),
      safeQuery(8, () => supabase.from("iso_audit_binder_exports" as any).select("*").order("created_at", { ascending: false }).limit(80)),
      safeQuery(9, () => supabase.from("iso_review_schedule_items" as any).select("*").order("next_review_due_at", { ascending: true }).limit(120)),
      safeQuery(10, () => supabase.from("iso_controls" as any).select("*").order("standard").order("control_id").limit(300)),
      safeQuery(11, () => supabase.from("risk_register" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(150))
    ]);
    const available = [evidenceRes, soaRes, policiesRes, proceduresRes, suppliersRes, accessReviewsRes, gapsRes, actionsRes, binderRes, scheduleRes, controlsRes, risksRes].map((query) => query.available);
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
      available,
      queryError: available.some((value) => !value)
        ? "חלק מנתוני ISO Evidence אינם זמינים כרגע."
        : null
    };
  }, {
    available: Array<boolean>(12).fill(false),
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
  const known = (...indices: number[]) => indices.every((index) => result.data.available[index]);
  const unavailable = "לא זמין";
  const readinessKnown = known(0, 1, 2, 3, 4, 5, 6, 8, 9);
  const standardKnown = known(0, 6);
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
        badge={readinessKnown ? `${summary.auditReadinessScore}/100` : unavailable}
        badgeTone={readinessKnown ? toneForScore(summary.auditReadinessScore) : "default"}
        actions={<Link className="button secondary" href="/dashboard/admin/iso-readiness">מוכנות ISO</Link>}
      >
        <div className="mini-stack">
          <span>Evidence {known(0) ? result.data.evidence.length : unavailable}</span>
          <span>Policies {known(2) ? result.data.policies.length : unavailable}</span>
          <span>Open gaps {known(6) ? summary.openGaps.length : unavailable}</span>
        </div>
      </PremiumDashboardHero>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <RoleMetricCard label="ISO 27001 Evidence" value={standardKnown ? `${summary.iso27001Evidence}%` : unavailable} hint="Security evidence" tone={standardKnown ? toneForScore(summary.iso27001Evidence) : "default"} />
        <RoleMetricCard label="ISO 27017 Evidence" value={standardKnown ? `${summary.iso27017Evidence}%` : unavailable} hint="Cloud evidence" tone={standardKnown ? toneForScore(summary.iso27017Evidence) : "default"} />
        <RoleMetricCard label="ISO 27701 Evidence" value={standardKnown ? `${summary.iso27701Evidence}%` : unavailable} hint="Privacy evidence" tone={standardKnown ? toneForScore(summary.iso27701Evidence) : "default"} />
        <RoleMetricCard label="Approved evidence" value={known(0) ? `${approvedEvidence}/${result.data.evidence.length}` : unavailable} hint="Reviewed or approved" tone={known(0) ? toneForScore(result.data.evidence.length ? (approvedEvidence / result.data.evidence.length) * 100 : 0) : "default"} />
        <RoleMetricCard label="Policy coverage" value={known(2, 3) ? `${summary.policyCoverage}%` : unavailable} hint="Policies and procedures" tone={known(2, 3) ? toneForScore(summary.policyCoverage) : "default"} />
        <RoleMetricCard label="Supplier coverage" value={known(4) ? `${summary.supplierCoverage}%` : unavailable} hint="Security, privacy, contract, DPA" tone={known(4) ? toneForScore(summary.supplierCoverage) : "default"} />
        <RoleMetricCard label="SoA coverage" value={known(1) ? `${summary.soaCoverage}%` : unavailable} hint="Applicability readiness" tone={known(1) ? toneForScore(summary.soaCoverage) : "default"} />
        <RoleMetricCard label="Open actions" value={known(7) ? openActions.length : unavailable} hint="Corrective action workflow" tone={known(7) ? openActions.length ? "warn" : "good" : "default"} />
      </section>

      <CleanSection title="מה חסר לביקורת חיצונית" subtitle="פערים שמונעים audit pack נקי ומוכן למסירה.">
        {known(0, 6) && summary.openGaps.length === 0 && summary.missingEvidence.length === 0 ? <EmptyState title="אין פערי ISO פתוחים" text="כאשר ראיה, מדיניות או בקרת ספק יחסר, הוא יופיע כאן." /> : (
          <div className="procedure-list compact-list">
            {!known(6) ? <EmptyState title="נתוני הפערים אינם זמינים" /> : summary.openGaps.slice(0, 8).map((gap: any) => (
              <div className="mini-row" key={gap.id}>
                <span>{gap.gap_description}</span>
                <strong><StatusBadge tone={toneForStatus(gap.severity)}>{gap.severity}</StatusBadge></strong>
                <small>{standardLabel(gap.standard)} · {gap.remediation_plan}</small>
              </div>
            ))}
            {!known(0) ? <EmptyState title="נתוני הראיות החסרות אינם זמינים" /> : summary.missingEvidence.slice(0, 6).map((item: any) => (
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
          {!known(0) ? <EmptyState title="נתוני הראיות אינם זמינים" /> : result.data.evidence.length === 0 ? <EmptyState title="אין ראיות להצגה" /> : (
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
          {!known(1) ? <EmptyState title="נתוני SoA אינם זמינים" /> : result.data.soa.length === 0 ? <EmptyState title="SoA עדיין לא מולא" /> : (
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
            {!known(2) ? <EmptyState title="נתוני המדיניות אינם זמינים" /> : policiesNeedingReview.slice(0, 8).map((policy: any) => (
              <div className="mini-row" key={policy.id}>
                <span>{policy.title}</span>
                <strong><StatusBadge tone={toneForStatus(policy.approval_status ?? policy.status)}>{policy.approval_status ?? policy.status}</StatusBadge></strong>
                <small>{policy.policy_type} · v{policy.version}</small>
              </div>
            ))}
            {!known(3) ? <EmptyState title="נתוני הנהלים אינם זמינים" /> : result.data.procedures.slice(0, 6).map((procedure: any) => (
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
            {!known(4) ? <EmptyState title="נתוני הספקים אינם זמינים" /> : result.data.suppliers.map((supplier: any) => (
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
            {!known(5) ? <EmptyState title="נתוני סקירות הגישה אינם זמינים" /> : result.data.accessReviews.map((review: any) => (
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
          {!known(7) ? <EmptyState title="נתוני פעולות התיקון אינם זמינים" /> : openActions.length === 0 ? <EmptyState title="אין פעולות תיקון פתוחות" /> : (
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
            {!known(9) ? <EmptyState title="נתוני מועדי הסקירה אינם זמינים" /> : result.data.reviewSchedule.map((item: any) => (
              <div className="mini-row" key={item.id}>
                <span>{item.title}</span>
                <strong><StatusBadge tone={toneForStatus(item.status)}>{item.status}</StatusBadge></strong>
                <small>{item.review_area} · {item.cadence} · {formatDate(item.next_review_due_at)}</small>
              </div>
            ))}
            {known(9) && overdueReviews.length ? <div className="mini-row"><span>Reviews requiring attention</span><strong className="pill bad">{overdueReviews.length}</strong><small>יש להשלים לפני audit חיצוני</small></div> : null}
          </div>
        </CleanSection>
      </section>

      <CleanSection title="Audit binder readiness" subtitle="הכנה לייצוא עתידי של PDF/ZIP/CSV בלי מידע רגיש או סודות.">
        <div className="premium-action-grid">
          <ActionCard title="Policies" text={known(2) ? `${result.data.policies.length} policy records` : unavailable} href="/dashboard/admin/policies" icon={BookOpenCheck} />
          <ActionCard title="Procedures" text={known(3) ? `${result.data.procedures.length} procedure records` : unavailable} href="/dashboard/admin/iso-evidence" icon={ClipboardCheck} />
          <ActionCard title="Risk register" text={known(11, 6) ? `${result.data.risks.length + result.data.gaps.length} risk and gap records` : unavailable} href="/dashboard/admin/security" icon={FileWarning} />
          <ActionCard title="Cloud assets" text={known(10) ? `${result.data.controls.length} mapped controls` : unavailable} href="/dashboard/admin/iso-readiness" icon={Cloud} />
          <ActionCard title="Suppliers" text={known(4) ? `${highSupplierRisk.length} high-risk reviews incomplete` : unavailable} href="/dashboard/admin/iso-evidence" icon={Boxes} />
          <ActionCard title="Audit logs" text="Immutable, medical, camera and document logs" href="/dashboard/admin/audit-logs" icon={Archive} />
          <ActionCard title="Privacy evidence" text="DPIA, rights, retention and AI boundaries" href="/dashboard/admin/privacy-rights" icon={ShieldCheck} />
          <ActionCard title="Binder exports" text={known(8) ? `${summary.binderReadiness}% readiness` : unavailable} href="/dashboard/admin/iso-evidence" icon={FileArchive} />
        </div>
      </CleanSection>

      <section className="grid cols-4 dashboard-panels">
        <article className="card compact-card"><FileCheck2 /><h3>No certificate claim</h3><p>המערכת מכינה ראיות בלבד. הסמכה ניתנת רק על ידי גורם חיצוני.</p></article>
        <article className="card compact-card"><Scale /><h3>Auditor safe view</h3><p>בעתיד: גישה מוגבלת למטא-דאטה, בלי ילדים, רפואי, מצלמות, סודות או תשלומים.</p></article>
        <article className="card compact-card"><UserCheck /><h3>Access evidence</h3><p>סקירת הרשאות תקופתית, משתמשים בעלי הרשאות, חשבונות לא פעילים וביטולים.</p></article>
        <article className="card compact-card"><FileWarning /><h3>Open gaps</h3><p>{known(6) ? summary.openGaps.length : unavailable} פערים פתוחים דורשים בעלים, מועד, ראיה ואימות.</p></article>
      </section>
    </DashboardShell>
  );
}
