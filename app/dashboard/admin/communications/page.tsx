import Link from "next/link";
import { Bell, CheckCircle2, Mail, MessageCircle, Smartphone, TriangleAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminCommunicationsTestPanel } from "@/components/admin-communications-test-panel";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Channel = "whatsapp" | "sms" | "email" | "push";

type ProviderConfig = {
  id: string;
  channel: Channel;
  provider: string;
  display_name?: string | null;
  status?: string | null;
  mode?: string | null;
  enabled?: boolean | null;
  sender_name?: string | null;
  sender_email?: string | null;
  sender_phone?: string | null;
  environment?: string | null;
  domain_verification_status?: string | null;
  credentials_configured?: boolean | null;
  webhook_configured?: boolean | null;
  last_tested_at?: string | null;
  last_error?: string | null;
};

type TemplateRow = {
  id: string;
  channel: Channel;
  template_kind: string;
  template_name?: string | null;
  display_name?: string | null;
  status?: string | null;
  approval_status?: string | null;
  active?: boolean | null;
  provider?: string | null;
};

type TestLog = {
  id: string;
  channel: Channel;
  provider?: string | null;
  template_kind?: string | null;
  status?: string | null;
  recipient_preview?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
};

const channelMeta: Record<Channel, { label: string; title: string; icon: typeof MessageCircle; href: string }> = {
  whatsapp: { label: "WhatsApp", title: "WhatsApp Business", icon: MessageCircle, href: "/dashboard/admin/whatsapp" },
  sms: { label: "SMS", title: "SMS", icon: Smartphone, href: "/dashboard/admin/sms" },
  email: { label: "Email", title: "Email", icon: Mail, href: "/dashboard/admin/email-production" },
  push: { label: "Push", title: "Push", icon: Bell, href: "/dashboard/admin/push-production" }
};

const statusLabels: Record<string, string> = {
  not_configured: "לא מוגדר",
  configured: "מוגדר",
  testing: "בבדיקה",
  active: "פעיל",
  disabled: "כבוי",
  draft: "טיוטה",
  approved: "מאושר",
  pending: "ממתין",
  rejected: "נדחה",
  not_required: "לא נדרש"
};

const successStatuses = new Set(["sent", "sent_mock", "delivered", "read", "opened", "clicked", "queued_mock", "sent_dry_run"]);
const failureStatuses = new Set(["failed", "failed_mock", "failed_dry_run", "dead_letter", "bounced", "rejected", "delivery_failed"]);

function toneForStatus(status?: string | null): "good" | "warn" | "bad" | "default" {
  if (status === "active" || status === "configured" || status === "approved") return "good";
  if (status === "testing" || status === "draft" || status === "pending" || status === "not_configured") return "warn";
  if (status === "disabled" || status === "rejected") return "bad";
  return "default";
}

