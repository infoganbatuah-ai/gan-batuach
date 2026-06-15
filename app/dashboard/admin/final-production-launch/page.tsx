import Link from "next/link";
import { ClipboardCheck, ExternalLink, Flag, ShieldCheck } from "lucide-react";
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
    return result.error ? [] : result.data ?? [];
  } catch (error) {
    logSupabaseError(label, error);
    return [];
  }
}

function label(value?: string | null) {
  return String(value ?? "לא ידוע").replaceAll("_", " ");
}

function scoreTone(score: number): Tone {
  if (score >= 82) return "good";
  if (score >= 62) return "warn";
  return "bad";
}

function statusTone(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["ready", "approved", "verified", "closed", "commercial_ready", "approved_for_launch", "launched", "mitigated"].includes(value)) return "good";
  if (["in_progress", "internal_ready", "pilot_ready", "external_review_required", "accepted_risk", "commercial_ready", "open"].includes(value)) return "warn";
  if (["not_ready", "blocked", "critical", "failed", "paused"].includes(value)) return "bad";
  return "default";
}

function countOpen(rows: Row[]) {
  return rows.filter((item) => !["verified", "closed", "accepted_risk", "mitigated"].includes(String(item.status))).length;
}

export default async function FinalProductionLaunchPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("final production launch", async () => {
    const supabase = await createClient();
    const [scores, statuses, checklists, blockers, risks, decisions, externalScores, providerScores, mobileScores] = await Promise.all([
      safeQuery<Row>("final production readiness scores", () => supabase.from("final_production_readiness_scores" as any).select("*").order("calculated_at", { ascending: false }).limit(1)),
      safeQuery<Row>("final launch status", () => supabase.from("final_launch_status" as any).select("*").order("product_type").limit(10)),
      safeQuery<Row>("final launch checklists", () => supabase.from("final_launch_checklists" as any).select("*").order("product_type").order("checklist_area").limit(80)),
      safeQuery<Row>("final launch blockers", () => supabase.from("final_launch_blockers" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(80)),
      safeQuery<Row>("final production risks", () => supabase.from("final_production_risks" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(80)),
      safeQuery<Row>("final go live decisions", () => supabase.from("final_go_live_decisions" as any).select("*").order("audited_at", { ascending: false }).limit(10)),
      safeQuery<Row>("external validation scores", () => supabase.from("external_validation_scores" as any).select("*").order("calculated_at", { ascending: false }).limit(1)),
      safeQuery<Row>("provider production readiness scores", () => supabase.from("provider_production_readiness_scores" as any).select("*").order("calculated_at", { ascending: false }).limit(1)),
      safeQuery<Row>("mobile release readiness scores", () => supabase.from("mobile_release_readiness_scores" as any).select("*").order("calculated_at", { ascending: false }).limit(1))
    ]);
    return { scores, statuses, checklists, blockers, risks, decisions, externalScores, providerScores, mobileScores };
  }, {
    scores: [] as Row[],
    statuses: [] as Row[],
    checklists: [] as Row[],
    blockers: [] as Row[],
    risks: [] as Row[],
    decisions: [] as Row[],
    externalScores: [] as Row[],
    providerScores: [] as Row[],
    mobileScores: [] as Row[]
  });

  const data = result.data;
  const score = data.scores[0] ?? {};
  const companyScore = Number(score.company_readiness_score ?? 0);
  const ganScore = Number(score.gan_batuach_score ?? 0);
  const observerScore = Number(score.digital_observer_score ?? 0);
  const criticalBlockers = data.blockers.filter((item) => item.severity === "critical" && !["verified", "closed", "accepted_risk"].includes(String(item.status))).length;
  const highRisks = data.risks.filter((item) => ["critical", "high"].includes(String(item.severity)) && !["mitigated", "closed", "accepted_risk"].includes(String(item.status))).length;
  const readyChecklist = data.checklists.filter((item) => ["ready", "approved", "not_required"].includes(String(item.status))).length;
  const latestDecision = data.decisions[0] ?? {};
  const externalScore = Number(data.externalScores[0]?.external_validation_score ?? data.externalScores[0]?.readiness_score ?? score.external_validation_score ?? 0);
  const providerScore = Number(data.providerScores[0]?.activation_readiness_score ?? score.provider_activation_score ?? 0);
  const mobileScore = Number(data.mobileScores[0]?.overall_readiness ?? score.mobile_readiness_score ?? 0);

  return (
    <DashboardShell role="admin" title="Final Production Launch">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Final Production Launch"
          title="מרכז החלטת Go-Live סופי"
          subtitle="מסך סיום הדרך: Gan Batuach ו-Digital Observer מוכנים לתפעול שוטף, אבל השקה ציבורית דורשת אישור אנושי, סגירת חסמים קריטיים והוכחות חיצוניות."
          badge={`${companyScore}/100`}
          badgeTone={scoreTone(companyScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/company-operations">Company operations</Link><Link className="button secondary" href="/dashboard/admin/external-validation">External validation</Link></>}
        >
          <div className="setup-checklist">
            <span>No automatic public launch</span>
            <span>No unsupported certification claims</span>
            <span>No live billing without provider approval</span>
            <span>Monthly releases after Phase 190</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="Company readiness" value={`${companyScore}/100`} hint={label(score.launch_recommendation)} tone={scoreTone(companyScore)} />
          <RoleMetricCard label="Gan Batuach" value={`${ganScore}/100`} hint={label(data.statuses.find((item) => item.product_type === "gan_batuach")?.status)} tone={scoreTone(ganScore)} />
          <RoleMetricCard label="Digital Observer" value={`${observerScore}/100`} hint={label(data.statuses.find((item) => item.product_type === "digital_observer")?.status)} tone={scoreTone(observerScore)} />
          <RoleMetricCard label="External validation" value={`${externalScore}/100`} hint="legal, PT, ISO, app store" tone={scoreTone(externalScore)} />
          <RoleMetricCard label="Providers" value={`${providerScore}/100`} hint="production activation" tone={scoreTone(providerScore)} />
          <RoleMetricCard label="Mobile" value={`${mobileScore}/100`} hint="App Store / Google Play" tone={scoreTone(mobileScore)} />
          <RoleMetricCard label="Critical blockers" value={criticalBlockers} hint={`${countOpen(data.blockers)} open blockers`} tone={criticalBlockers ? "bad" : "good"} />
          <RoleMetricCard label="High risks" value={highRisks} hint="open launch risks" tone={highRisks ? "warn" : "good"} />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Final Product Status" subtitle="סטטוס נפרד ל-Gan Batuach ול-Digital Observer.">
            <div className="camera-infra-list">
              {data.statuses.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.product_type}>
                  <div>
                    <strong>{label(item.product_type)}</strong>
                    <span>{item.notes}</span>
                  </div>
                  <StatusBadge tone={statusTone(item.status)}>{label(item.status)}</StatusBadge>
                  <StatusBadge tone={scoreTone(Number(item.readiness_score ?? 0))}>{item.readiness_score}/100</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Go / No-Go Decision" subtitle="החלטה מבוקרת, מתועדת ומחייבת סקירת חסמים וסיכונים.">
            {latestDecision.decision ? (
              <div className="procedure-list compact-list">
                <div className="mini-row">
                  <span>{label(latestDecision.decision)}</span>
                  <strong><StatusBadge tone={latestDecision.decision === "do_not_launch" ? "bad" : "warn"}>{latestDecision.approver_name ?? "pending approval"}</StatusBadge></strong>
                  <small>{latestDecision.decision_reason}</small>
                </div>
                <div className="mini-row">
                  <span>Blockers reviewed</span>
                  <strong><StatusBadge tone={latestDecision.blockers_reviewed ? "good" : "warn"}>{latestDecision.blockers_reviewed ? "yes" : "required"}</StatusBadge></strong>
                  <small>Critical blockers prevent launch.</small>
                </div>
                <div className="mini-row">
                  <span>Accepted risks reviewed</span>
                  <strong><StatusBadge tone={latestDecision.accepted_risks_reviewed ? "good" : "warn"}>{latestDecision.accepted_risks_reviewed ? "yes" : "required"}</StatusBadge></strong>
                  <small>Executive review required before launch.</small>
                </div>
              </div>
            ) : <EmptyState title="אין החלטת Go/No-Go" text="יש להוסיף החלטה לפני מעבר להשקה." />}
          </CleanSection>
        </section>

        <CleanSection title="Final Launch Checklist" subtitle={`מוכנים: ${readyChecklist}/${data.checklists.length}. פריטים קריטיים חסומים מונעים השקה.`}>
          <div className="communication-template-grid">
            {data.checklists.map((item) => (
              <article className="communication-template-card" key={item.id ?? item.checklist_key}>
                <div>
                  <strong>{label(item.product_type)} · {label(item.checklist_area)}</strong>
                  <span>{item.checklist_item}</span>
                  <small>{item.evidence_reference ?? item.owner ?? "evidence pending"}</small>
                </div>
                <StatusBadge tone={statusTone(item.status)}>{item.critical ? "critical · " : ""}{label(item.status)}</StatusBadge>
              </article>
            ))}
          </div>
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Launch Blockers" subtitle="חסמים קריטיים מונעים השקה עד שהם נסגרים או מאושרים כסיכון בצורה מפורשת.">
            <div className="camera-infra-list">
              {data.blockers.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.blocker_key}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.launch_impact ?? item.description}</span>
                  </div>
                  <StatusBadge tone={item.severity === "critical" ? "bad" : statusTone(item.status)}>{label(item.severity)}</StatusBadge>
                  <StatusBadge tone={statusTone(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Final Risk Register" subtitle="סיכוני השקה לפי מוצר, תפעול, פרטיות, אבטחה, מובייל ותשלומים.">
            <div className="camera-infra-list">
              {data.risks.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.risk_key}>
                  <div>
                    <strong>{label(item.category)} · {item.risk}</strong>
                    <span>{item.mitigation}</span>
                  </div>
                  <StatusBadge tone={item.severity === "critical" || item.severity === "high" ? "warn" : "default"}>{label(item.severity)}</StatusBadge>
                  <StatusBadge tone={statusTone(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Operating Handoff" subtitle="מכאן מפסיקים שלבים ממוספרים ועוברים להפעלה חודשית.">
          <div className="action-grid">
            <ActionCard icon={ClipboardCheck} title="Company operations" text="לקוחות, תמיכה, הכנסות, אירועים, ריליסים ופידבק חודשי." href="/dashboard/admin/company-operations" />
            <ActionCard icon={ShieldCheck} title="Security operations" text="ממצאים, MFA, ספקים, PT, סיכונים ויומן ביקורת." href="/dashboard/admin/security-center" />
            <ActionCard icon={ExternalLink} title="External validation" text="משפטי, פרטיות, PT, ISO, חנויות אפליקציה וספקי תשלום." href="/dashboard/admin/external-validation" />
            <ActionCard icon={Flag} title="Launch readiness" text="החסמים ההיסטוריים והמדדים של עלייה לאוויר." href="/dashboard/admin/launch-readiness" />
          </div>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
