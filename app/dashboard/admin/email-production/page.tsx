import { AlertTriangle, CheckCircle2, Mail, MousePointerClick, RefreshCw, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ResendLiveTestButton } from "@/components/resend-live-test-button";
import { StatCard } from "@/components/stat-card";
import { AdminDataError } from "@/components/admin-data-state";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { getEmailProductionReadiness } from "@/lib/domain/email-provider";
import { createClient } from "@/lib/supabase/server";

const categoryLabels: Record<string, string> = {
  verification: "אימות",
  password_reset: "איפוס סיסמה",
  invitation: "הזמנה",
  parent_approval: "אישור הורה",
  staff_invitation: "הזמנת צוות",
  inspection_notice: "פיקוח",
  observer_notification: "תצפיתן",
  billing_readiness: "חיוב",
  report: "דוחות"
};

const statusLabels: Record<string, string> = {
  queued: "ממתין",
  sent: "נשלח",
  delivered: "נמסר",
  opened: "נפתח",
  clicked: "נלחץ",
  failed: "נכשל",
  dead_letter: "לא נשלח",
  skipped_preferences: "דולג לפי העדפות",
  deduped: "נמנע כפול",
  active: "פעיל",
  draft: "טיוטה",
  paused: "מושהה",
  disabled: "כבוי"
};

function pillForStatus(status: string) {
  if (["active", "sent", "delivered", "opened", "clicked"].includes(status)) return "pill good";
  if (["failed", "dead_letter", "disabled"].includes(status)) return "pill bad";
  return "pill warn";
}

