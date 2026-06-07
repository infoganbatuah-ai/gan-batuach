import Link from "next/link";
import { Bell, Brain, Camera, CheckCircle2, Cloud, Database, Mail, MessageCircle, Server, ShieldCheck, Smartphone, TriangleAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { AdminIntegrationsTestPanel } from "@/components/admin-integrations-test-panel";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEmailProductionReadiness } from "@/lib/domain/email-provider";
import { getSmsProductionReadiness } from "@/lib/domain/sms-provider";
import { getWhatsAppProductionReadiness } from "@/lib/domain/whatsapp-provider";
import { getPushProductionReadiness } from "@/lib/domain/push-provider";
import { getGatewayProvider, isGatewayConfigured } from "@/lib/domain/video-gateway-client";
import { getVisionProductionReadiness } from "@/lib/domain/vision-provider";

type IntegrationType = "email" | "whatsapp" | "sms" | "push" | "supabase" | "vercel" | "camera_gateway" | "ai_provider";

type ProductionIntegration = {
  id: string;
  integration_type: IntegrationType;
  provider: string;
  status?: string | null;
  environment?: string | null;
  last_test_at?: string | null;
  last_test_status?: string | null;
  notes?: string | null;
  metadata?: Record<string, any> | null;
};

type ProviderConfig = {
  channel: string;
  provider: string;
  status?: string | null;
  mode?: string | null;
  sender_name?: string | null;
  sender_email?: string | null;
  sender_phone?: string | null;
  domain_verification_status?: string | null;
  webhook_configured?: boolean | null;
  credentials_configured?: boolean | null;
  metadata?: Record<string, any> | null;
};

type WebhookReadiness = {
  id: string;
  webhook_key: string;
  integration_type: string;
  provider: string;
  endpoint_path: string;
  status?: string | null;
  signing_secret_env?: string | null;
  notes?: string | null;
};

type TestLog = {
  id: string;
  integration_type: IntegrationType;
  provider: string;
  status?: string | null;
  recipient_preview?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
};

const integrationMeta: Record<IntegrationType, { title: string; icon: typeof Mail; href: string; description: string }> = {
  email: { title: "Email", icon: Mail, href: "/dashboard/admin/email-production", description: "Resend, SendGrid, Amazon SES" },
  whatsapp: { title: "WhatsApp", icon: MessageCircle, href: "/dashboard/admin/whatsapp", description: "Meta Cloud API, Twilio WhatsApp" },
  sms: { title: "SMS", icon: Smartphone, href: "/dashboard/admin/sms", description: "Twilio, MessageBird, Vonage, ספק ישראלי" },
  push: { title: "Push", icon: Bell, href: "/dashboard/admin/push-production", description: "FCM, APNs, Web Push" },
  supabase: { title: "Supabase", icon: Database, href: "/dashboard/admin/security", description: "Auth, DB, Storage, RLS" },
  vercel: { title: "Vercel", icon: Cloud, href: "/dashboard/admin/launch-readiness", description: "Deployment, domain, SSL" },
  camera_gateway: { title: "Camera Gateway", icon: Camera, href: "/dashboard/admin/video-gateway", description: "MediaMTX, go2rtc, custom gateway" },
  ai_provider: { title: "AI Provider", icon: Brain, href: "/dashboard/admin/vision-ai", description: "Shadow mode, human review, local/custom models" }
};

const statusLabels: Record<string, string> = {
  not_configured: "לא מוגדר",
  configured: "מוגדר",
  test_mode: "בדיקה",
  production_ready: "מוכן לייצור",
  active: "פעיל",
  disabled: "כבוי",
  failed: "נכשל",
  testing: "בדיקה"
};

function toneForStatus(status?: string | null): "good" | "warn" | "bad" | "default" {
  if (status === "active" || status === "production_ready" || status === "configured") return "good";
  if (status === "test_mode" || status === "testing" || status === "not_configured") return "warn";
  if (status === "failed" || status === "disabled") return "bad";
  return "default";
}

