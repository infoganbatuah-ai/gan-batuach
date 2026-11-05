import { AlertTriangle, CheckCircle2, MessageCircle, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { AdminDataError } from "@/components/admin-data-state";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
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
  const readiness = getWhatsAppProductionReadiness();
  const unavailable = { data: null, count: null, available: false };
  const result = await safeAdminData("admin-whatsapp", async () => {
    const supabase = await createClient();
    async function readSource<T extends { data: unknown; error: unknown; count?: number | null }>(label: string, query: () => PromiseLike<T>) {
      const source = await safeAdminData(label, async () => {
        const response = await query();
        logSupabaseError(label, response.error);
        return { data: response.error ? null : response.data, count: response.error ? null : response.count, available: !response.error };
      }, unavailable);
      return source.data;
    }
    const [templatesRes, logsRes, optInsRes, communicationLogsRes] = await Promise.all([
      readSource("admin-whatsapp templates", () => supabase.from("whatsapp_templates" as any).select("*").order("event_type").order("template_name").limit(100)),
      readSource("admin-whatsapp logs", () => supabase.from("whatsapp_message_logs" as any).select("*").order("created_at", { ascending: false }).limit(120)),
      readSource("admin-whatsapp opt-ins", () => supabase.from("whatsapp_opt_ins" as any).select("id", { count: "exact", head: true }).eq("opted_in", true)),
      readSource("admin-whatsapp communication logs", () => supabase.from("communication_logs" as any).select("id, status", { count: "exact" }).eq("channel", "whatsapp").order("created_at", { ascending: false }).limit(200))
    ]);
    return { templatesRes, logsRes, optInsRes, communicationLogsRes };
  }, { templatesRes: unavailable, logsRes: unavailable, optInsRes: unavailable, communicationLogsRes: unavailable });
  const { templatesRes, logsRes, optInsRes, communicationLogsRes } = result.data;

  const templates = (templatesRes.data ?? []) as any[];
  const logs = (logsRes.data ?? []) as any[];
  const communicationLogs = (communicationLogsRes.data ?? []) as any[];
  const failures = logs.filter((log) => log.status === "failed").length + communicationLogs.filter((log) => log.status === "failed").length;
  const queued = logs.filter((log) => log.status === "queued").length;
  const delivered = logs.filter((log) => log.status === "delivered" || log.status === "read").length;
  const approvedTemplates = templates.filter((template) => template.status === "approved").length;
  const draftTemplates = templates.filter((template) => template.status === "draft").length;

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
        <StatCard label="תבניות" value={templatesRes.available ? templates.length : "לא זמין"} tone={templatesRes.available ? "good" : "default"} />
        <StatCard label="מאושרות" value={templatesRes.available ? approvedTemplates : "לא זמין"} tone={templatesRes.available ? approvedTemplates ? "good" : "warn" : "default"} />
        <StatCard label="טיוטות" value={templatesRes.available ? draftTemplates : "לא זמין"} tone={templatesRes.available ? draftTemplates ? "warn" : "good" : "default"} />
        <StatCard label="הסכמות" value={optInsRes.available ? optInsRes.count ?? 0 : "לא זמין"} tone={optInsRes.available ? (optInsRes.count ?? 0) ? "good" : "warn" : "default"} />
        <StatCard label="ממתין" value={logsRes.available ? queued : "לא זמין"} tone={logsRes.available ? queued ? "warn" : "good" : "default"} />
        <StatCard label="נמסר/נקרא" value={logsRes.available ? delivered : "לא זמין"} tone={logsRes.available ? "good" : "default"} />
        <StatCard label="כשלונות" value={logsRes.available && communicationLogsRes.available ? failures : "לא זמין"} tone={logsRes.available && communicationLogsRes.available ? failures ? "bad" : "good" : "default"} />
        <StatCard label="לוגים כלליים" value={communicationLogsRes.available ? communicationLogsRes.count ?? communicationLogs.length : "לא זמין"} />
      </div>
      <AdminDataError message={result.error ?? (Object.values(result.data).some((source) => !source.available) ? "לא ניתן לטעון חלק מנתוני ה-WhatsApp כרגע" : null)} />

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
        {!templatesRes.available ? <div className="empty-state"><strong>נתוני התבניות אינם זמינים</strong><span>לא ניתן לקבוע את מלאי התבניות כרגע.</span></div> : templates.length === 0 ? <div className="empty-state"><strong>אין תבניות להצגה</strong><span>לאחר הרצת המיגרציה תבניות הבסיס יופיעו כאן.</span></div> : <div className="procedure-list">{templates.map((template) => (
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
        {!logsRes.available ? <div className="empty-state"><strong>נתוני לוג ה-WhatsApp אינם זמינים</strong><span>לא ניתן לקבוע סטטוסי מסירה כרגע.</span></div> : logs.length === 0 ? <div className="empty-state"><strong>אין הודעות WhatsApp עדיין</strong><span>כאשר תיווצר הודעת WhatsApp במצב בדיקה, היא תופיע כאן.</span></div> : <div className="procedure-list">{logs.map((log) => (
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
