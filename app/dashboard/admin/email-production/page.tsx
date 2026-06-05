import { AlertTriangle, CheckCircle2, Mail, MousePointerClick, RefreshCw, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
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
  const supabase = await createClient();
  const readiness = getEmailProductionReadiness();
  const [templatesRes, logsRes, preferencesRes, providersRes, communicationLogsRes] = await Promise.all([
    supabase.from("email_templates" as any).select("*").order("category").order("template_name").limit(120),
    supabase.from("email_delivery_logs" as any).select("*").order("created_at", { ascending: false }).limit(160),
    supabase.from("email_category_preferences" as any).select("id", { count: "exact", head: true }),
    supabase.from("email_provider_configs" as any).select("*").order("provider"),
    supabase.from("communication_logs" as any).select("id, status", { count: "exact" }).eq("channel", "email").order("created_at", { ascending: false }).limit(200)
  ]);

  if (templatesRes.error) console.error("[admin-email-production] templates failed", { error: templatesRes.error.message });
  if (logsRes.error) console.error("[admin-email-production] logs failed", { error: logsRes.error.message });

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
          <p>תבניות, תור שליחה, סטטוסי מסירה, פתיחות, לחיצות וכשלונות מוכנים. שליחת אימייל אמיתית עדיין כבויה בכוונה.</p>
        </div>
        <span className={readiness.configured ? "pill warn" : "pill good"}><Mail size={16} /> {readiness.mode === "dry_run" ? "Dry-run בלבד" : "Mock בלבד"}</span>
      </div>

      <section className="status-banner sms-readiness-banner">
        <div>
          <strong>{readiness.summary}</strong>
          <span>{readiness.missing.length ? `חסר: ${readiness.missing.join(", ")}` : "הגדרות ספק קיימות, אבל שליחה אמיתית אינה פעילה."}</span>
        </div>
        <span className="pill warn">Real email disabled</span>
      </section>

      <div className="grid cols-4 dashboard-kpis">
        <StatCard label="תבניות" value={templates.length} tone={templates.length ? "good" : "warn"} />
        <StatCard label="פעילות" value={activeTemplates} tone={activeTemplates ? "good" : "warn"} />
        <StatCard label="בתור" value={queued} tone={queued ? "warn" : "good"} />
        <StatCard label="נמסר" value={delivered} tone="good" />
        <StatCard label="נפתח" value={opened} tone="good" />
        <StatCard label="נלחץ" value={clicked} tone="good" />
        <StatCard label="כשלונות" value={failed} tone={failed ? "bad" : "good"} />
        <StatCard label="Retry מתוזמן" value={retryScheduled} tone={retryScheduled ? "warn" : "good"} />
      </div>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><ShieldCheck size={20} /> מוכנות ספק</h2><p>Resend, SendGrid ו-Amazon SES דרך שכבה אחת.</p></div>
          <div className="risk-list">
            <div>{readiness.configured ? <CheckCircle2 /> : <AlertTriangle />} {readiness.provider} <b>{readiness.configured ? "מוגדר" : "מצב בדיקה"}</b></div>
            <div><CheckCircle2 /> תור שליחה <b>מוכן</b></div>
            <div><RefreshCw /> Retry / Dead letter <b>מוכן</b></div>
            <div><MousePointerClick /> Open / Click tracking <b>מוכן במודל</b></div>
            <div><AlertTriangle /> Real send <b>כבוי בכוונה</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><Mail size={20} /> קטגוריות אימייל</h2><p>תבניות מוכנות לאירועים מרכזיים.</p></div>
          <div className="tag-cloud">{Object.values(categoryLabels).map((label) => <span key={label}>{label}</span>)}</div>
          <p className="muted">העדפות קטגוריה: {preferencesRes.count ?? 0} · ספקים במסד: {providers.length}</p>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>תבניות אימייל</h2><p>נושא, תוכן טקסט ותוכן HTML מוכנים לשליחה עתידית.</p></div>
        {templates.length === 0 ? <div className="empty-state"><strong>אין תבניות אימייל להצגה</strong><span>לאחר הרצת המיגרציה תבניות הבסיס יופיעו כאן.</span></div> : <div className="procedure-list">{templates.map((template) => (
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
        <div className="section-heading"><h2>לוג אימייל</h2><p>queued / sent / delivered / opened / clicked / failed נשמרים כאן. כרגע mock / dry-run בלבד.</p></div>
        {logs.length === 0 ? <div className="empty-state"><strong>אין אימיילים בתור עדיין</strong><span>כאשר הודעת אימייל תיווצר במצב בדיקה, היא תופיע כאן.</span></div> : <div className="procedure-list">{logs.map((log) => (
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
