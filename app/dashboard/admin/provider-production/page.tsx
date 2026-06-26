import Link from "next/link";
import { Banknote, BellRing, Brain, Camera, CreditCard, FileText, HeartPulse, Mail, MessageCircle, RotateCcw, ShieldCheck, Smartphone, TestTube2, Webhook } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { AdminIntegrationsTestPanel } from "@/components/admin-integrations-test-panel";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { getIntegrationSafetyModes, getProviderMissingConfiguration, getSafeIntegrationStatus, type IntegrationType } from "@/lib/domain/provider-integration-safety";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, any>;
type Tone = "default" | "good" | "warn" | "bad";

const providerTypes: Array<{ type: IntegrationType; title: string; icon: typeof Mail; modeLabel: string }> = [
  { type: "email", title: "Email", icon: Mail, modeLabel: "COMMUNICATIONS_SEND_MODE" },
  { type: "whatsapp", title: "WhatsApp", icon: MessageCircle, modeLabel: "COMMUNICATIONS_SEND_MODE" },
  { type: "sms", title: "SMS", icon: Smartphone, modeLabel: "COMMUNICATIONS_SEND_MODE" },
  { type: "push", title: "Push", icon: BellRing, modeLabel: "PUSH_MODE" },
  { type: "payment", title: "Payments", icon: CreditCard, modeLabel: "PAYMENT_MODE" },
  { type: "invoice", title: "Invoices", icon: FileText, modeLabel: "INVOICE_MODE" },
  { type: "camera_gateway", title: "Camera Gateway", icon: Camera, modeLabel: "CAMERA_GATEWAY_MODE" },
  { type: "ai_provider", title: "AI Provider", icon: Brain, modeLabel: "AI_PROVIDER_MODE" }
];

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
  const labels: Record<string, string> = {
    configured: "מוגדר",
    test_mode: "מצב בדיקה",
    production_ready: "מוכן לייצור",
    production_active: "פעיל בייצור",
    active: "פעיל",
    healthy: "תקין",
    passed: "עבר",
    ready: "מוכן",
    available: "זמין",
    tested: "נבדק",
    approved: "מאושר",
    reconciled: "מותאם",
    production_pending: "ממתין לייצור",
    not_configured: "לא מוגדר",
    estimated: "אומדן",
    reported: "דווח",
    open: "פתוח",
    ready_for_review: "מוכן לבדיקה",
    acknowledged: "אושר בטיפול",
    needs_review: "דורש בדיקה",
    skipped: "דולג",
    degraded: "ירידה בשירות",
    failed: "נכשל",
    disabled: "מושבת",
    blocked: "חסום",
    critical: "קריטי",
    high: "גבוה",
    medium: "בינוני",
    low: "נמוך",
    not_ready: "לא מוכן",
    live: "חי",
    mock: "מדומה",
    sandbox: "Sandbox"
  };
  return labels[String(value ?? "").toLowerCase()] ?? String(value ?? "לא ידוע").replaceAll("_", " ");
}

function money(value: unknown) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function dateText(value?: string | null) {
  if (!value) return "עדיין לא";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function toneForScore(score: number): Tone {
  if (score >= 82) return "good";
  if (score >= 58) return "warn";
  return "bad";
}

function toneForStatus(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["configured", "test_mode", "production_ready", "production_active", "active", "healthy", "passed", "ready", "available", "tested", "approved", "reconciled"].includes(value)) return "good";
  if (["production_pending", "not_configured", "estimated", "reported", "open", "ready_for_review", "acknowledged", "needs_review", "skipped"].includes(value)) return "warn";
  if (["degraded", "failed", "disabled", "blocked", "critical", "high", "not_ready"].includes(value)) return "bad";
  return "default";
}

function modeFor(type: IntegrationType, modes: ReturnType<typeof getIntegrationSafetyModes>) {
  if (["email", "whatsapp", "sms"].includes(type)) return modes.communications;
  if (type === "push") return modes.push;
  if (type === "payment") return modes.payment;
  if (type === "invoice") return modes.invoice;
  if (type === "camera_gateway") return modes.cameraGateway;
  if (type === "ai_provider") return modes.aiProvider;
  return "configured";
}