function formatDate(value?: string | null) {
  if (!value) return "עדיין לא";
  return new Date(value).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

function latestStatus(providers: ProviderConfig[]) {
  if (providers.some((provider) => provider.status === "active")) return "active";
  if (providers.some((provider) => provider.status === "testing")) return "testing";
  if (providers.some((provider) => provider.status === "configured" || provider.credentials_configured)) return "configured";
  if (providers.every((provider) => provider.status === "disabled")) return "disabled";
  return "not_configured";
}

function countByStatus(rows: Array<{ status?: string | null }>) {
  const total = rows.length;
  const failures = rows.filter((row) => failureStatuses.has(row.status ?? "")).length;
  const successes = rows.filter((row) => successStatuses.has(row.status ?? "")).length;
  const successRate = total ? Math.round((successes / total) * 100) : 100;
  return { total, failures, successes, successRate };
}

async function safeQuery<T>(promise: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>, label: string): Promise<T[]> {
  const result = await promise;
  if (result.error) console.error(`[admin-communications] ${label}`, { error: result.error.message });
  return result.data ?? [];
}

export default async function AdminCommunicationsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const [
    providers,
    templates,
    testLogs,
    whatsAppLogs,
    smsLogs,
    emailLogs,
    pushLogs
  ] = await Promise.all([
    safeQuery<ProviderConfig>(supabase.from("communication_provider_configs" as any).select("*").order("channel").order("provider"), "providers"),
    safeQuery<TemplateRow>(supabase.from("real_communication_templates" as any).select("*").order("channel").order("template_kind"), "templates"),
    safeQuery<TestLog>(supabase.from("communication_test_logs" as any).select("*").order("created_at", { ascending: false }).limit(40), "tests"),
    safeQuery<any>(supabase.from("whatsapp_message_logs" as any).select("id,status,provider,created_at").order("created_at", { ascending: false }).limit(250), "whatsapp logs"),
    safeQuery<any>(supabase.from("sms_message_logs" as any).select("id,status,provider,created_at").order("created_at", { ascending: false }).limit(250), "sms logs"),
    safeQuery<any>(supabase.from("email_delivery_logs" as any).select("id,status,provider,created_at").order("created_at", { ascending: false }).limit(250), "email logs"),
    safeQuery<any>(supabase.from("push_notification_logs" as any).select("id,status,provider,created_at").order("created_at", { ascending: false }).limit(250), "push logs")
  ]);

  const logsByChannel: Record<Channel, Array<{ status?: string | null }>> = {
    whatsapp: [...whatsAppLogs, ...testLogs.filter((log) => log.channel === "whatsapp")],
    sms: [...smsLogs, ...testLogs.filter((log) => log.channel === "sms")],
    email: [...emailLogs, ...testLogs.filter((log) => log.channel === "email")],
    push: [...pushLogs, ...testLogs.filter((log) => log.channel === "push")]
  };

  const channelCards = (Object.keys(channelMeta) as Channel[]).map((channel) => {
    const channelProviders = providers.filter((provider) => provider.channel === channel);
    const channelTemplates = templates.filter((template) => template.channel === channel);
    const stats = countByStatus(logsByChannel[channel]);
    return {
      channel,
      providers: channelProviders,
      templates: channelTemplates,
      stats,
      status: latestStatus(channelProviders)
    };
  });

  const totalDeliveries = channelCards.reduce((sum, item) => sum + item.stats.total, 0);
  const totalFailures = channelCards.reduce((sum, item) => sum + item.stats.failures, 0);
  const activeChannels = channelCards.filter((item) => item.status === "active" || item.status === "configured" || item.status === "testing").length;
  const templatesReady = templates.filter((template) => template.active || template.status === "active" || template.status === "configured").length;
  const templateKinds = Array.from(new Set(templates.map((template) => template.template_kind))).sort();

  return (
    <DashboardShell role="admin" title="מרכז תקשורת">
      <div className="commercial-dashboard communications-dashboard">
        <PremiumDashboardHero
          eyebrow="תקשורת"
          title="מרכז ספקים ושליחה"
          subtitle="WhatsApp, SMS, Email ו-Push מוכנים להפעלה מבוקרת. כרגע בדיקות נשארות במצב mock."
          badge="Mock בטוח"
          badgeTone="warn"
          actions={<><Link className="button primary" href="#communication-test-center">בדיקת ערוץ</Link><Link className="button secondary" href="/dashboard/admin/communication">לוג ישן</Link></>}
        />

        <div className="premium-metric-grid">
          <RoleMetricCard label="ערוצים מוכנים" value={`${activeChannels}/4`} hint="מוגדר, בבדיקה או פעיל" tone={activeChannels >= 4 ? "good" : "warn"} />
          <RoleMetricCard label="תבניות" value={templates.length} hint={`${templatesReady} מוכנות`} tone={templatesReady ? "good" : "warn"} />
          <RoleMetricCard label="מסירות" value={totalDeliveries} hint="כולל בדיקות mock" />
          <RoleMetricCard label="כשלים" value={totalFailures} hint="לטיפול לפני הפעלה" tone={totalFailures ? "bad" : "good"} />
        </div>

        <CleanSection title="סטטוס ערוצים" subtitle="כל ערוץ מציג ספקים, תבניות ומדדי מסירה.">
          <div className="communication-channel-grid">
            {channelCards.map((item) => {
              const meta = channelMeta[item.channel];
              const Icon = meta.icon;
              return (
                <article className="communication-channel-card" key={item.channel}>
                  <div className="communication-channel-head">
                    <span className="communication-channel-icon"><Icon size={22} /></span>
                    <div>
                      <h3>{meta.title}</h3>
                      <p>{item.providers.length} ספקים · {item.templates.length} תבניות</p>
                    </div>
                    <StatusBadge tone={toneForStatus(item.status)}>{statusLabels[item.status] ?? item.status}</StatusBadge>
                  </div>
                  <div className="communication-provider-list">
                    {item.providers.slice(0, 4).map((provider) => (
                      <div className="communication-provider-row" key={provider.id ?? `${provider.channel}-${provider.provider}`}>
                        <div>
                          <strong>{provider.display_name ?? provider.provider}</strong>
                          <span>{provider.mode === "real" ? "שליחה אמיתית" : provider.mode === "dry_run" ? "בדיקה יבשה" : "mock"}</span>
                        </div>
                        <StatusBadge tone={toneForStatus(provider.status)}>{statusLabels[provider.status ?? ""] ?? provider.status ?? "לא מוגדר"}</StatusBadge>
                      </div>
                    ))}
                  </div>
                  <div className="communication-stats-row">
                    <span><CheckCircle2 size={16} /> {item.stats.successRate}% הצלחה</span>
                    <span><TriangleAlert size={16} /> {item.stats.failures} כשלים</span>
                  </div>
                  <Link className="button secondary" href={meta.href}>ניהול {meta.label}</Link>
                </article>
              );
            })}
          </div>
        </CleanSection>

        <CleanSection title="תבניות מוצר" subtitle="תבניות קצרות לכל מסע משתמש מרכזי.">
          {templates.length ? (
            <div className="communication-template-grid">
              {templates.slice(0, 16).map((template) => (
                <article className="communication-template-card" key={template.id}>
                  <div>
                    <strong>{template.display_name ?? template.template_name ?? template.template_kind}</strong>
                    <span>{channelMeta[template.channel].label} · {template.provider ?? "כל ספק"}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(template.status)}>{statusLabels[template.status ?? ""] ?? template.status ?? "טיוטה"}</StatusBadge>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="אין תבניות עדיין" text="המיגרציה מוסיפה תבניות בסיס לכל הערוצים." />
          )}
        </CleanSection>

        <div id="communication-test-center">
          <AdminCommunicationsTestPanel
            providers={providers.map((provider) => ({
              channel: provider.channel,
              provider: provider.provider,
              display_name: provider.display_name,
              status: provider.status
            }))}
            templates={templateKinds.length ? templateKinds : ["welcome", "password_reset", "kindergarten_approval", "correction_required", "onboarding_completed", "parent_invitation", "staff_invitation", "alerts"]}
          />
        </div>

        <CleanSection title="בדיקות אחרונות" subtitle="אין חשיפת סיסמאות או שליחה אמיתית במסך הזה.">
          {testLogs.length ? (
            <div className="communication-log-list">
              {testLogs.slice(0, 10).map((log) => (
                <article className="communication-log-row" key={log.id}>
                  <div>
                    <strong>{channelMeta[log.channel].label} · {log.template_kind ?? "בדיקה"}</strong>
                    <span>{log.provider ?? "mock"} · {log.recipient_preview ?? "נמען מוסתר"}</span>
                  </div>
                  <div>
                    <StatusBadge tone={log.status?.includes("failed") ? "bad" : "good"}>{log.status?.includes("failed") ? "נכשל" : "נשמר"}</StatusBadge>
                    <small>{formatDate(log.completed_at ?? log.created_at)}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="עוד אין בדיקות" text="בחרו ערוץ והריצו בדיקה בטוחה כדי לראות כאן לוג." />
          )}
        </CleanSection>

        <CleanSection title="הגדרות מתקדמות" subtitle="מסכים קיימים לניהול עמוק של כל ערוץ.">
          <div className="premium-action-grid">
            <ActionCard title="WhatsApp" text="Meta Cloud API, Twilio ותבניות" href="/dashboard/admin/whatsapp" icon={MessageCircle} />
            <ActionCard title="SMS" text="Twilio, MessageBird, Vonage וספק מקומי" href="/dashboard/admin/sms" icon={Smartphone} />
            <ActionCard title="Email" text="Resend, SendGrid ו-AWS SES" href="/dashboard/admin/email-production" icon={Mail} />
            <ActionCard title="Push" text="FCM, APNs ו-Web Push" href="/dashboard/admin/push-production" icon={Bell} />
          </div>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
