import Link from "next/link";
import { Banknote, BellRing, Camera, LifeBuoy, MapPinned, ShieldAlert } from "lucide-react";
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

async function safeCount(label: string, run: () => any) {
  try {
    const result = (await run()) as { count: number | null; error: any };
    logSupabaseError(label, result.error);
    return result.error ? 0 : result.count ?? 0;
  } catch (error) {
    logSupabaseError(label, error);
    return 0;
  }
}

function label(value?: string | null) {
  return String(value ?? "לא ידוע").replaceAll("_", " ");
}

function money(value: unknown) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function scoreTone(score: number): Tone {
  if (score >= 82) return "good";
  if (score >= 62) return "warn";
  return "bad";
}

function statusTone(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["healthy", "ready", "approved", "released", "active", "closed", "mitigated", "resolved"].includes(value)) return "good";
  if (["planned", "in_progress", "qa", "watching", "open", "triaged", "roadmap_linked", "assigned"].includes(value)) return "warn";
  if (["failed", "degraded", "critical", "blocked", "at_risk", "churned", "detected"].includes(value)) return "bad";
  return "default";
}

export default async function CompanyOperationsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("company operations", async () => {
    const supabase = await createClient();
    const [
      lifecycles,
      releases,
      roadmap,
      feedback,
      incidents,
      monitoring,
      templates,
      finalScores,
      blockers,
      providerHealth,
      supportTickets,
      inspectionsDue,
      overdueInspections,
      activeGardens,
      observerSites,
      subscriptions,
      observerSubscriptions
    ] = await Promise.all([
      safeQuery<Row>("company customer lifecycle", () => supabase.from("company_customer_lifecycle" as any).select("*").order("product_type").order("lifecycle_stage").limit(100)),
      safeQuery<Row>("product releases", () => supabase.from("product_releases" as any).select("*").order("planned_date", { ascending: true }).limit(80)),
      safeQuery<Row>("product roadmap items", () => supabase.from("product_roadmap_items" as any).select("*").order("priority").order("created_at", { ascending: false }).limit(100)),
      safeQuery<Row>("customer feedback loop", () => supabase.from("customer_feedback_loop" as any).select("*").order("created_at", { ascending: false }).limit(80)),
      safeQuery<Row>("production incident response", () => supabase.from("production_incident_response" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(50)),
      safeQuery<Row>("post launch monitoring", () => supabase.from("post_launch_monitoring" as any).select("*").order("monitor_area").limit(80)),
      safeQuery<Row>("launch communication templates", () => supabase.from("launch_communication_templates" as any).select("*").order("audience").order("template_type").limit(80)),
      safeQuery<Row>("final production readiness scores", () => supabase.from("final_production_readiness_scores" as any).select("*").order("calculated_at", { ascending: false }).limit(1)),
      safeQuery<Row>("final launch blockers", () => supabase.from("final_launch_blockers" as any).select("*").order("severity").limit(30)),
      safeQuery<Row>("provider production health metrics", () => supabase.from("provider_production_health_metrics" as any).select("*").order("integration_type").limit(50)),
      safeCount("support tickets open", () => supabase.from("support_tickets" as any).select("*", { count: "exact", head: true }).not("status", "in", "(resolved,closed)")),
      safeCount("required inspections due", () => supabase.from("required_inspections" as any).select("*", { count: "exact", head: true }).neq("status", "done")),
      safeCount("required inspections overdue", () => supabase.from("required_inspections" as any).select("*", { count: "exact", head: true }).lt("due_at", new Date().toISOString()).neq("status", "done")),
      safeCount("active gardens", () => supabase.from("gardens" as any).select("*", { count: "exact", head: true }).in("status", ["active", "safe", "approved"])),
      safeCount("observer sites", () => supabase.from("observer_sites" as any).select("*", { count: "exact", head: true })),
      safeQuery<Row>("subscriptions", () => supabase.from("subscriptions" as any).select("status,monthly_amount,amount,price").limit(500)),
      safeQuery<Row>("observer site subscriptions", () => supabase.from("observer_site_subscriptions" as any).select("subscription_status,monthly_price,annual_price").limit(500))
    ]);
    return {
      lifecycles,
      releases,
      roadmap,
      feedback,
      incidents,
      monitoring,
      templates,
      finalScores,
      blockers,
      providerHealth,
      supportTickets,
      inspectionsDue,
      overdueInspections,
      activeGardens,
      observerSites,
      subscriptions,
      observerSubscriptions
    };
  }, {
    lifecycles: [] as Row[],
    releases: [] as Row[],
    roadmap: [] as Row[],
    feedback: [] as Row[],
    incidents: [] as Row[],
    monitoring: [] as Row[],
    templates: [] as Row[],
    finalScores: [] as Row[],
    blockers: [] as Row[],
    providerHealth: [] as Row[],
    supportTickets: 0,
    inspectionsDue: 0,
    overdueInspections: 0,
    activeGardens: 0,
    observerSites: 0,
    subscriptions: [] as Row[],
    observerSubscriptions: [] as Row[]
  });

  const data = result.data;
  const score = data.finalScores[0] ?? {};
  const companyScore = Number(score.company_readiness_score ?? 0);
  const ganMrr = data.subscriptions
    .filter((item) => ["active", "trialing"].includes(String(item.status)))
    .reduce((sum, item) => sum + Number(item.monthly_amount ?? item.amount ?? item.price ?? 0), 0);
  const observerMrr = data.observerSubscriptions
    .filter((item) => ["active", "trial", "paid_beta"].includes(String(item.subscription_status)))
    .reduce((sum, item) => sum + Number(item.monthly_price ?? 0), 0);
  const openIncidents = data.incidents.filter((item) => !["resolved", "closed"].includes(String(item.status))).length;
  const openBlockers = data.blockers.filter((item) => !["verified", "closed", "accepted_risk"].includes(String(item.status))).length;
  const degradedProviders = data.providerHealth.filter((item) => ["degraded", "failed"].includes(String(item.provider_status))).length;
  const roadmapCritical = data.roadmap.filter((item) => ["critical", "high"].includes(String(item.priority)) && !["released", "cancelled"].includes(String(item.status))).length;

  return (
    <DashboardShell role="admin" title="Company Operations">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Company Operating System"
          title="מערכת ההפעלה של החברה אחרי Phase 190"
          subtitle="מעכשיו עובדים במחזורי שחרור חודשיים, פידבק לקוחות, תמיכה, מכירות, אבטחה, ספקים, תשלומים, פיקוח ותפעול מוצרי Gan Batuach ו-Digital Observer."
          badge={`${companyScore}/100`}
          badgeTone={scoreTone(companyScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/final-production-launch">Final launch</Link><Link className="button secondary" href="/dashboard/admin/provider-production">Providers</Link></>}
        >
          <div className="setup-checklist">
            <span>Monthly releases</span>
            <span>Customer feedback cycles</span>
            <span>Security patch cycles</span>
            <span>Support and sales operations</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="Active kindergartens" value={data.activeGardens} hint="Gan Batuach customers" tone={data.activeGardens ? "good" : "warn"} />
          <RoleMetricCard label="Observer sites" value={data.observerSites} hint="Digital Observer sites" tone={data.observerSites ? "good" : "warn"} />
          <RoleMetricCard label="Gan Batuach MRR" value={money(ganMrr)} hint="separate revenue stream" tone="good" />
          <RoleMetricCard label="Observer MRR" value={money(observerMrr)} hint="separate revenue stream" tone="good" />
          <RoleMetricCard label="Open support" value={data.supportTickets} hint="tickets not closed" tone={data.supportTickets > 15 ? "warn" : "default"} />
          <RoleMetricCard label="Inspections due" value={data.inspectionsDue} hint={`${data.overdueInspections} overdue`} tone={data.overdueInspections ? "bad" : "warn"} />
          <RoleMetricCard label="Incidents" value={openIncidents} hint="production runbooks" tone={openIncidents ? "warn" : "good"} />
          <RoleMetricCard label="Providers degraded" value={degradedProviders} hint="provider health" tone={degradedProviders ? "bad" : "good"} />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Customer Operations" subtitle="מחזור לקוח ברור לשני המוצרים, בלי ערבוב בין גנים לבין אתרי תצפיתן.">
            <div className="camera-infra-list">
              {data.lifecycles.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.lifecycle_key}>
                  <div>
                    <strong>{item.customer_name}</strong>
                    <span>{label(item.product_type)} · {item.next_action ?? item.notes}</span>
                  </div>
                  <StatusBadge tone={statusTone(item.lifecycle_stage)}>{label(item.lifecycle_stage)}</StatusBadge>
                  <StatusBadge tone={scoreTone(Number(item.health_score ?? 0))}>{item.health_score}/100</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Monthly Releases" subtitle="תחליף מסודר לשלבים ממוספרים: תכנון, QA, אישור, שחרור או rollback.">
            <div className="procedure-list compact-list">
              {data.releases.map((item) => (
                <div className="mini-row" key={item.id ?? item.release_key}>
                  <span>{item.release_name}</span>
                  <strong><StatusBadge tone={statusTone(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>{label(item.release_type)} · {item.planned_date ?? "date TBD"} · {item.owner}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Roadmap & Feedback Loop" subtitle={`High priority open items: ${roadmapCritical}. פידבק לקוחות נכנס ל-roadmap ואז לריליס חודשי.`}>
          <div className="communication-template-grid">
            {data.roadmap.map((item) => (
              <article className="communication-template-card" key={item.id ?? item.roadmap_key}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{label(item.category)} · {item.description}</span>
                  <small>{item.source ?? "customer feedback"} → {item.target_release ?? "release TBD"}</small>
                </div>
                <StatusBadge tone={item.priority === "critical" ? "bad" : statusTone(item.status)}>{label(item.priority)} · {label(item.status)}</StatusBadge>
              </article>
            ))}
          </div>
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Support & Feedback" subtitle="פידבק ממנהלים, הורים, צוות, מפקחים, מכירות ו-Digital Observer.">
            <div className="camera-infra-list">
              {data.feedback.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.feedback_key}>
                  <div>
                    <strong>{label(item.feedback_source)} · {item.feedback_summary}</strong>
                    <span>{label(item.product_type)} · {item.owner ?? "unassigned"}</span>
                  </div>
                  <StatusBadge tone={statusTone(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Incident Response" subtitle="זיהוי, חומרה, בעלים, הקטנה, תקשורת, סגירה ופוסטמורטם.">
            <div className="camera-infra-list">
              {data.incidents.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.incident_key}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.mitigation}</span>
                  </div>
                  <StatusBadge tone={item.severity === "critical" ? "bad" : "warn"}>{label(item.severity)}</StatusBadge>
                  <StatusBadge tone={statusTone(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Post-Launch Monitoring" subtitle="בריאות תפעולית אחרי השקה: ספקים, תשלומים, הודעות, DB, איטיות ותמיכה.">
            <div className="procedure-list compact-list">
              {data.monitoring.map((item) => (
                <div className="mini-row" key={item.id ?? item.monitor_key}>
                  <span>{label(item.monitor_area)}</span>
                  <strong><StatusBadge tone={statusTone(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>{item.next_action ?? `threshold ${item.threshold_value ?? "TBD"}`}</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Launch Communications" subtitle="הודעות ללקוחות, הורים, צוות, מפקחים, תמיכה ושותפים. שליחה אמיתית נשארת דרך provider approval.">
            <div className="procedure-list compact-list">
              {data.templates.map((item) => (
                <div className="mini-row" key={item.id ?? item.template_key}>
                  <span>{item.subject}</span>
                  <strong><StatusBadge tone={statusTone(item.status)}>{label(item.status)}</StatusBadge></strong>
                  <small>{label(item.audience)} · {label(item.template_type)}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Operating Dashboards" subtitle="המסכים שמחזיקים את החברה בחיים אחרי ההשקה.">
          <div className="action-grid">
            <ActionCard icon={LifeBuoy} title="Support operations" text="Tickets, SLA breaches, repeated issues and customer health." href="/dashboard/admin/customer-success" />
            <ActionCard icon={ShieldAlert} title="Security operations" text="Findings, suspicious access, MFA gaps, PT and audit events." href="/dashboard/admin/security-center" />
            <ActionCard icon={BellRing} title="Provider operations" text="Email, WhatsApp, SMS, Push, payments, invoices, camera gateway and AI." href="/dashboard/admin/provider-production" />
            <ActionCard icon={Banknote} title="Financial operations" text="Gan Batuach, parent-to-kindergarten and Digital Observer revenue streams." href="/dashboard/admin/billing" />
            <ActionCard icon={MapPinned} title="Inspector operations" text="Inspectors, workload, monthly visits, compensation and regional coverage." href="/dashboard/admin/inspection-workforce" />
            <ActionCard icon={Camera} title="AI / Camera operations" text="Observer events, shadow mode, camera health, gateway and calibration." href="/dashboard/admin/camera-infrastructure" />
          </div>
        </CleanSection>

        {openBlockers ? (
          <CleanSection title="Launch Blockers Still Open" subtitle="תפעול החברה מתחיל, אבל חסמי השקה נשארים גלויים עד סגירה.">
            <div className="camera-infra-list">
              {data.blockers.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.blocker_key}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.mitigation ?? item.description}</span>
                  </div>
                  <StatusBadge tone={item.severity === "critical" ? "bad" : "warn"}>{label(item.severity)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        ) : <EmptyState title="אין חסמי השקה פתוחים" text="עדיין נדרש אישור אנושי לפני launch ציבורי." />}
      </div>
    </DashboardShell>
  );
}