export default async function ProviderProductionPage() {
  const { profile } = await requireRole(["admin"]);
  const modes = getIntegrationSafetyModes();
  const result = await safeAdminData("provider production activation", async () => {
    const supabase = await createClient();
    const [scores, integrations, checklists, health, costs, alerts, fallbacks, rollbacks, runbooks, tests, webhooks, deliveryLogs] = await Promise.all([
      safeQuery<Row>("provider production readiness scores", () => supabase.from("provider_production_readiness_scores" as any).select("*").order("calculated_at", { ascending: false }).limit(1)),
      safeQuery<Row>("production integrations", () => supabase.from("production_integrations" as any).select("*").order("integration_type").order("provider").limit(200)),
      safeQuery<Row>("provider production checklists", () => supabase.from("provider_production_checklists" as any).select("*").order("integration_type").order("provider").limit(120)),
      safeQuery<Row>("provider production health metrics", () => supabase.from("provider_production_health_metrics" as any).select("*").order("integration_type").limit(120)),
      safeQuery<Row>("provider production costs", () => supabase.from("provider_production_costs" as any).select("*").order("cost_month", { ascending: false }).limit(80)),
      safeQuery<Row>("provider production incident alerts", () => supabase.from("provider_production_incident_alerts" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("provider fallback rules", () => supabase.from("provider_fallback_rules" as any).select("*").order("trigger_channel").limit(80)),
      safeQuery<Row>("provider rollback controls", () => supabase.from("provider_rollback_controls" as any).select("*").order("integration_type").limit(80)),
      safeQuery<Row>("provider production runbooks", () => supabase.from("provider_production_runbooks" as any).select("*").order("incident_type").limit(80)),
      safeQuery<Row>("provider production test center", () => supabase.from("provider_production_test_center" as any).select("*").order("integration_type").limit(80)),
      safeQuery<Row>("production webhook readiness", () => supabase.from("production_webhook_readiness" as any).select("*").order("integration_type").limit(80)),
      safeQuery<Row>("provider delivery logs", () => supabase.from("provider_delivery_logs" as any).select("*").order("created_at", { ascending: false }).limit(30))
    ]);
    return { scores, integrations, checklists, health, costs, alerts, fallbacks, rollbacks, runbooks, tests, webhooks, deliveryLogs };
  }, {
    scores: [] as Row[],
    integrations: [] as Row[],
    checklists: [] as Row[],
    health: [] as Row[],
    costs: [] as Row[],
    alerts: [] as Row[],
    fallbacks: [] as Row[],
    rollbacks: [] as Row[],
    runbooks: [] as Row[],
    tests: [] as Row[],
    webhooks: [] as Row[],
    deliveryLogs: [] as Row[]
  });

  const data = result.data;
  const score = data.scores[0] ?? {};
  const readiness = Number(score.activation_readiness_score ?? 0);
  const productionActive = data.checklists.filter((item) => item.activation_status === "production_active").length;
  const productionPending = data.checklists.filter((item) => item.activation_status === "production_pending").length;
  const failedOrDegraded = data.health.filter((item) => ["failed", "degraded"].includes(String(item.provider_status))).length + data.alerts.filter((item) => ["high", "critical"].includes(String(item.severity)) && !["resolved", "suppressed"].includes(String(item.status))).length;
  const webhookReady = data.webhooks.filter((item) => ["configured", "production_ready", "production_active", "active"].includes(String(item.status))).length;
  const rollbackReady = data.rollbacks.filter((item) => ["ready", "tested"].includes(String(item.rollback_status))).length;
  const totalEstimatedCost = data.costs.reduce((sum, item) => sum + Number(item.estimated_cost_nis ?? 0), 0);

  const providerCards = providerTypes.map((meta) => {
    const rows = data.integrations.filter((item) => item.integration_type === meta.type);
    const checklist = data.checklists.find((item) => item.integration_type === meta.type);
    const health = data.health.find((item) => item.integration_type === meta.type);
    const status = health?.provider_status ?? checklist?.activation_status ?? getSafeIntegrationStatus(meta.type, checklist?.provider ?? rows[0]?.provider);
    const missing = checklist?.required_env_configured === false ? checklist.required_env_vars ?? getProviderMissingConfiguration(meta.type, checklist.provider) : getProviderMissingConfiguration(meta.type, checklist?.provider ?? rows[0]?.provider);
    return { ...meta, status, rows, checklist, health, missing };
  });

  return (
    <AdminAppFrame profile={profile} activeHref="/dashboard/admin/provider-production" title="בריאות ספקים" subtitle="ספקי תקשורת, תשלום, חשבוניות, Camera Gateway ו־AI תחת בקרה." badge="ספקים">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Provider Production Activation"
          title="הפעלת ספקי Production בצורה מבוקרת"
          subtitle="מרכז שליטה להפעלת ספקי Email, WhatsApp, SMS, Push, תשלומים, חשבוניות, Camera Gateway, AI ו-Webhooks. אין שליחה רחבה ואין חיובים חיים בלי דגלי env ואישור אדמין."
          badge={`${readiness}/100`}
          badgeTone={toneForScore(readiness)}
          actions={<><Link className="button primary" href="#test-center">Safe test center</Link><Link className="button secondary" href="/dashboard/admin/integrations">Integrations</Link></>}
        >
          <div className="setup-checklist">
            <span>No hardcoded secrets</span>
            <span>No client service keys</span>
            <span>No mass sends</span>
            <span>No live charge by default</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="Activation readiness" value={`${readiness}/100`} hint={label(score.production_activation_status)} tone={toneForScore(readiness)} />
          <RoleMetricCard label="Production active" value={productionActive} hint={`${productionPending} pending`} tone={productionActive ? "good" : "warn"} />
          <RoleMetricCard label="Webhooks ready" value={`${webhookReady}/${data.webhooks.length || 8}`} hint="signature + replay + idempotency" tone={webhookReady ? "good" : "warn"} />
          <RoleMetricCard label="Rollback ready" value={`${rollbackReady}/${data.rollbacks.length || 6}`} hint="preserve logs and customer state" tone={rollbackReady ? "good" : "warn"} />
          <RoleMetricCard label="Provider issues" value={failedOrDegraded} hint="degraded, failed or high alert" tone={failedOrDegraded ? "bad" : "good"} />
          <RoleMetricCard label="Estimated monthly cost" value={money(totalEstimatedCost)} hint="provider cost tracking baseline" tone="warn" />
        </section>

        <CleanSection title="Production Safety Flags" subtitle="ברירת המחדל נשארת בטוחה. Production דורש env מפורש, בדיקת ספק ואישור owner.">
          <div className="communication-template-grid">
            {providerTypes.map((item) => {
              const mode = modeFor(item.type, modes);
              return (
                <article className="communication-template-card" key={item.type}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.modeLabel} = {mode}</span>
                  </div>
                  <StatusBadge tone={String(mode).includes("production") || mode === "live" ? "warn" : "good"}>{label(String(mode))}</StatusBadge>
                </article>
              );
            })}
          </div>
        </CleanSection>

        <CleanSection title="Provider Activation Status" subtitle="כל ספק חייב env, webhook, test, audit, fallback ו-rollback לפני production_active.">
          <div className="communication-channel-grid">
            {providerCards.map((card) => {
              const Icon = card.icon;
              const missing = Array.isArray(card.missing) ? card.missing : [];
              return (
                <article className="communication-channel-card" key={card.type}>
                  <div className="communication-channel-head">
                    <span className="communication-channel-icon"><Icon size={22} /></span>
                    <div>
                      <h3>{card.title}</h3>
                      <p>{card.checklist?.notes ?? `${card.title} production readiness`}</p>
                    </div>
                    <StatusBadge tone={toneForStatus(card.status)}>{label(card.status)}</StatusBadge>
                  </div>
                  <div className="communication-provider-list">
                    <div className="communication-provider-row">
                      <div>
                        <strong>{card.checklist?.provider ?? card.rows[0]?.provider ?? "selected_provider"}</strong>
                        <span>{missing.length ? `Missing: ${missing.slice(0, 3).join(", ")}` : "No missing env detected from server context"}</span>
                      </div>
                      <StatusBadge tone={card.checklist?.owner_approved ? "good" : "warn"}>{card.checklist?.owner_approved ? "owner approved" : "approval required"}</StatusBadge>
                    </div>
                    <div className="communication-provider-row">
                      <div>
                        <strong>Health</strong>
                        <span>delivery {card.health?.delivery_rate_percent ?? 0}% · latency {card.health?.latency_ms ?? "TBD"}ms · last success {dateText(card.health?.last_successful_request_at)}</span>
                      </div>
                      <StatusBadge tone={toneForStatus(card.health?.rollback_status)}>{label(card.health?.rollback_status ?? "available")}</StatusBadge>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Payment & Invoice Separation" subtitle="שלושה זרמי כסף נפרדים: גן בטוח, תשלומי הורים לגן, Digital Observer. אין raw card data.">
            <div className="camera-infra-list">
              {[
                ["Gan Batuach subscription", "Kindergarten → Gan Batuach company account", "800 NIS/month + 200 NIS per extra class"],
                ["Parent tuition", "Parent → kindergarten account/provider", "Gan Batuach facilitates only"],
                ["Digital Observer", "Standalone customer → Digital Observer product account", "package / trial / paid beta / active"]
              ].map(([title, flow, detail]) => (
                <article className="camera-infra-row" key={title}>
                  <div>
                    <strong>{title}</strong>
                    <span>{flow}</span>
                  </div>
                  <StatusBadge tone="good">separated</StatusBadge>
                  <small>{detail}</small>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Webhook Infrastructure" subtitle="חתימה, replay protection, idempotency, event logging, retry ו-dead-letter readiness.">
            <div className="procedure-list compact-list">
              {data.webhooks.map((webhook) => (
                <div className="mini-row" key={webhook.id ?? webhook.webhook_key}>
                  <span>{webhook.webhook_key}</span>
                  <strong><StatusBadge tone={toneForStatus(webhook.status)}>{label(webhook.status)}</StatusBadge></strong>
                  <small>{webhook.endpoint_path} · {webhook.signing_secret_env ?? "secret env required"}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Provider Health & Costs" subtitle="בקשות אחרונות, שגיאות, latency, delivery rate, rate limits ועלות חודשית לפי מוצר/ערוץ.">
            <div className="procedure-list compact-list">
              {data.health.map((item) => (
                <div className="mini-row" key={item.id ?? item.metric_key}>
                  <span>{label(item.integration_type)} · {item.provider}</span>
                  <strong><StatusBadge tone={toneForStatus(item.provider_status)}>{label(item.provider_status)}</StatusBadge></strong>
                  <small>error {item.error_rate_percent}% · delivery {item.delivery_rate_percent}% · {item.next_action}</small>
                </div>
              ))}
              {data.costs.map((item) => (
                <div className="mini-row" key={item.id ?? item.cost_key}>
                  <span>{label(item.product)} · {label(item.channel)} · {item.provider}</span>
                  <strong><StatusBadge tone={toneForStatus(item.status)}>{money(item.estimated_cost_nis)}</StatusBadge></strong>
                  <small>{item.unit_count} units · {dateText(item.cost_month)}</small>
                </div>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Incidents, Fallbacks & Rollback" subtitle="כל כשל ספק חייב fallback בטוח ויכולת rollback בלי מחיקת נתונים.">
            <div className="procedure-list compact-list">
              {data.alerts.map((alert) => (
                <div className="mini-row" key={alert.id ?? alert.alert_key}>
                  <span>{label(alert.alert_type)}</span>
                  <strong><StatusBadge tone={toneForStatus(alert.severity)}>{label(alert.severity)}</StatusBadge></strong>
                  <small>{alert.message} · fallback: {alert.fallback_action}</small>
                </div>
              ))}
              {data.fallbacks.map((rule) => (
                <div className="mini-row" key={rule.id ?? rule.rule_key}>
                  <span>{rule.trigger_channel} · {rule.trigger_condition}</span>
                  <strong><StatusBadge tone={toneForStatus(rule.status)}>{label(rule.status)}</StatusBadge></strong>
                  <small>{rule.fallback_action}</small>
                </div>
              ))}
              {data.rollbacks.map((rollback) => (
                <div className="mini-row" key={rollback.id ?? rollback.rollback_key}>
                  <span>{label(rollback.integration_type)} · {rollback.provider}</span>
                  <strong><StatusBadge tone={toneForStatus(rollback.rollback_status)}>{rollback.current_mode} → {rollback.rollback_mode}</StatusBadge></strong>
                  <small>preserves logs, invoices, payment records, delivery records and customer state</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <section id="test-center" className="grid cols-2 dashboard-panels">
          <CleanSection title="Real Test Send Center" subtitle="בדיקות רק לנמענים פנימיים מאושרים, עם אישור אדמין ולוג מלא. אין mass tests.">
            <div className="procedure-list compact-list">
              {data.tests.map((test) => (
                <div className="mini-row" key={test.id ?? test.test_key}>
                  <span>{label(test.test_type)} · {test.provider}</span>
                  <strong><StatusBadge tone={toneForStatus(test.last_test_status)}>{label(test.last_test_status)}</StatusBadge></strong>
                  <small>{test.next_action} · last {dateText(test.last_test_at)}</small>
                </div>
              ))}
            </div>
            <AdminIntegrationsTestPanel integrations={data.integrations.map((item) => ({ integration_type: item.integration_type, provider: item.provider, status: item.status }))} />
          </CleanSection>

          <CleanSection title="Production Runbooks" subtitle="תקלות ספקים, webhook failure, מניעת mass-send ומניעת duplicate payment.">
            <div className="procedure-list compact-list">
              {data.runbooks.map((runbook) => (
                <div className="mini-row" key={runbook.id ?? runbook.runbook_key}>
                  <span>{runbook.title}</span>
                  <strong><StatusBadge tone={toneForStatus(runbook.status)}>{label(runbook.status)}</StatusBadge></strong>
                  <small>{runbook.escalation_owner ?? "Owner TBD"} · rollback {runbook.rollback_reference ?? "manual"}</small>
                </div>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Recent Delivery Logs" subtitle="לוג אחיד לכל הערוצים, כולל queued/sent/delivered/read/opened/failed/skipped/blocked/retried.">
          {data.deliveryLogs.length ? (
            <div className="communication-log-list">
              {data.deliveryLogs.map((log) => (
                <article className="communication-log-row" key={log.id}>
                  <div>
                    <strong>{log.channel} · {log.provider}</strong>
                    <span>{log.template ?? "provider event"} · {dateText(log.delivered_at ?? log.sent_at ?? log.failed_at ?? log.created_at)}</span>
                  </div>
                  <StatusBadge tone={String(log.status).includes("failed") ? "bad" : "good"}>{label(log.status)}</StatusBadge>
                </article>
              ))}
            </div>
          ) : <EmptyState title="אין עדיין לוגי מסירה" text="לוגים יופיעו אחרי בדיקות ספקים או webhooks." />}
        </CleanSection>

        <CleanSection title="Related Operations" subtitle="מסכים ייעודיים נשארים זמינים לניהול עמוק.">
          <section className="grid cols-4">
            <ActionCard icon={TestTube2} title="Integrations" text="Provider setup and safe tests" href="/dashboard/admin/integrations" />
            <ActionCard icon={Webhook} title="Webhooks" text="Signature and idempotency readiness" href="/dashboard/admin/provider-production" />
            <ActionCard icon={RotateCcw} title="Rollback" text={`${rollbackReady} rollback controls ready`} href="/dashboard/admin/provider-production" />
            <ActionCard icon={HeartPulse} title="System health" text="Provider health and incident alerts" href="/dashboard/admin/system-health" />
            <ActionCard icon={Banknote} title="Billing" text="Payments and invoice streams" href="/dashboard/admin/billing" />
            <ActionCard icon={Camera} title="Camera gateway" text="No RTSP exposure" href="/dashboard/admin/camera-gateway" />
            <ActionCard icon={Brain} title="AI provider" text="Shadow mode and human review" href="/dashboard/admin/observer-pilot" />
            <ActionCard icon={ShieldCheck} title="Security" text="Server-only secrets and audit logs" href="/dashboard/admin/security-review" />
          </section>
        </CleanSection>
      </div>
    </AdminAppFrame>
  );
}
