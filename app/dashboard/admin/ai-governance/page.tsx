import Link from "next/link";
import { BrainCircuit, ClipboardCheck, Eye, FileCheck2, Gavel, GitBranch, Scale, ShieldCheck, UserCheck } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, any>;
type Tone = "default" | "good" | "warn" | "bad";

function average(rows: Row[], field = "score") {
  const values = rows.map((row) => Number(row[field] ?? 0)).filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function scoreTone(score: number): Tone {
  if (score >= 82) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

function statusTone(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["approved", "approved_with_restrictions", "ready", "passed", "mitigated", "allowed", "production"].includes(value)) return "good";
  if (["pending", "in_review", "needs_changes", "needs_review", "restricted", "legal_review_required", "draft", "testing"].includes(value)) return "warn";
  if (["rejected", "blocked", "disabled", "failed", "expired"].includes(value)) return "bad";
  return "default";
}

function label(status?: string | null) {
  const labels: Record<string, string> = {
    approved: "מאושר",
    approved_with_restrictions: "מאושר בהגבלות",
    pending: "ממתין",
    in_review: "בבדיקה",
    needs_changes: "דורש תיקון",
    rejected: "נדחה",
    allowed: "מותר",
    disabled: "כבוי",
    restricted: "מוגבל",
    legal_review_required: "בדיקה משפטית",
    mitigated: "טופל",
    needs_review: "דורש בדיקה"
  };
  return labels[String(status ?? "")] ?? status ?? "לא ידוע";
}

function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("he-IL") : "לא נקבע";
}

async function safeQuery<T>(label: string, run: () => any) {
  try {
    const result = await run() as { data: T[] | null; error: any };
    logSupabaseError(label, result.error);
    return result.error ? [] : result.data ?? [];
  } catch (error) {
    logSupabaseError(label, error);
    return [];
  }
}

