import Link from "next/link";
import { AlertTriangle, BadgeCheck, Ban, FileCheck2, GitBranch, Scale, ShieldCheck } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, any>;
type Tone = "default" | "good" | "warn" | "bad";

function statusTone(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["allowed", "approved", "production_ready", "pilot_ready", "active", "success"].includes(value)) return "good";
  if (["legal_review_required", "restricted", "consent_required", "external_provider_required", "internal_testing"].includes(value)) return "warn";
  if (["disabled", "blocked", "not_ready", "future_only", "critical"].includes(value)) return "bad";
  return "default";
}

function scoreTone(score: number): Tone {
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

function label(value?: string | null) {
  return String(value ?? "לא ידוע").replaceAll("_", " ");
}

function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function decisionText(row: Row) {
  if (row.decision_reason) return row.decision_reason;
  if (row.capability_status === "allowed") return "Allowed under the selected vertical policy.";
  if (row.capability_status === "disabled") return "Blocked by vertical policy.";
  return "Requires legal, privacy or product review before activation.";
}

async function safeQuery<T>(labelText: string, run: () => any) {
  try {
    const result = (await run()) as { data: T[] | null; error: any };
    logSupabaseError(labelText, result.error);
    return result.error ? [] : result.data ?? [];
  } catch (error) {
    logSupabaseError(labelText, error);
    return [];
  }
}

export default async function CapabilityLegalReviewPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("capability legal review", async () => {
    const supabase = await createClient();
    const [capabilities, verticals, decisions, legalItems, auditEvents, copyGuardrails] = await Promise.all([
      safeQuery<Row>("observer capability registry", () => supabase.from("observer_capability_registry" as any).select("*").order("category").order("capability_name").limit(400)),
      safeQuery<Row>("observer verticals", () => supabase.from("observer_verticals" as any).select("*").order("vertical_key").limit(80)),
      safeQuery<Row>("observer vertical capability decisions", () => supabase.from("observer_vertical_capability_decisions" as any).select("*").order("vertical_key").order("risk_level").order("capability_key").limit(800)),
      safeQuery<Row>("capability legal review items", () => supabase.from("legal_review_items" as any).select("*").not("capability_key", "is", null).order("risk_level").order("target_review_date").limit(160)),
      safeQuery<Row>("observer capability audit events", () => supabase.from("observer_capability_audit_events" as any).select("*").order("created_at", { ascending: false }).limit(80)),
      safeQuery<Row>("observer product copy guardrails", () => supabase.from("observer_product_copy_guardrails" as any).select("*").order("vertical_key").order("guardrail_key").limit(120))
    ]);

    return { capabilities, verticals, decisions, legalItems, auditEvents, copyGuardrails };
  }, {
    capabilities: [] as Row[],
    verticals: [] as Row[],
    decisions: [] as Row[],
    legalItems: [] as Row[],
    auditEvents: [] as Row[],
    copyGuardrails: [] as Row[]
  });

  const data = result.data;
  const ganDecisions = data.decisions.filter((decision) => decision.vertical_key === "gan_batuach");
  const coreDecisions = data.decisions.filter((decision) => decision.vertical_key === "digital_observer_core");
  const allowedGan = ganDecisions.filter((decision) => decision.capability_status === "allowed");
  const disabledGan = ganDecisions.filter((decision) => decision.capability_status === "disabled");
  const reviewGan = ganDecisions.filter((decision) => decision.capability_status === "legal_review_required");
  const launchBlockers = ganDecisions.filter((decision) => decision.launch_blocker || ["critical", "high"].includes(String(decision.risk_level)) && decision.capability_status !== "allowed");
  const readinessScore = Math.max(0, Math.min(100, percent(allowedGan.length + disabledGan.length, Math.max(ganDecisions.length, 1)) - Math.min(20, reviewGan.length)));
  const groupedDecisions = data.decisions.reduce<Record<string, Row[]>>((groups, decision) => {
    groups[decision.vertical_key] = [...(groups[decision.vertical_key] ?? []), decision];
    return groups;
  }, {});

  return (
    <DashboardShell role="admin" title="Capability Legal Review">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Digital Observer Governance"
          title="מטריצת יכולות משפטית והחלטת השקה לוורטיקלים"
          subtitle="כל יכולת AI, מצלמה, שמע, ביומטריה, Skeleton ו-Observer מסווגת לפי ורטיקל לפני הפעלה. Gan Batuach משתמש רק במה שמותר למצב גן ישראלי."
          badge={`${readinessScore}/100`}
          badgeTone={scoreTone(readinessScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/final-compliance-review">סקירה סופית</Link><Link className="button secondary" href="/dashboard/admin/digital-observer-core">Observer Core</Link></>}
        >
          <div className="setup-checklist">
            <span>לא מחליף ייעוץ משפטי חיצוני</span>
            <span>יכולות Core אינן מופעלות אוטומטית ב-Gan Batuach</span>
            <span>יכולות מוגבלות דורשות DPIA, privacy review ואישור מפורש</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="Capability registry" value={data.capabilities.length} hint="AI, camera, audio, data and observer" tone="good" />
          <RoleMetricCard label="Verticals" value={data.verticals.length} hint="Gan Batuach + future products" tone="good" />
          <RoleMetricCard label="Gan Batuach allowed" value={allowedGan.length} hint="Allowed with human review" tone="good" />
          <RoleMetricCard label="Gan Batuach disabled" value={disabledGan.length} hint="Audio, face and automatic decisions" tone="bad" />
          <RoleMetricCard label="Legal review" value={reviewGan.length} hint="Blocked until approval" tone="warn" />
          <RoleMetricCard label="Launch blockers" value={launchBlockers.length} hint="Critical/high restricted items" tone={launchBlockers.length ? "bad" : "good"} />
          <RoleMetricCard label="Core mapped" value={coreDecisions.length} hint="Technical core, not legal product" tone="good" />
          <RoleMetricCard label="Copy guardrails" value={data.copyGuardrails.length} hint="Marketing wording safety" tone="good" />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <ActionCard
            icon={ShieldCheck}
            title="GAN_BATUACH_ISRAEL_PROFILE"
            text="Allowed: pose, skeleton, motion, suspected fall/inactivity/crowding, restricted area detection, reviewed summaries and human review workflows."
            href="/dashboard/admin/regulatory"
          />
          <ActionCard
            icon={Ban}
            title="Disabled in Gan Batuach"
            text="Audio recording, audio analytics, speech recognition, keyword detection, face recognition, face matching, child face profiles and automatic AI accusations stay blocked."
            href="/dashboard/admin/ai-governance"
          />
          <ActionCard
            icon={Scale}
            title="Legal-review-only"
            text="Parent camera streaming policy, contextual child association, soft biometrics, gait recognition and cross-day identity tracking require external review."
            href="/dashboard/admin/camera-compliance"
          />
          <ActionCard
            icon={GitBranch}
            title="Digital Observer Core"
            text="The technical core may contain future capabilities, but every vertical receives a separate launch decision before use."
            href="/dashboard/admin/digital-observer-core"
          />
        </section>

        <CleanSection title="Gan Batuach Capability Decisions" subtitle="רשימת החלטות היכולת הפעילה לוורטיקל הישראלי. יכולת restricted/legal review לא אמורה לפעול בשקט.">
          {ganDecisions.length === 0 ? <EmptyState title="אין החלטות Gan Batuach" text="לאחר הרצת מיגרציית Phase 160 תופיע כאן מטריצת היכולות." /> : (
            <div className="procedure-list">
              {ganDecisions.slice(0, 80).map((decision) => (
                <article className="card procedure-card" key={decision.id ?? decision.decision_key}>
                  <div>
                    <StatusBadge tone={statusTone(decision.capability_status)}>{label(decision.capability_status)}</StatusBadge>
                    <h3>{label(decision.capability_key)}</h3>
                    <p>{decisionText(decision)}</p>
                    <small>
                      Risk {label(decision.risk_level)} · Parent visibility {label(decision.parent_visibility_rule)} · Human review {decision.human_review_required ? "required" : "missing"}
                    </small>
                  </div>
                  <div className="procedure-meta">
                    <StatusBadge tone={decision.enabled ? "good" : "warn"}>{decision.enabled ? "Enabled" : "Blocked"}</StatusBadge>
                    <StatusBadge tone={decision.external_legal_review_required ? "warn" : "good"}>{decision.external_legal_review_required ? "External review" : "No external review"}</StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="camera-infra-grid">
          <CleanSection title="Vertical Launch Dashboard" subtitle="מצב השקה, יכולות מותרות, חסומות ופריטי legal review לכל ורטיקל.">
            <div className="camera-infra-list">
              {data.verticals.map((vertical) => {
                const items = groupedDecisions[vertical.vertical_key] ?? [];
                const allowed = items.filter((item) => item.capability_status === "allowed").length;
                const blocked = items.filter((item) => ["disabled", "restricted", "legal_review_required", "future_only"].includes(String(item.capability_status))).length;
                return (
                  <article className="camera-infra-row" key={vertical.id ?? vertical.vertical_key}>
                    <div>
                      <strong>{vertical.vertical_name}</strong>
                      <span>{label(vertical.regulatory_profile)} · {allowed} allowed · {blocked} blocked/review · {vertical.launch_decision_summary}</span>
                    </div>
                    <StatusBadge tone={statusTone(vertical.launch_status)}>{label(vertical.launch_status)}</StatusBadge>
                  </article>
                );
              })}
            </div>
          </CleanSection>

          <CleanSection title="Legal Review Items" subtitle="שאלות שמוכנות למסירה לעורך דין פרטיות, ISO, אבטחה ובודק מצלמות.">
            {data.legalItems.length === 0 ? <EmptyState title="אין פריטי legal review" /> : (
              <div className="camera-infra-list">
                {data.legalItems.map((item) => (
                  <article className="camera-infra-row" key={item.id ?? item.item_key}>
                    <div>
                      <strong>{item.item_title}</strong>
                      <span>{item.legal_question}</span>
                    </div>
                    <StatusBadge tone={statusTone(item.current_status)}>{label(item.current_status)}</StatusBadge>
                    <StatusBadge tone={statusTone(item.risk_level)}>{label(item.risk_level)}</StatusBadge>
                  </article>
                ))}
              </div>
            )}
          </CleanSection>
        </section>

        <section className="camera-infra-grid">
          <CleanSection title="Product Copy Guardrails" subtitle="כללי ניסוח פנימיים כדי לא לטעון טענות מסוכנות על AI, זיהוי או החלטות אוטומטיות.">
            <div className="camera-infra-list">
              {data.copyGuardrails.map((guardrail) => (
                <article className="camera-infra-row" key={guardrail.id ?? guardrail.guardrail_key}>
                  <div>
                    <strong>{guardrail.forbidden_claim}</strong>
                    <span>{guardrail.approved_wording}</span>
                  </div>
                  <StatusBadge tone={statusTone(guardrail.status)}>{label(guardrail.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Capability Audit Events" subtitle="אירועי חסימה, דרישת legal review ושינויי יכולת.">
            {data.auditEvents.length === 0 ? <EmptyState title="אין אירועי יכולת עדיין" /> : (
              <div className="camera-infra-list">
                {data.auditEvents.map((event) => (
                  <article className="camera-infra-row" key={event.id ?? event.event_key}>
                    <div>
                      <strong>{label(event.event_type)}</strong>
                      <span>{label(event.vertical_key)} · {label(event.capability_key)} · {event.reason}</span>
                    </div>
                    <StatusBadge tone={statusTone(event.status)}>{label(event.status)}</StatusBadge>
                  </article>
                ))}
              </div>
            )}
          </CleanSection>
        </section>

        <CleanSection title="External Review Package" subtitle="מה לשלוח לביקורת חיצונית לפני פיילוט/ייצור.">
          <div className="grid cols-3">
            <ActionCard icon={FileCheck2} title="Privacy lawyer" text="Gan Batuach restrictions, parent camera policy, DPIA links and parent visibility boundaries." href="/dashboard/admin/ai-governance" />
            <ActionCard icon={BadgeCheck} title="ISO consultant" text="Control mapping, audit trail, policy guardrails and capability launch decision evidence." href="/dashboard/admin/iso-evidence" />
            <ActionCard icon={AlertTriangle} title="Camera reviewer" text="No direct RTSP, tokenized streaming, child checked-in rule, watermark readiness and access logs." href="/dashboard/admin/camera-compliance" />
          </div>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
