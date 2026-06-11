import Link from "next/link";
import {
  Bell,
  Bot,
  CheckCircle2,
  Mail,
  MessageCircle,
  MessageSquareText,
  RadioTower,
  Search,
  Send,
  ShieldAlert,
  Smartphone,
  TriangleAlert,
  UsersRound
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminCommunicationsTestPanel } from "@/components/admin-communications-test-panel";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Channel = "whatsapp" | "sms" | "email" | "push";
type ProviderConfig = { id: string; channel: Channel; provider: string; display_name?: string | null; status?: string | null; mode?: string | null; credentials_configured?: boolean | null };
type TemplateRow = { id: string; channel: Channel; template_kind: string; template_name?: string | null; display_name?: string | null; status?: string | null; active?: boolean | null; provider?: string | null };
type TestLog = { id: string; channel: Channel; provider?: string | null; template_kind?: string | null; status?: string | null; recipient_preview?: string | null; created_at?: string | null; completed_at?: string | null };
type ThreadRow = { id: string; subject: string; thread_type?: string | null; priority?: string | null; status?: string | null; last_message_at?: string | null; created_at?: string | null; gardens?: { name?: string | null; city?: string | null } | null; child_id?: string | null };

const channelMeta: Record<Channel, { label: string; title: string; icon: typeof MessageCircle; href: string }> = {
  whatsapp: { label: "WhatsApp", title: "WhatsApp", icon: MessageCircle, href: "/dashboard/admin/whatsapp" },
  sms: { label: "SMS", title: "מסרונים", icon: Smartphone, href: "/dashboard/admin/sms" },
  email: { label: "Email", title: "מייל", icon: Mail, href: "/dashboard/admin/email-production" },
  push: { label: "Push", title: "התראות", icon: Bell, href: "/dashboard/admin/push-production" }
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
  open: "פתוח",
  pending_response: "ממתין לתגובה",
  waiting_review: "ממתין לבדיקה",
  resolved: "טופל",
  closed: "נסגר",
  archived: "בארכיון",
  sent: "נשלח",
  delivered: "נמסר",
  read: "נקרא",
  failed: "נכשל"
};

const successStatuses = new Set(["sent", "sent_mock", "delivered", "read", "opened", "clicked", "queued_mock", "sent_dry_run"]);
const failureStatuses = new Set(["failed", "failed_mock", "failed_dry_run", "dead_letter", "bounced", "rejected", "delivery_failed"]);

function toneForStatus(status?: string | null): "good" | "warn" | "bad" | "default" {
  if (["active", "configured", "approved", "delivered", "read", "resolved", "closed"].includes(String(status))) return "good";
  if (["testing", "draft", "pending", "not_configured", "open", "pending_response", "waiting_review"].includes(String(status))) return "warn";
  if (["disabled", "rejected", "failed", "delivery_failed", "dead_letter"].includes(String(status))) return "bad";
  return "default";
}

function priorityTone(priority?: string | null): "good" | "warn" | "bad" | "default" {
  if (priority === "critical" || priority === "urgent") return "bad";
  if (priority === "important") return "warn";
  if (priority === "informational") return "good";
  return "default";
}