export default async function AdminAiGovernancePage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("ai governance", async () => {
    const supabase = await createClient();
    const [scores, dpias, capabilities, explainability, decisionAudit, privacyImpact, ethics, models, deployments, reviews, verticalMatrix, parentVisibility] = await Promise.all([
      safeQuery<Row>("responsible ai scores", () => supabase.from("responsible_ai_scores" as any).select("*").order("score_date", { ascending: false }).limit(40)),
      safeQuery<Row>("ai dpia assessments", () => supabase.from("ai_dpia_assessments" as any).select("*").order("updated_at", { ascending: false }).limit(120)),
      safeQuery<Row>("ai capabilities", () => supabase.from("ai_capabilities" as any).select("*").order("risk_classification").order("capability_name").limit(160)),
      safeQuery<Row>("ai explainability records", () => supabase.from("ai_explainability_records" as any).select("*").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("ai decision audit trail", () => supabase.from("ai_decision_audit_trail" as any).select("*").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("ai privacy impact registry", () => supabase.from("ai_privacy_impact_registry" as any).select("*").order("updated_at", { ascending: false }).limit(120)),
      safeQuery<Row>("ai ethics reviews", () => supabase.from("ai_ethics_reviews" as any).select("*").order("updated_at", { ascending: false }).limit(120)),
      safeQuery<Row>("ai models governance", () => supabase.from("ai_models" as any).select("id,model_key,model_name,category,lifecycle_status,deployment_status,human_approval_required,automatic_promotion_allowed,explainability_level,accuracy,updated_at").order("updated_at", { ascending: false }).limit(120)),
      safeQuery<Row>("ai model deployments governance", () => supabase.from("ai_model_deployments" as any).select("*").order("created_at", { ascending: false }).limit(80)),
      safeQuery<Row>("ai governance reviews", () => supabase.from("ai_governance_reviews" as any).select("*").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("vertical capability matrix", () => supabase.from("vertical_capability_matrix" as any).select("*").order("vertical_key").order("capability_name").limit(220)),
      safeQuery<Row>("parent visibility policy", () => supabase.from("parent_visibility_policy_rules" as any).select("*").order("source_type").limit(80))
    ]);
    return { scores, dpias, capabilities, explainability, decisionAudit, privacyImpact, ethics, models, deployments, reviews, verticalMatrix, parentVisibility };
  }, {
    scores: [] as Row[],
    dpias: [] as Row[],
    capabilities: [] as Row[],
    explainability: [] as Row[],
    decisionAudit: [] as Row[],
    privacyImpact: [] as Row[],
    ethics: [] as Row[],
    models: [] as Row[],
    deployments: [] as Row[],
    reviews: [] as Row[],
    verticalMatrix: [] as Row[],
    parentVisibility: [] as Row[]
  });

  const data = result.data;
  const latestScore = data.scores[0];
  const responsibleScore = Number(latestScore?.responsible_ai_score ?? 0);
  const dpiaReady = data.dpias.filter((dpia) => ["approved", "approved_with_restrictions", "in_review"].includes(String(dpia.approval_status))).length;
  const restrictedCapabilities = data.capabilities.filter((capability) => ["disabled", "restricted", "legal_review_required"].includes(String(capability.legal_status)));
  const automaticActions = data.capabilities.filter((capability) => capability.automatic_action_allowed === true);
  const productionModels = data.models.filter((model) => ["production", "approved"].includes(String(model.lifecycle_status)));
  const unapprovedDeployments = data.deployments.filter((deployment) => !["approved"].includes(String(deployment.approval_status)));
  const explainabilityScore = Number(latestScore?.explainability_score ?? Math.min(100, data.explainability.length * 30));
  const ethicsScore = average(data.ethics, "score");
  const parentBlockedRules = data.parentVisibility.filter((rule) => rule.visibility_status === "blocked").length;

  return (
    <DashboardShell role="admin" title="AI Governance">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Responsible AI"
          title="מרכז AI Governance, DPIA ו-Privacy-by-Design"
          subtitle="AI הוא עוזר בלבד: הוא יכול להסביר, להמליץ ולתעדף, אבל לא להאשים, להעניש, לקבל החלטות משפטיות או לפעול בלי בדיקה אנושית."
          badge={`${responsibleScore}/100`}
          badgeTone={scoreTone(responsibleScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/ai-platform">פלטפורמת AI</Link><Link className="button secondary" href="/dashboard/admin/regulatory">רגולציה</Link></>}
        >
          <div className="setup-checklist"><span>Human review mandatory</span><span>No automatic decisions</span><span>DPIA before production</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="Responsible AI" value={`${responsibleScore}/100`} tone={scoreTone(responsibleScore)} hint="ציון ממשל AI" />
          <RoleMetricCard label="DPIA" value={`${dpiaReady}/${data.dpias.length}`} tone={dpiaReady === data.dpias.length && data.dpias.length ? "good" : "warn"} hint="בבדיקה או מאושר" />
          <RoleMetricCard label="יכולות מוגבלות" value={restrictedCapabilities.length} tone={restrictedCapabilities.length ? "warn" : "good"} hint="כולל פנים ושמע" />
          <RoleMetricCard label="הסברתיות" value={`${explainabilityScore}/100`} tone={scoreTone(explainabilityScore)} hint={`${data.explainability.length} רשומות`} />
          <RoleMetricCard label="ביקורת החלטות" value={data.decisionAudit.length} tone={data.decisionAudit.length ? "good" : "warn"} hint="אין פעולה אוטומטית" />
          <RoleMetricCard label="פעולות אוטומטיות" value={automaticActions.length} tone={automaticActions.length ? "bad" : "good"} hint="חייב להיות 0" />
        </section>

        <section className="camera-infra-grid">
          <CleanSection title="DPIA Management" subtitle="כל מערכת AI רגישה חייבת מטרה, סיכון, בקרות צמצום ואישור.">
            {data.dpias.length === 0 ? <EmptyState title="אין DPIA" text="הרצת המיגרציה מוסיפה DPIA בסיסי לתצפיתן, עוזר AI ומנוע סיכון." /> : (
              <div className="camera-infra-list">{data.dpias.map((dpia) => (
                <article className="camera-infra-row" key={dpia.id}>
                  <div><strong>{dpia.ai_system_name}</strong><span>{dpia.purpose} · סקירה הבאה {dateText(dpia.next_review_due_at)}</span></div>
                  <StatusBadge tone={statusTone(dpia.risk_level)}>{label(dpia.risk_level)}</StatusBadge>
                  <StatusBadge tone={statusTone(dpia.approval_status)}>{label(dpia.approval_status)}</StatusBadge>
                </article>
              ))}</div>
            )}
          </CleanSection>

          <CleanSection title="AI Capability Registry" subtitle="מה מותר, מה מוגבל ומה כבוי בכל ורטיקל.">
            <div className="camera-infra-list">{data.capabilities.slice(0, 12).map((capability) => (
              <article className="camera-infra-row" key={capability.id}>
                <div><strong>{capability.capability_name}</strong><span>{capability.category} · {capability.notes}</span></div>
                <StatusBadge tone={statusTone(capability.legal_status)}>{label(capability.legal_status)}</StatusBadge>
                <StatusBadge tone={statusTone(capability.risk_classification)}>{label(capability.risk_classification)}</StatusBadge>
              </article>
            ))}</div>
          </CleanSection>
        </section>

        <section className="camera-infra-grid">
          <CleanSection title="Human Review Enforcement" subtitle="AI output -> human review -> decision -> action. אף פעם לא פעולה אוטומטית.">
            {data.decisionAudit.length === 0 ? <EmptyState title="אין ביקורת החלטות" text="המערכת שומרת audit לכל תוצאה רגישה שנבדקת." /> : (
              <div className="camera-infra-list">{data.decisionAudit.slice(0, 10).map((audit) => (
                <article className="camera-infra-row" key={audit.id}>
                  <div><strong>{audit.ai_output_type}</strong><span>{audit.decision_summary ?? "AI output awaiting review"} · {audit.final_action ?? "no action"}</span></div>
                  <StatusBadge tone={audit.automatic_action_taken ? "bad" : "good"}>{audit.automatic_action_taken ? "אוטומטי" : "אנושי"}</StatusBadge>
                  <StatusBadge tone={statusTone(audit.review_decision)}>{label(audit.review_decision)}</StatusBadge>
                </article>
              ))}</div>
            )}
          </CleanSection>

          <CleanSection title="Explainability Framework" subtitle="כל פלט AI צריך להסביר למה, מה הביטחון, ומה האותות התומכים.">
            {data.explainability.length === 0 ? <EmptyState title="אין רשומות הסבר" text="הרצת המיגרציה מוסיפה תבניות הסבר לפלטי סיכון וסיכומי הורים." /> : (
              <div className="camera-infra-list">{data.explainability.slice(0, 10).map((record) => (
                <article className="camera-infra-row" key={record.id}>
                  <div><strong>{record.output_summary}</strong><span>{record.human_readable_explanation ?? record.limitations}</span></div>
                  <StatusBadge tone={statusTone(record.review_status)}>{label(record.review_status)}</StatusBadge>
                </article>
              ))}</div>
            )}
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><ShieldCheck size={20} /> Privacy Impact Registry</h2>
            {data.privacyImpact.length === 0 ? <div className="empty-mini">אין רישום סיכוני פרטיות.</div> : data.privacyImpact.map((impact) => (
              <div className="list-item" key={impact.id}>
                <div><strong>{impact.privacy_risk}</strong><span>{(impact.affected_users ?? []).join(", ")} · {impact.ai_system_key}</span></div>
                <StatusBadge tone={statusTone(impact.review_status)}>{label(impact.review_status)}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><Gavel size={20} /> AI Ethics Controls</h2>
            <div className="risk-list">
              <div>Ethics score <b>{ethicsScore}/100</b></div>
              <div>Fairness/Bias/Privacy reviews <b>{data.ethics.length}</b></div>
              <div>Production models <b>{productionModels.length}</b></div>
              <div>Unapproved deployments <b>{unapprovedDeployments.length}</b></div>
              <div>Parent blocked rules <b>{parentBlockedRules}</b></div>
            </div>
          </article>
        </section>

        <CleanSection title="Digital Observer Capability Matrix" subtitle="Digital Observer Core נשאר מלא; כל ורטיקל מקבל הגבלות משלו.">
          {data.verticalMatrix.length === 0 ? <EmptyState title="אין מטריצת ורטיקלים" text="מטריצת Phase 145 תופיע כאן אחרי הרצת המיגרציה." /> : (
            <div className="premium-action-grid">{data.verticalMatrix.slice(0, 16).map((capability) => (
              <article className="premium-action-card" key={capability.id}>
                <GitBranch size={22} />
                <strong>{capability.capability_name}</strong>
                <span>{capability.vertical_key} · {capability.capability_category}</span>
                <StatusBadge tone={statusTone(capability.capability_status)}>{label(capability.capability_status)}</StatusBadge>
              </article>
            ))}</div>
          )}
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="AI Platform" text="מודלים, כיול ופריסה" href="/dashboard/admin/ai-platform" icon={BrainCircuit} />
          <ActionCard title="Regulatory" text="מטריצת יכולות ישראל" href="/dashboard/admin/regulatory" icon={Scale} />
          <ActionCard title="Observer Network" text="אותות לבדיקה" href="/dashboard/admin/observer-network" icon={Eye} />
          <ActionCard title="Risk Intelligence" text="המלצות בלבד" href="/dashboard/admin/risk-intelligence" icon={ClipboardCheck} />
          <ActionCard title="Security" text="פרטיות ו־MFA" href="/dashboard/admin/security" icon={UserCheck} />
          <ActionCard title="Audit Logs" text="מעקב פעולות" href="/dashboard/admin/audit-logs" icon={FileCheck2} />
        </section>
      </div>
    </DashboardShell>
  );
}
