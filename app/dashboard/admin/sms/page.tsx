import { AlertTriangle, CheckCircle2, MessageSquare, RefreshCw, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { getSmsProductionReadiness } from "@/lib/domain/sms-provider";
import { createClient } from "@/lib/supabase/server";

const eventLabels: Record<string, string> = {
  registration_verification: "אימות רישום",
  password_reset: "איפוס סיסמה",
  parent_approval: "אישור הורה",
  child_approval: "אישור ילד",
  safety_alert: "התראת בטיחות",
  payment_reminder: "תזכורת תשלום",
  inspection_reminder: "תזכורת פיקוח"
};

const statusLabels: Record<string, string> = {
  queued: "ממתין",
  sent: "נשלח",
  delivered: "נמסר",
  failed: "נכשל",
  dead_letter: "לא נשלח",
  draft: "טיוטה",
  active: "פעיל",
  paused: "מושהה",
  disabled: "כבוי"
};

function pillForStatus(status: string) {
  if (["active", "sent", "delivered"].includes(status)) return "pill good";
  if (["failed", "dead_letter", "disabled"].includes(status)) return "pill bad";
  return "pill warn";
}

export default async function AdminSmsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const readiness = getSmsProductionReadiness();
  const [templatesRes, logsRes, optInsRes, communicationLogsRes] = await Promise.all([
    supabase.from("sms_templates" as any).select("*").order("event_type").order("template_name").limit(100),
    supabase.from("sms_message_logs" as any).select("*").order("created_at", { ascending: false }).limit(120),
    supabase.from("sms_opt_ins" as any).select("id", { count: "exact", head: true }).eq("opted_in", true),
    supabase.from("communication_logs" as any).select("id, status", { count: "exact" }).eq("channel", "sms").order("created_at", { ascending: false }).limit(200)
  ]);

  const templates = (templatesRes.data ?? []) as any[];
  const logs = (logsRes.data ?? []) as any[];
  const communicationLogs = (communicationLogsRes.data ?? []) as any[];
  const failures = logs.filter((log) => log.status === "failed").length + communicationLogs.filter((log) => log.status === "failed").length;
  const queued = logs.filter((log) => log.status === "queued").length;
  const delivered = logs.filter((log) => log.status === "delivered").length;
  const retryScheduled = logs.filter((log) => log.next_retry_at && log.status === "failed").length;
  const activeTemplates = templates.filter((template) => template.status === "active").length;
  const draftTemplates = templates.filter((template) => template.status === "draft").length;

  if (templatesRes.error) console.error("[admin-sms] templates failed", { error: templatesRes.error.message });
  if (logsRes.error) console.error("[admin-sms] logs failed", { error: logsRes.error.message });

  return (
    <DashboardShell role="admin" title="SMS">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">SMS Production Readiness</p>
          <h1>תשתית SMS מוכנה לבדיקה.</h1>
          <p>תבניות, הסכמות, סטטוסי מסירה, כשלונות וניסיונות חוזרים מוכנים לייצור. שליחה אמיתית עדיין כבויה בכוונה.</p>
        </div>
        <span className={readiness.configured ? "pill warn" : "pill good"}><MessageSquare size={16} /> {readiness.mode === "dry_run" ? "Dry-run בלבד" : "Mock בלבד"}</span>
      </div>

      <section className="status-banner sms-readiness-banner">
        <div>
          <strong>{readiness.summary}</strong>
          <span>{readiness.missing.length ? `חסר: ${readiness.missing.join(", ")}` : "הגדרות הספק קיימות, אבל שליחה אמיתית אינה פעילה."}</span>
        </div>
        <span className="pill warn">Real send disabled</span>
      </section>

      <div className="grid cols-4 dashboard-kpis">
        <StatCard label="תבניות" value={templates.length} tone="good" />
        <StatCard label="פעילות" value={activeTemplates} tone={activeTemplates ? "good" : "warn"} />
        <StatCard label="טיוטות" value={draftTemplates} tone={draftTemplates ? "warn" : "good"} />
        <StatCard label="הסכמות" value={optInsRes.count ?? 0} tone={(optInsRes.count ?? 0) ? "good" : "warn"} />
        <StatCard label="ממתין" value={queued} tone={queued ? "warn" : "good"} />
        <StatCard label="נמסר" value={delivered} tone="good" />
        <StatCard label="כשלונות" value={failures} tone={failures ? "bad" : "good"} />
        <StatCard label="Retry מתוזמן" value={retryScheduled} tone={retryScheduled ? "warn" : "good"} />
      </div>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><ShieldCheck size={20} /> בדיקת מוכנות</h2><p>מה צריך לפני הפעלה אמיתית מול ספק SMS.</p></div>
          <div className="risk-list">
            <div><CheckCircle2 /> Provider abstraction <b>מוכן</b></div>
            <div><CheckCircle2 /> Retry fields <b>מוכנים</b></div>
            <div><CheckCircle2 /> Opt-in model <b>מוכן</b></div>
            <div><AlertTriangle /> Real send <b>כבוי בכוונה</b></div>
            <div><RefreshCw /> Delivery webhooks <b>לתכנון בהפעלה אמיתית</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><MessageSquare size={20} /> אירועים נתמכים</h2><p>תבניות מוכנות לאירועי SMS קריטיים.</p></div>
          <div className="tag-cloud">{Object.values(eventLabels).map((label) => <span key={label}>{label}</span>)}</div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>תבניות SMS</h2><p>תבניות קצרות לאימות, אישורים, תזכורות והתראות.</p></div>
        {templates.length === 0 ? <div className="empty-state"><strong>אין תבניות להצגה</strong><span>לאחר הרצת המיגרציה תבניות הבסיס יופיעו כאן.</span></div> : <div className="procedure-list">{templates.map((template) => (
          <article className="card procedure-card" key={template.id}>
            <div>
              <span className={pillForStatus(template.status)}>{statusLabels[template.status] ?? template.status}</span>
              <h3>{template.template_name}</h3>
              <p>{template.body_template}</p>
            </div>
            <div className="procedure-meta">
              <span>{eventLabels[template.event_type] ?? template.event_type}</span>
              <span>{template.language}</span>
              <span>{Array.isArray(template.variables) ? template.variables.length : 0} משתנים</span>
            </div>
          </article>
        ))}</div>}
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>לוג SMS</h2><p>סטטוסי queued / sent / delivered / failed / dead letter נשמרים כאן. כרגע רק mock / dry-run.</p></div>
        {logs.length === 0 ? <div className="empty-state"><strong>אין הודעות SMS עדיין</strong><span>כאשר תיווצר הודעת SMS במצב בדיקה, היא תופיע כאן.</span></div> : <div className="procedure-list">{logs.map((log) => (
          <article className="card procedure-card" key={log.id}>
            <div>
              <span className={pillForStatus(log.status)}>{statusLabels[log.status] ?? log.status}</span>
              <h3>{eventLabels[log.event_type] ?? "SMS"}</h3>
              <p>{log.failure_reason ?? log.message_preview ?? `נמען ${log.masked_phone ?? "לא מוצג"}`}</p>
            </div>
            <div className="procedure-meta">
              <span>{log.provider}</span>
              <span>ניסיונות: {log.retry_attempts ?? 0}</span>
              <span>{log.next_retry_at ? `Retry: ${new Date(log.next_retry_at).toLocaleString("he-IL")}` : ""}</span>
            </div>
          </article>
        ))}</div>}
      </section>
    </DashboardShell>
  );
}