function formatDate(value?: string | null) {
  if (!value) return "לא עודכן";
  return new Date(value).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

function threadTypeLabel(value?: string | null) {
  const map: Record<string, string> = {
    parent_kindergarten: "הורה וגן",
    parent_manager: "הורה ומנהלת",
    staff_manager: "צוות ומנהלת",
    inspector_kindergarten: "פקח וגן",
    admin_user: "אדמין ומשתמש",
    complaint: "תלונה",
    inspection: "פיקוח",
    document_request: "בקשת מסמך",
    emergency: "חירום",
    general: "כללי"
  };
  return map[String(value ?? "")] ?? "שיחה";
}

function latestStatus(providers: ProviderConfig[]) {
  if (providers.some((provider) => provider.status === "active")) return "active";
  if (providers.some((provider) => provider.status === "testing")) return "testing";
  if (providers.some((provider) => provider.status === "configured" || provider.credentials_configured)) return "configured";
  if (providers.length && providers.every((provider) => provider.status === "disabled")) return "disabled";
  return "not_configured";
}

function countByStatus(rows: Array<{ status?: string | null }>) {
  const total = rows.length;
  const failures = rows.filter((row) => failureStatuses.has(row.status ?? "")).length;
  const successes = rows.filter((row) => successStatuses.has(row.status ?? "")).length;
  return { total, failures, successes, successRate: total ? Math.round((successes / total) * 100) : 100 };
}

async function safeQuery<T>(promise: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>, label: string): Promise<T[]> {
  const result = await promise;
  if (result.error) console.error(`[admin-communications] ${label}`, { error: result.error.message });
  return result.data ?? [];
}

export default async function AdminCommunicationsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const [providers, templates, testLogs, deliveryEvents, threads, messages, notifications, parentRequests, whatsAppLogs, smsLogs, emailLogs, pushLogs] = await Promise.all([
    safeQuery<ProviderConfig>(supabase.from("communication_provider_configs" as any).select("*").order("channel").order("provider"), "providers"),
    safeQuery<TemplateRow>(supabase.from("real_communication_templates" as any).select("*").order("channel").order("template_kind"), "templates"),
    safeQuery<TestLog>(supabase.from("communication_test_logs" as any).select("*").order("created_at", { ascending: false }).limit(40), "tests"),
    safeQuery<any>(supabase.from("communication_delivery_events" as any).select("*").order("created_at", { ascending: false }).limit(180), "delivery events"),
    safeQuery<ThreadRow>(supabase.from("communication_threads" as any).select("id,subject,thread_type,priority,status,last_message_at,created_at,child_id,gardens(name,city)").order("last_message_at", { ascending: false, nullsFirst: false }).limit(80), "threads"),
    safeQuery<any>(supabase.from("messages" as any).select("id,garden_id,thread_id,subject,status,priority,read_at,treatment_status,response_required,created_at,sender:sender_id(full_name,role),recipient:recipient_id(full_name,role),gardens(name,city)").order("created_at", { ascending: false }).limit(120), "messages"),
    safeQuery<any>(supabase.from("notifications" as any).select("id,status,channel,recipient_role,read_at,title,created_at,severity").order("created_at", { ascending: false }).limit(120), "notifications"),
    safeQuery<any>(supabase.from("parent_child_requests" as any).select("id,request_type,status,created_at,recipient_role,recipient_label").order("created_at", { ascending: false }).limit(80), "parent requests"),
    safeQuery<any>(supabase.from("whatsapp_message_logs" as any).select("id,status,provider,created_at").order("created_at", { ascending: false }).limit(250), "whatsapp logs"),
    safeQuery<any>(supabase.from("sms_message_logs" as any).select("id,status,provider,created_at").order("created_at", { ascending: false }).limit(250), "sms logs"),
    safeQuery<any>(supabase.from("email_delivery_logs" as any).select("id,status,provider,created_at").order("created_at", { ascending: false }).limit(250), "email logs"),
    safeQuery<any>(supabase.from("push_notification_logs" as any).select("id,status,provider,created_at").order("created_at", { ascending: false }).limit(250), "push logs")
  ]);

  const logsByChannel: Record<Channel, Array<{ status?: string | null }>> = {
    whatsapp: [...whatsAppLogs, ...testLogs.filter((log) => log.channel === "whatsapp"), ...deliveryEvents.filter((event) => event.channel === "whatsapp")],
    sms: [...smsLogs, ...testLogs.filter((log) => log.channel === "sms"), ...deliveryEvents.filter((event) => event.channel === "sms")],
    email: [...emailLogs, ...testLogs.filter((log) => log.channel === "email"), ...deliveryEvents.filter((event) => event.channel === "email")],
    push: [...pushLogs, ...testLogs.filter((log) => log.channel === "push"), ...deliveryEvents.filter((event) => event.channel === "push")]
  };
  const channelCards = (Object.keys(channelMeta) as Channel[]).map((channel) => {
    const channelProviders = providers.filter((provider) => provider.channel === channel);
    const channelTemplates = templates.filter((template) => template.channel === channel);
    const stats = countByStatus(logsByChannel[channel]);
    return { channel, providers: channelProviders, templates: channelTemplates, stats, status: latestStatus(channelProviders) };
  });

  const fallbackConversations = messages.filter((message) => !message.thread_id).slice(0, 20);
  const activeThreads = threads.filter((thread) => !["closed", "resolved", "archived"].includes(String(thread.status)));
  const pendingMessages = messages.filter((message) => ["unread", "pending", "open"].includes(String(message.status)) || message.response_required || message.treatment_status === "open");
  const unreadMessages = messages.filter((message) => !message.read_at || message.status === "unread").length + notifications.filter((notification) => !notification.read_at).length;
  const deliveryFailures = channelCards.reduce((sum, item) => sum + item.stats.failures, 0) + deliveryEvents.filter((event) => failureStatuses.has(event.status)).length;
  const totalDeliveries = channelCards.reduce((sum, item) => sum + item.stats.total, 0) + deliveryEvents.length;
  const activeChannels = channelCards.filter((item) => ["active", "configured", "testing"].includes(item.status)).length;
  const templatesReady = templates.filter((template) => template.active || template.status === "active" || template.status === "configured").length;
  const responseRate = messages.length ? Math.round((messages.filter((message) => ["handled", "closed", "resolved"].includes(String(message.treatment_status))).length / messages.length) * 100) : 100;
  const templateKinds = Array.from(new Set(templates.map((template) => template.template_kind))).sort();
  const unifiedInbox = [
    ...activeThreads.map((thread) => ({ id: thread.id, title: thread.subject, body: `${threadTypeLabel(thread.thread_type)} · ${thread.gardens?.name ?? "כללי"}`, priority: thread.priority, status: thread.status, href: "/dashboard/admin/communication", time: thread.last_message_at ?? thread.created_at })),
    ...fallbackConversations.map((message) => ({ id: message.id, title: message.subject, body: `${message.sender?.full_name ?? "שולח"} אל ${message.recipient?.full_name ?? "נמען"} · ${message.gardens?.name ?? ""}`, priority: message.priority, status: message.status, href: "/dashboard/admin/communication", time: message.created_at })),
    ...parentRequests.slice(0, 12).map((request) => ({ id: request.id, title: request.request_type ?? "פניית הורה", body: request.recipient_label ?? request.recipient_role ?? "נמען", priority: "important", status: request.status, href: "/dashboard/admin/complaints", time: request.created_at }))
  ].sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime()).slice(0, 14);

  return (
    <DashboardShell role="admin" title="מרכז תקשורת">
      <div className="communications-network-2">
        <PremiumDashboardHero
          eyebrow="רשת תקשורת"
          title="כל השיחות והערוצים במקום אחד"
          subtitle="הודעות בתוך המערכת, מייל, מסרונים, WhatsApp והתראות לנייד מחוברים לשכבת תקשורת אחת עם היסטוריה, תבניות, עדיפויות ואישור אנושי."
          badge={`${activeThreads.length + fallbackConversations.length} שיחות`}
          badgeTone={deliveryFailures ? "warn" : "good"}
          actions={<><Link className="button primary" href="#communication-test-center">בדיקת שליחה</Link><Link className="button secondary" href="/dashboard/admin/communication">לוג שיחות</Link></>}
        >
          <RadioTower size={46} />
        </PremiumDashboardHero>

        <section className="communications-kpi-grid">
          <RoleMetricCard label="שיחות פעילות" value={activeThreads.length + fallbackConversations.length} hint="כולל הודעות קיימות" tone="good" />
          <RoleMetricCard label="ממתין לטיפול" value={pendingMessages.length} hint="הודעות ופניות" tone={pendingMessages.length ? "warn" : "good"} />
          <RoleMetricCard label="לא נקרא" value={unreadMessages} hint="הודעות והתראות" tone={unreadMessages ? "warn" : "good"} />
          <RoleMetricCard label="כשלי מסירה" value={deliveryFailures} hint="כל הערוצים" tone={deliveryFailures ? "bad" : "good"} />
          <RoleMetricCard label="ערוצים מוכנים" value={`${activeChannels}/4`} hint="מוגדרים או בבדיקה" tone={activeChannels >= 4 ? "good" : "warn"} />
          <RoleMetricCard label="שיעור תגובה" value={`${responseRate}%`} hint="שיחות שטופלו" tone={responseRate >= 80 ? "good" : "warn"} />
        </section>

        <section className="communications-layout">
          <CleanSection title="תיבת תקשורת אחודה" subtitle="הורה, צוות, מנהלת, פקח ואדמין באותה רשימת עבודה.">
            {unifiedInbox.length ? <div className="unified-inbox-list">{unifiedInbox.map((item) => <Link href={item.href} key={`${item.href}-${item.id}`}><StatusBadge tone={priorityTone(item.priority)}>{item.priority === "critical" ? "קריטי" : item.priority === "urgent" ? "דחוף" : item.priority === "important" ? "חשוב" : "מידע"}</StatusBadge><div><strong>{item.title}</strong><span>{item.body}</span><small>{formatDate(item.time)}</small></div><StatusBadge tone={toneForStatus(item.status)}>{statusLabels[item.status ?? ""] ?? statusLabels.open}</StatusBadge></Link>)}</div> : <EmptyState title="אין שיחות פעילות" text="שיחות ופניות מכל הערוצים יופיעו כאן." />}
          </CleanSection>

          <CleanSection title="ניתוב והתראות" subtitle="מי מקבל, באיזה ערוץ ובאיזו עדיפות.">
            <div className="routing-engine-grid">
              <article><UsersRound /><strong>נמענים</strong><span>הורים, צוות, מנהלות, פקחים ואדמין</span></article>
              <article><Send /><strong>ערוצים</strong><span>בתוך המערכת, מייל, SMS, WhatsApp ו-Push</span></article>
              <article><ShieldAlert /><strong>עדיפות</strong><span>מידע, חשוב, דחוף, קריטי</span></article>
              <article><Bot /><strong>עוזר תקשורת</strong><span>סיכום, ניסוח, סיווג ותיעדוף באישור אדם</span></article>
            </div>
          </CleanSection>
        </section>

        <CleanSection title="ערוצי מסירה" subtitle="שכבת מסירה אחת עם ספקים שונים.">
          <div className="communication-channel-grid">
            {channelCards.map((item) => {
              const meta = channelMeta[item.channel];
              const Icon = meta.icon;
              return (
                <article className="communication-channel-card" key={item.channel}>
                  <div className="communication-channel-head">
                    <span className="communication-channel-icon"><Icon size={22} /></span>
                    <div><h3>{meta.title}</h3><p>{item.providers.length} ספקים · {item.templates.length} תבניות</p></div>
                    <StatusBadge tone={toneForStatus(item.status)}>{statusLabels[item.status] ?? item.status}</StatusBadge>
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

        <section className="communications-layout">
          <CleanSection title="תבניות תקשורת" subtitle="מסעות מוכנים לשליחה מבוקרת.">
            {templates.length ? <div className="communication-template-grid">{templates.slice(0, 14).map((template) => <article className="communication-template-card" key={template.id}><div><strong>{template.display_name ?? template.template_name ?? template.template_kind}</strong><span>{channelMeta[template.channel].label} · {template.provider ?? "כל ספק"}</span></div><StatusBadge tone={toneForStatus(template.status)}>{statusLabels[template.status ?? ""] ?? template.status ?? "טיוטה"}</StatusBadge></article>)}</div> : <EmptyState title="אין תבניות עדיין" text="תבניות onboarding, פיקוח, מסמכים, תשלומים ובטיחות יופיעו כאן." />}
          </CleanSection>

          <CleanSection title="אנליטיקה" subtitle="ביצועי תקשורת בלי לחשוף סודות או סיסמאות.">
            <div className="communication-analytics-grid">
              <span>מסירות <b>{totalDeliveries}</b></span>
              <span>כשלים <b>{deliveryFailures}</b></span>
              <span>תבניות מוכנות <b>{templatesReady}</b></span>
              <span>שיעור תגובה <b>{responseRate}%</b></span>
              <span>בדיקות אחרונות <b>{testLogs.length}</b></span>
              <span>ערוצי שליחה <b>{activeChannels}/4</b></span>
            </div>
          </CleanSection>
        </section>

        <div id="communication-test-center">
          <AdminCommunicationsTestPanel
            providers={providers.map((provider) => ({ channel: provider.channel, provider: provider.provider, display_name: provider.display_name, status: provider.status }))}
            templates={templateKinds.length ? templateKinds : ["onboarding", "inspection_notice", "compliance_alert", "document_reminder", "payment_reminder", "safety_notification"]}
          />
        </div>

        <CleanSection title="מצבי תקשורת" subtitle="חוויות קיימות שמתחברות לרשת אחת.">
          <div className="premium-action-grid">
            <ActionCard title="הורים" text="שיחות, מסמכים, אישורים ותמונות" href="/dashboard/parent/messages" icon={MessageCircle} />
            <ActionCard title="צוות" text="הודעות מנהלת, צוות וחירום" href="/dashboard/staff/messages" icon={MessageSquareText} />
            <ActionCard title="מנהלת" text="הורים, צוות, תלונות ופיקוח" href="/dashboard/garden/communication" icon={UsersRound} />
            <ActionCard title="פקחים" text="תלונות, פיקוח ופעולות תיקון" href="/dashboard/inspector/reports" icon={ShieldAlert} />
            <ActionCard title="חירום" text="התראות דחופות לכל ערוץ" href="/dashboard/admin/notifications" icon={Bell} tone="warn" />
            <ActionCard title="חיפוש" text="שיחות, נמענים ותבניות" href="/dashboard/admin/search" icon={Search} />
          </div>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