export default async function AdminEmailProductionPage() {
  await requireRole(["admin"]);
  const readiness = getEmailProductionReadiness();
  const unavailable = { data: null, count: null, available: false };
  const result = await safeAdminData("admin-email-production", async () => {
    const supabase = await createClient();
    async function readSource<T extends { data: unknown; error: unknown; count?: number | null }>(label: string, query: () => PromiseLike<T>) {
      const source = await safeAdminData(label, async () => {
        const response = await query();
        logSupabaseError(label, response.error);
        return { data: response.error ? null : response.data, count: response.error ? null : response.count, available: !response.error };
      }, unavailable);
      return source.data;
    }
    const [templatesRes, logsRes, preferencesRes, providersRes, communicationLogsRes] = await Promise.all([
      readSource("admin-email templates", () => supabase.from("email_templates" as any).select("*").order("category").order("template_name").limit(120)),
      readSource("admin-email logs", () => supabase.from("email_delivery_logs" as any).select("*").order("created_at", { ascending: false }).limit(160)),
      readSource("admin-email preferences", () => supabase.from("email_category_preferences" as any).select("id", { count: "exact", head: true })),
      readSource("admin-email providers", () => supabase.from("email_provider_configs" as any).select("*").order("provider")),
      readSource("admin-email communication logs", () => supabase.from("communication_logs" as any).select("id, status", { count: "exact" }).eq("channel", "email").order("created_at", { ascending: false }).limit(200))
    ]);
    return { templatesRes, logsRes, preferencesRes, providersRes, communicationLogsRes };
  }, { templatesRes: unavailable, logsRes: unavailable, preferencesRes: unavailable, providersRes: unavailable, communicationLogsRes: unavailable });
  const { templatesRes, logsRes, preferencesRes, providersRes, communicationLogsRes } = result.data;

  const templates = (templatesRes.data ?? []) as any[];
  const logs = (logsRes.data ?? []) as any[];
  const communicationLogs = (communicationLogsRes.data ?? []) as any[];
  const providers = (providersRes.data ?? []) as any[];
  const activeTemplates = templates.filter((template) => template.status === "active").length;
  const queued = logs.filter((log) => log.status === "queued").length;
  const delivered = logs.filter((log) => ["delivered", "opened", "clicked"].includes(log.status)).length;
  const opened = logs.filter((log) => log.status === "opened" || log.opened_at).length;
  const clicked = logs.filter((log) => log.status === "clicked" || log.clicked_at).length;
  const failed = logs.filter((log) => ["failed", "dead_letter"].includes(log.status)).length + communicationLogs.filter((log) => log.status === "failed").length;
  const retryScheduled = logs.filter((log) => log.next_retry_at && log.status === "failed").length;

  return (
    <DashboardShell role="admin" title="Email Production">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Email Production Readiness</p>
          <h1>תשתית אימייל מוכנה להפעלה מבוקרת.</h1>
          <p>תבניות, תור שליחה, סטטוסי מסירה, פתיחות, לחיצות וכשלונות מחוברים לספק הפעיל.</p>
        </div>
        <span className={readiness.canSendRealMessages ? "pill good" : "pill warn"}><Mail size={16} /> {readiness.canSendRealMessages ? "Production פעיל" : readiness.configured ? "ממתין להפעלה" : "Mock בלבד"}</span>
      </div>

      <section className="status-banner sms-readiness-banner">
        <div>
          <strong>{readiness.summary}</strong>
          <span>{readiness.missing.length ? `חסר: ${readiness.missing.join(", ")}` : "הספק מוגדר ומאושר לשליחה חיה."}</span>
        </div>
        <span className={readiness.canSendRealMessages ? "pill good" : "pill warn"}>{readiness.canSendRealMessages ? "Real email enabled" : "Real email disabled"}</span>
      </section>

      <ResendLiveTestButton enabled={readiness.canSendRealMessages} />

      <div className="grid cols-4 dashboard-kpis">
        <StatCard label="תבניות" value={templatesRes.available ? templates.length : "לא זמין"} tone={templatesRes.available ? templates.length ? "good" : "warn" : "default"} />
        <StatCard label="פעילות" value={templatesRes.available ? activeTemplates : "לא זמין"} tone={templatesRes.available ? activeTemplates ? "good" : "warn" : "default"} />
        <StatCard label="בתור" value={logsRes.available ? queued : "לא זמין"} tone={logsRes.available ? queued ? "warn" : "good" : "default"} />
        <StatCard label="נמסר" value={logsRes.available ? delivered : "לא זמין"} tone={logsRes.available ? "good" : "default"} />
        <StatCard label="נפתח" value={logsRes.available ? opened : "לא זמין"} tone={logsRes.available ? "good" : "default"} />
        <StatCard label="נלחץ" value={logsRes.available ? clicked : "לא זמין"} tone={logsRes.available ? "good" : "default"} />
        <StatCard label="כשלונות" value={logsRes.available && communicationLogsRes.available ? failed : "לא זמין"} tone={logsRes.available && communicationLogsRes.available ? failed ? "bad" : "good" : "default"} />
        <StatCard label="Retry מתוזמן" value={logsRes.available ? retryScheduled : "לא זמין"} tone={logsRes.available ? retryScheduled ? "warn" : "good" : "default"} />
      </div>
      <AdminDataError message={result.error ?? (Object.values(result.data).some((source) => !source.available) ? "לא ניתן לטעון חלק מנתוני האימייל כרגע" : null)} />

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><ShieldCheck size={20} /> מוכנות ספק</h2><p>Resend, SendGrid ו-Amazon SES דרך שכבה אחת.</p></div>
          <div className="risk-list">
            <div>{readiness.configured ? <CheckCircle2 /> : <AlertTriangle />} {readiness.provider} <b>{readiness.configured ? "מוגדר" : "מצב בדיקה"}</b></div>
            <div><CheckCircle2 /> תור שליחה <b>מוכן</b></div>
            <div><RefreshCw /> Retry / Dead letter <b>מוכן</b></div>
            <div><MousePointerClick /> Open / Click tracking <b>מוכן במודל</b></div>
            <div>{readiness.canSendRealMessages ? <CheckCircle2 /> : <AlertTriangle />} Real send <b>{readiness.canSendRealMessages ? "פעיל" : "ממתין להפעלה"}</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><Mail size={20} /> קטגוריות אימייל</h2><p>תבניות מוכנות לאירועים מרכזיים.</p></div>
          <div className="tag-cloud">{Object.values(categoryLabels).map((label) => <span key={label}>{label}</span>)}</div>
          <p className="muted">העדפות קטגוריה: {preferencesRes.available ? preferencesRes.count ?? 0 : "לא זמין"} · ספקים במסד: {providersRes.available ? providers.length : "לא זמין"}</p>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>תבניות אימייל</h2><p>נושא, תוכן טקסט ותוכן HTML מוכנים לשליחה עתידית.</p></div>
        {!templatesRes.available ? <div className="empty-state"><strong>נתוני תבניות האימייל אינם זמינים</strong><span>לא ניתן לקבוע את מלאי התבניות כרגע.</span></div> : templates.length === 0 ? <div className="empty-state"><strong>אין תבניות אימייל להצגה</strong><span>לאחר הרצת המיגרציה תבניות הבסיס יופיעו כאן.</span></div> : <div className="procedure-list">{templates.map((template) => (
          <article className="card procedure-card" key={template.id}>
            <div>
              <span className={pillForStatus(template.status)}>{statusLabels[template.status] ?? template.status}</span>
              <h3>{template.subject_template}</h3>
              <p>{template.body_text_template}</p>
            </div>
            <div className="procedure-meta">
              <span>{categoryLabels[template.category] ?? template.category}</span>
              <span>{template.language}</span>
              <span>{Array.isArray(template.variables) ? template.variables.length : 0} משתנים</span>
            </div>
          </article>
        ))}</div>}
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>לוג אימייל</h2><p>queued / sent / delivered / opened / clicked / failed נשמרים כאן ומעודכנים מ-webhook חתום.</p></div>
        {!logsRes.available ? <div className="empty-state"><strong>נתוני לוג האימייל אינם זמינים</strong><span>לא ניתן לקבוע סטטוסי מסירה כרגע.</span></div> : logs.length === 0 ? <div className="empty-state"><strong>אין אימיילים בתור עדיין</strong><span>כאשר הודעת אימייל תיווצר במצב בדיקה, היא תופיע כאן.</span></div> : <div className="procedure-list">{logs.map((log) => (
          <article className="card procedure-card" key={log.id}>
            <div>
              <span className={pillForStatus(log.status)}>{statusLabels[log.status] ?? log.status}</span>
              <h3>{log.subject_preview ?? "אימייל"}</h3>
              <p>{log.failure_reason ?? log.message_preview ?? "ללא תוכן"}</p>
            </div>
            <div className="procedure-meta">
              <span>{log.provider}</span>
              <span>{categoryLabels[log.category] ?? log.category ?? "כללי"}</span>
              <span>{log.next_retry_at ? `Retry: ${new Date(log.next_retry_at).toLocaleString("he-IL")}` : ""}</span>
            </div>
          </article>
        ))}</div>}
      </section>
    </DashboardShell>
  );
}