function formatDate(value?: string | null) {
  if (!value) return "עדיין לא";
  return new Date(value).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

async function safeQuery<T>(promise: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>, label: string): Promise<T[]> {
  const result = await promise;
  if (result.error) console.error(`[admin-integrations] ${label}`, { error: result.error.message });
  return result.data ?? [];
}

function envStatus(configured: boolean) {
  return configured ? "configured" : "not_configured";
}

function providerStatusFromRows(rows: ProductionIntegration[], type: IntegrationType) {
  const typeRows = rows.filter((row) => row.integration_type === type);
  if (typeRows.some((row) => row.status === "active")) return "active";
  if (typeRows.some((row) => row.status === "production_ready")) return "production_ready";
  if (typeRows.some((row) => row.status === "configured")) return "configured";
  if (typeRows.some((row) => row.status === "test_mode")) return "test_mode";
  if (typeRows.some((row) => row.status === "failed")) return "failed";
  return "not_configured";
}

export default async function AdminIntegrationsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const [integrations, providerConfigs, webhookRows, testLogs] = await Promise.all([
    safeQuery<ProductionIntegration>(supabase.from("production_integrations" as any).select("*").order("integration_type").order("provider"), "production integrations"),
    safeQuery<ProviderConfig>(supabase.from("communication_provider_configs" as any).select("*").order("channel").order("provider"), "communication provider configs"),
    safeQuery<WebhookReadiness>(supabase.from("production_webhook_readiness" as any).select("*").order("integration_type").order("provider"), "webhook readiness"),
    safeQuery<TestLog>(supabase.from("production_integration_test_logs" as any).select("*").order("created_at", { ascending: false }).limit(40), "integration test logs")
  ]);

  const emailReadiness = getEmailProductionReadiness();
  const whatsappReadiness = getWhatsAppProductionReadiness();
  const smsReadiness = getSmsProductionReadiness();
  const pushReadiness = getPushProductionReadiness();
  const visionReadiness = getVisionProductionReadiness();
  const gatewayConfigured = isGatewayConfigured();
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const vercelConfigured = Boolean(process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL);

  const computedOverrides: Partial<Record<IntegrationType, string>> = {
    email: envStatus(emailReadiness.configured),
    whatsapp: envStatus(whatsappReadiness.configured),
    sms: envStatus(smsReadiness.configured),
    push: pushReadiness.configured ? (pushReadiness.realSendEnabled ? "production_ready" : "configured") : "not_configured",
    supabase: envStatus(supabaseConfigured),
    vercel: envStatus(vercelConfigured),
    camera_gateway: gatewayConfigured ? "configured" : "not_configured",
    ai_provider: visionReadiness.providers.some((provider) => provider.configured && provider.supportsRealProcessing) ? "configured" : "test_mode"
  };

  const cards = (Object.keys(integrationMeta) as IntegrationType[]).map((type) => {
    const rows = integrations.filter((row) => row.integration_type === type);
    const dbStatus = providerStatusFromRows(integrations, type);
    const status = computedOverrides[type] === "configured" && dbStatus === "test_mode" ? "test_mode" : computedOverrides[type] ?? dbStatus;
    return { type, rows, status };
  });

  const readyCount = cards.filter((card) => ["configured", "production_ready", "active", "test_mode"].includes(card.status)).length;
  const activeCount = cards.filter((card) => card.status === "active").length;
  const failedCount = cards.filter((card) => card.status === "failed").length;
  const webhooksReady = webhookRows.filter((row) => ["configured", "production_ready", "active"].includes(String(row.status))).length;

  return (
    <DashboardShell role="admin" title="Production Integrations">
      <div className="commercial-dashboard communications-dashboard">
        <PremiumDashboardHero
          eyebrow="אינטגרציות"
          title="הפעלה מבוקרת של ספקי ייצור"
          subtitle="Email, WhatsApp, SMS, Push, Supabase, Vercel, Video Gateway ו-AI במקום אחד. אין שליחה אמיתית בלי הפעלה מפורשת."
          badge="Safe activation"
          badgeTone="warn"
          actions={<><Link className="button primary" href="#integration-test-center">בדיקת אינטגרציה</Link><Link className="button secondary" href="/dashboard/admin/communications">מרכז תקשורת</Link></>}
        />

        <div className="premium-metric-grid">
          <RoleMetricCard label="אינטגרציות מוכנות" value={`${readyCount}/8`} hint="מוגדרות או במצב בדיקה" tone={readyCount >= 7 ? "good" : "warn"} />
          <RoleMetricCard label="פעילות באמת" value={activeCount} hint="לא מופעל אוטומטית" tone={activeCount ? "good" : "warn"} />
          <RoleMetricCard label="Webhooks" value={`${webhooksReady}/${webhookRows.length || 6}`} hint="מוכנות חתימה ומשוב" tone={webhooksReady ? "good" : "warn"} />
          <RoleMetricCard label="כשלים" value={failedCount} hint="דורש טיפול לפני הפעלה" tone={failedCount ? "bad" : "good"} />
        </div>

        <CleanSection title="סטטוס אינטגרציות" subtitle="סטטוס ייצור ללא שמירת סודות במסד הנתונים.">
          <div className="communication-channel-grid">
            {cards.map((card) => {
              const meta = integrationMeta[card.type];
              const Icon = meta.icon;
              return (
                <article className="communication-channel-card" key={card.type}>
                  <div className="communication-channel-head">
                    <span className="communication-channel-icon"><Icon size={22} /></span>
                    <div>
                      <h3>{meta.title}</h3>
                      <p>{meta.description}</p>
                    </div>
                    <StatusBadge tone={toneForStatus(card.status)}>{statusLabels[card.status] ?? card.status}</StatusBadge>
                  </div>
                  <div className="communication-provider-list">
                    {(card.rows.length ? card.rows : [{ provider: "env", status: computedOverrides[card.type], environment: "production" } as ProductionIntegration]).slice(0, 4).map((row) => (
                      <div className="communication-provider-row" key={`${card.type}-${row.provider}`}>
                        <div>
                          <strong>{row.provider}</strong>
                          <span>{row.environment ?? "production"} · בדיקה אחרונה {formatDate(row.last_test_at)}</span>
                        </div>
                        <StatusBadge tone={toneForStatus(row.status ?? computedOverrides[card.type])}>{statusLabels[row.status ?? computedOverrides[card.type] ?? ""] ?? row.status ?? computedOverrides[card.type]}</StatusBadge>
                      </div>
                    ))}
                  </div>
                  <Link className="button secondary" href={meta.href}>ניהול {meta.title}</Link>
                </article>
              );
            })}
          </div>
        </CleanSection>

        <CleanSection title="פרטי ספקים" subtitle="מה צריך להיות מוכן לפני מעבר מ-test_mode ל-production_ready.">
          <div className="communication-template-grid">
            <article className="communication-template-card"><div><strong>Email</strong><span>Resend, SendGrid, Amazon SES · sender email + domain verification</span></div><StatusBadge tone={toneForStatus(computedOverrides.email)}>{statusLabels[computedOverrides.email ?? ""]}</StatusBadge></article>
            <article className="communication-template-card"><div><strong>WhatsApp</strong><span>Phone Number ID, Business Account ID, template approval, webhook</span></div><StatusBadge tone={toneForStatus(computedOverrides.whatsapp)}>{statusLabels[computedOverrides.whatsapp ?? ""]}</StatusBadge></article>
            <article className="communication-template-card"><div><strong>SMS</strong><span>Sender name, provider account, delivery readiness</span></div><StatusBadge tone={toneForStatus(computedOverrides.sms)}>{statusLabels[computedOverrides.sms ?? ""]}</StatusBadge></article>
            <article className="communication-template-card"><div><strong>Push</strong><span>Android FCM, iOS APNs, Web Push, token health</span></div><StatusBadge tone={toneForStatus(computedOverrides.push)}>{statusLabels[computedOverrides.push ?? ""]}</StatusBadge></article>
            <article className="communication-template-card"><div><strong>Camera Gateway</strong><span>{getGatewayProvider()} · RTSP server-only · playback via token</span></div><StatusBadge tone={toneForStatus(computedOverrides.camera_gateway)}>{statusLabels[computedOverrides.camera_gateway ?? ""]}</StatusBadge></article>
            <article className="communication-template-card"><div><strong>AI Provider</strong><span>Shadow mode, calibration and human review required</span></div><StatusBadge tone={toneForStatus(computedOverrides.ai_provider)}>{statusLabels[computedOverrides.ai_provider ?? ""]}</StatusBadge></article>
          </div>
        </CleanSection>

        <div id="integration-test-center">
          <AdminIntegrationsTestPanel integrations={integrations.map((item) => ({ integration_type: item.integration_type, provider: item.provider, status: item.status }))} />
        </div>

        <CleanSection title="Webhook readiness" subtitle="נקודות קצה עתידיות חייבות חתימה ולא ייפתחו בלי סוד שרת.">
          {webhookRows.length ? (
            <div className="communication-log-list">
              {webhookRows.map((row) => (
                <article className="communication-log-row" key={row.id}>
                  <div>
                    <strong>{row.webhook_key}</strong>
                    <span>{row.endpoint_path} · {row.signing_secret_env ?? "secret env required"}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(row.status)}>{statusLabels[row.status ?? ""] ?? row.status}</StatusBadge>
                </article>
              ))}
            </div>
          ) : <EmptyState title="אין רשומות Webhook עדיין" text="הריצו את מיגרציית PHASE 101 כדי להוסיף readiness." />}
        </CleanSection>

        <CleanSection title="בדיקות אחרונות" subtitle="כל הבדיקות הן mock/dry-run בלבד.">
          {testLogs.length ? (
            <div className="communication-log-list">
              {testLogs.slice(0, 12).map((log) => (
                <article className="communication-log-row" key={log.id}>
                  <div>
                    <strong>{integrationMeta[log.integration_type]?.title ?? log.integration_type} · {log.provider}</strong>
                    <span>{log.recipient_preview ?? "ללא נמען"} · {formatDate(log.completed_at ?? log.created_at)}</span>
                  </div>
                  <StatusBadge tone={String(log.status).includes("failed") ? "bad" : "good"}>{log.status ?? "sent_mock"}</StatusBadge>
                </article>
              ))}
            </div>
          ) : <EmptyState title="עוד אין בדיקות" text="הריצו בדיקה בטוחה כדי ליצור לוג אינטגרציה." />}
        </CleanSection>

        <CleanSection title="מסכים קשורים" subtitle="ניהול עמוק נשאר במסכים הייעודיים.">
          <div className="premium-action-grid">
            <ActionCard title="מרכז תקשורת" text="ספקים, תבניות ובדיקות ערוצים" href="/dashboard/admin/communications" icon={MessageCircle} />
            <ActionCard title="שרת וידאו" text="Gateway, בריאות וחיבור מצלמות" href="/dashboard/admin/video-gateway" icon={Camera} />
            <ActionCard title="אבטחה" text="סודות, RLS, גיבויים ותאימות" href="/dashboard/admin/security" icon={ShieldCheck} />
            <ActionCard title="מוכנות השקה" text="חסמים, ציון והשקה מבוקרת" href="/dashboard/admin/launch-readiness" icon={CheckCircle2} />
          </div>
        </CleanSection>

        {providerConfigs.length === 0 ? <div className="error-banner"><TriangleAlert size={16} /> מרכז התקשורת עדיין לא נטען. ודאו שמיגרציית ספקי התקשורת רצה.</div> : null}
      </div>
    </DashboardShell>
  );
}
