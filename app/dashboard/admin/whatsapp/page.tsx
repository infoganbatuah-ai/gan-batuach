import { AlertTriangle, CheckCircle2, MessageCircle, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { getWhatsAppProductionReadiness } from "@/lib/domain/whatsapp-provider";
import { createClient } from "@/lib/supabase/server";

const eventLabels: Record<string, string> = {
  registration: "רישום",
  verification: "אימות",
  parent_approval: "אישור הורה",
  child_approval: "אישור ילד",
  payment_reminder: "תזכורת תשלום",
  safety_alert: "התראת בטיחות",
  inspection_alert: "התראת פיקוח"
};

const statusLabels: Record<string, string> = {
  queued: "ממתין",
  sent: "נשלח",
  delivered: "נמסר",
  read: "נקרא",
  failed: "נכשל",
  draft: "טיוטה",
  pending_approval: "ממתין לאישור",
  approved: "מאושר",
  rejected: "נדחה",
  paused: "מושהה",
  disabled: "כבוי"
};

function pillForStatus(status: string) {
  if (["approved", "sent", "delivered", "read"].includes(status)) return "pill good";
  if (["failed", "rejected"].includes(status)) return "pill bad";
  return "pill warn";
}

export default async function AdminWhatsAppPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const readiness = getWhatsAppProductionReadiness();
  const [templatesRes, logsRes, optInsRes, communicationLogsRes] = await Promise.all([
    supabase.from("whatsapp_templates" as any).select("*").order("event_type").order("template_name").limit(100),
    supabase.from("whatsapp_message_logs" as any).select("*").order("created_at", { ascending: false }).limit(120),
    supabase.from("whatsapp_opt_ins" as any).select("id", { count: "exact", head: true }).eq("opted_in", true),
    supabase.from("communication_logs" as any).select("id, status", { count: "exact" }).eq("channel", "whatsapp").order("created_at", { ascending: false }).limit(200)
  ]);

  const templates = (templatesRes.data ?? []) as any[];
  const logs = (logsRes.data ?? []) as any[];
  const communicationLogs = (communicationLogsRes.data ?? []) as any[];
  const failures = logs.filter((log) => log.status === "failed").length + communicationLogs.filter((log) => log.status === "failed").length;
  const queued = logs.filter((log) => log.status === "queued").length;
  const delivered = logs.filter((log) => log.status === "delivered" || log.status === "read").length;
  const approvedTemplates = templates.filter((template) => template.status === "approved").length;
  const draftTemplates = templates.filter((template) => template.status === "draft").length;

  if (templatesRes.error) console.error("[admin-whatsapp] templates failed", { error: templatesRes.error.message });
  if (logsRes.error) console.error("[admin-whatsapp] logs failed", { error: logsRes.error.message });

  return (
    <DashboardShell role="admin" title="WhatsApp">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">WhatsApp Business</p>
          <h1>תשתית WhatsApp מוכנה לבדיקה.</h1>
          <p>תבניות, הסכמות, סטטוסי מסירה ולוגים מוכנים לייצור. שליחה אמיתית עדיין כבויה בכוונה.</p>
        </div>
        <span className={readiness.configured ? "pill warn" : "pill good"}><MessageCircle size={16} /> {readiness.mode === "dry_run" ? "Dry-run בלבד" : "Mock בלבד"}</span>
      </div>

      <section className="status-banner whatsapp-readiness-banner">
        <div>
          <strong>{readiness.summary}</strong>
          <span>{readiness.missing.length ? `חסר: ${readiness.missing.join(", ")}` : "כל משתני Meta קיימים, אבל שליחה אמיתית אינה פעילה."}</span>
        </div>
        <span className="pill warn">Real send disabled</span>
      </section>

      <div className="grid cols-4 dashboard-kpis">
        <StatCard label="תבניות" value={templates.length} tone="good" />
        <StatCard label="מאושרות" value={approvedTemplates} tone={approvedTemplates ? "good" : "warn"} />
        <StatCard label="טיוטות" value={draftTemplates} tone={draftTemplates ? "warn" : "good"} />
        <StatCard label="הסכמות" value={optInsRes.count ?? 0} tone={(optInsRes.count ?? 0) ? "good" : "warn"} />
        <StatCard label="ממתין" value={queued} tone={queued ? "warn" : "good"} />
        <StatCard label="נמסר/נקרא" value={delivered} tone="good" />
        <StatCard label="כשלונות" value={failures} tone={failures ? "bad" : "good"} />
        <StatCard label="לוגים כלליים" value={communicationLogsRes.count ?? communicationLogs.length} />
      </div>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><ShieldCheck size={20} /> בדיקת מוכנות</h2><p>מה צריך לפני הפעלה אמיתית מול Meta WhatsApp Business.</p></div>
          <div className="risk-list">
            <div><CheckCircle2 /> Provider abstraction <b>מוכן</b></div>
            <div><CheckCircle2 /> Template payload builder <b>מוכן</b></div>
            <div><CheckCircle2 /> Opt-in model <b>מוכן</b></div>
            <div><AlertTriangle /> Real send <b>כבוי בכוונה</b></div>
            <div><AlertTriangle /> Webhooks <b>לתכנון בהפעלה אמיתית</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><MessageCircle size={20} /> אירועים נתמכים</h2><p>תבניות מוכנות לפי אירועים קריטיים.</p></div>
          <div className="tag-cloud">
            {Object.values(eventLabels).map((label) => <span key={label}>{label}</span>)}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>תבניות WhatsApp</h2><p>סטטוס התבניות מול תהליך אישור עתידי של Meta.</p></div>
        {templates.length === 0 ? <div className="empty-state"><strong>אין תבניות להצגה</strong><span>לאחר הרצת המיגרציה תבניות הבסיס יופיעו כאן.</span></div> : <div className="procedure-list">{templates.map((template) => (
          <article className="card procedure-card" key={template.id}>
            <div>
              <span className={pillForStatus(template.status)}>{statusLabels[template.status] ?? template.status}</span>
              <h3>{template.template_name}</h3>
              <p>{template.body_preview ?? "אין תצוגה מקדימה"}</p>
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
        <div className="section-heading"><h2>לוג WhatsApp</h2><p>סטטוסי queued / sent / delivered / read / failed נשמרים כאן. כרגע רק mock / dry-run.</p></div>
        {logs.length === 0 ? <div className="empty-state"><strong>אין הודעות WhatsApp עדיין</strong><span>כאשר תיווצר הודעת WhatsApp במצב בדיקה, היא תופיע כאן.</span></div> : <div className="procedure-list">{logs.map((log) => (
          <article className="card procedure-card" key={log.id}>
            <div>
              <span className={pillForStatus(log.status)}>{statusLabels[log.status] ?? log.status}</span>
              <h3>{log.template_name ?? "תבנית WhatsApp"}</h3>
              <p>{log.failure_reason ?? `נמען ${log.masked_phone ?? "לא מוצג"}`}</p>
            </div>
            <div className="procedure-meta">
              <span>{eventLabels[log.event_type] ?? log.event_type}</span>
              <span>{log.provider}</span>
              <span>{log.created_at ? new Date(log.created_at).toLocaleString("he-IL") : ""}</span>
            </div>
          </article>
        ))}</div>}
      </section>
    </DashboardShell>
  );
}
