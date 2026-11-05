import { Bell, CheckCircle2, Link2, RefreshCw, ShieldCheck, Smartphone, TriangleAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { getPushProductionReadiness } from "@/lib/domain/push-provider";
import { maskDeviceToken } from "@/lib/domain/push-service";
import { createClient } from "@/lib/supabase/server";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";

const categoryLabels: Record<string, string> = {
  registration: "רישום",
  parent_approval: "אישור הורה",
  child_approval: "אישור ילד",
  payment_reminder: "תזכורת תשלום",
  safety_alert: "התראת בטיחות",
  observer_alert: "תצפיתן",
  inspection_alert: "פיקוח",
  camera_alert: "מצלמות",
  system_notification: "מערכת"
};

const statusLabels: Record<string, string> = {
  queued_mock: "ממתין בבדיקה",
  sent_mock: "נשלח בבדיקה",
  queued: "ממתין",
  sent: "נשלח",
  delivered: "נמסר",
  opened: "נפתח",
  failed: "נכשל",
  dead_letter: "לא נשלח",
  skipped_preferences: "דולג לפי העדפות",
  no_active_device: "אין מכשיר פעיל",
  deduped: "נמנע כפול",
  active: "פעיל",
  draft: "טיוטה",
  paused: "מושהה",
  disabled: "כבוי"
};

function pillForStatus(status: string) {
  if (["active", "sent", "delivered", "opened", "sent_mock"].includes(status)) return "pill good";
  if (["failed", "dead_letter", "disabled", "no_active_device"].includes(status)) return "pill bad";
  return "pill warn";
}

async function safeQuery<T>(label: string, query: () => PromiseLike<{ data: T | null; error: unknown; count?: number | null }>) {
  const fallback = { data: null as T | null, count: null as number | null, available: false };
  const result = await safeAdminData(label, async () => {
    const response = await query();
    if (response.error) {
      logSupabaseError(label, response.error);
      throw new Error("Push query unavailable");
    }
    return { data: response.data, count: response.count ?? null, available: true };
  }, fallback);
  return result.data;
}

export default async function AdminPushProductionPage() {
  await requireRole(["admin"]);
  const readiness = getPushProductionReadiness();
  const unavailable = { data: null, count: null, available: false };
  const result = await safeAdminData("admin-push-production", async () => {
    const supabase = await createClient();
    const [templatesRes, logsRes, devicesRes, preferencesRes, providersRes] = await Promise.all([
      safeQuery("admin-push-production-templates", () => supabase.from("push_templates" as any).select("*").order("category").order("template_name").limit(120)),
      safeQuery("admin-push-production-logs", () => supabase.from("push_notification_logs" as any).select("*").order("created_at", { ascending: false }).limit(160)),
      safeQuery("admin-push-production-devices", () => supabase.from("push_device_tokens" as any).select("*").order("last_seen_at", { ascending: false }).limit(200)),
      safeQuery("admin-push-production-preferences", () => supabase.from("push_category_preferences" as any).select("id", { count: "exact", head: true })),
      safeQuery("admin-push-production-providers", () => supabase.from("push_provider_configs" as any).select("*").order("provider"))
    ]);
    return { templatesRes, logsRes, devicesRes, preferencesRes, providersRes };
  }, { templatesRes: unavailable, logsRes: unavailable, devicesRes: unavailable, preferencesRes: unavailable, providersRes: unavailable });
  const { templatesRes, logsRes, devicesRes, preferencesRes, providersRes } = result.data;

  const templates = (templatesRes.data ?? []) as any[];
  const logs = (logsRes.data ?? []) as any[];
  const devices = (devicesRes.data ?? []) as any[];
  const providers = (providersRes.data ?? []) as any[];
  const activeDevices = devices.filter((device) => device.is_active).length;
  const disabledDevices = devices.filter((device) => !device.is_active || device.revoked_at).length;
  const failed = logs.filter((log) => ["failed", "dead_letter", "no_active_device"].includes(log.status)).length;
  const queued = logs.filter((log) => ["queued", "queued_mock"].includes(log.status)).length;
  const delivered = logs.filter((log) => ["delivered", "opened", "sent_mock"].includes(log.status)).length;
  const opened = logs.filter((log) => log.status === "opened" || log.opened_at).length;
  const activeTemplates = templates.filter((template) => template.status === "active").length;
  const retryScheduled = logs.filter((log) => log.next_retry_at && log.status === "failed").length;

  return (
    <DashboardShell role="admin" title="Push Production">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Push Production Readiness</p>
          <h1>תשתית Push מוכנה לייצור מבוקר.</h1>
          <p>תבניות, מכשירים, מסירה, פתיחה, Deep Links והעדפות לפי קטגוריה מוכנים. מצב השליחה מוצג לפי תצורת השרת בפועל.</p>
        </div>
        <span className={readiness.realSendEnabled ? "pill good" : "pill warn"}><Bell size={16} /> {readiness.realSendEnabled ? "Real send enabled" : "Mock / dry-run בלבד"}</span>
      </div>

      {(result.error || !templatesRes.available || !logsRes.available || !devicesRes.available || !preferencesRes.available || !providersRes.available) && (
        <div className="status-banner" role="alert">חלק מהנתונים אינם זמינים כרגע. הנתונים שהתקבלו מוצגים בנפרד.</div>
      )}

      <section className="status-banner sms-readiness-banner">
        <div>
          <strong>{readiness.summary}</strong>
          <span>FCM, APNs ו-Web Push מנוהלים דרך שכבת ספק אחת. מפתחות נשארים בצד שרת בלבד.</span>
        </div>
        <span className={readiness.realSendEnabled ? "pill good" : "pill warn"}>{readiness.realSendEnabled ? "Real push enabled" : "Real push disabled"}</span>
      </section>

      <div className="grid cols-4 dashboard-kpis">
        <StatCard label="תבניות" value={templatesRes.available ? templates.length : "לא זמין"} tone={!templatesRes.available ? "warn" : templates.length ? "good" : "warn"} />
        <StatCard label="תבניות פעילות" value={templatesRes.available ? activeTemplates : "לא זמין"} tone={!templatesRes.available ? "warn" : activeTemplates ? "good" : "warn"} />
        <StatCard label="מכשירים פעילים" value={devicesRes.available ? activeDevices : "לא זמין"} tone={!devicesRes.available ? "warn" : activeDevices ? "good" : "warn"} />
        <StatCard label="מכשירים כבויים" value={devicesRes.available ? disabledDevices : "לא זמין"} tone={!devicesRes.available ? "warn" : disabledDevices ? "warn" : "good"} />
        <StatCard label="ממתין" value={logsRes.available ? queued : "לא זמין"} tone={!logsRes.available ? "warn" : queued ? "warn" : "good"} />
        <StatCard label="נמסר / בדיקה" value={logsRes.available ? delivered : "לא זמין"} tone={logsRes.available ? "good" : "warn"} />
        <StatCard label="נפתח" value={logsRes.available ? opened : "לא זמין"} tone={logsRes.available ? "good" : "warn"} />
        <StatCard label="כשלונות" value={logsRes.available ? failed : "לא זמין"} tone={!logsRes.available ? "warn" : failed ? "bad" : "good"} />
      </div>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><ShieldCheck size={20} /> מצב ספקים</h2><p>מוכנות ספקי Push לפי תצורת השרת.</p></div>
          <div className="risk-list">
            {readiness.providers.map((provider) => (
              <div key={provider.provider}>
                {provider.configured ? <CheckCircle2 /> : <TriangleAlert />}
                {provider.provider} <b>{provider.configured ? "מוגדר" : provider.missing.length ? `חסר: ${provider.missing.join(", ")}` : "mock"}</b>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><Link2 size={20} /> Deep Links מוכנים</h2><p>התראה יכולה לפתוח מסך מדויק לפי אירוע.</p></div>
          <div className="tag-cloud">
            {["פרופיל ילד", "מצלמה", "אירוע", "תשלום", "פיקוח", "אירוע תצפיתן"].map((label) => <span key={label}>{label}</span>)}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>תבניות Push</h2><p>קטגוריות ותוכן קצר להתראות Web, Android ו-iOS.</p></div>
        {!templatesRes.available ? <div className="empty-state" role="status"><strong>נתוני התבניות אינם זמינים</strong></div> : templates.length === 0 ? <div className="empty-state"><strong>אין תבניות Push להצגה</strong><span>לאחר הרצת המיגרציה תבניות הבסיס יופיעו כאן.</span></div> : <div className="procedure-list">{templates.map((template) => (
          <article className="card procedure-card" key={template.id}>
            <div>
              <span className={pillForStatus(template.status)}>{statusLabels[template.status] ?? template.status}</span>
              <h3>{template.title_template}</h3>
              <p>{template.body_template ?? template.template_name}</p>
            </div>
            <div className="procedure-meta">
              <span>{categoryLabels[template.category] ?? template.category}</span>
              <span>{template.default_action_type ?? "ללא יעד"}</span>
              <span>{Array.isArray(template.variables) ? template.variables.length : 0} משתנים</span>
            </div>
          </article>
        ))}</div>}
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Smartphone size={20} /> מכשירים</h2><p>טוקנים מוצגים חלקית בלבד.</p></div>
          <div className="procedure-list compact-list">
            {!devicesRes.available ? <div className="empty-state" role="status"><strong>נתוני המכשירים אינם זמינים</strong></div> : devices.length ? devices.slice(0, 8).map((device) => (
              <div className="mini-row" key={device.id}>
                <span>{device.platform} · {device.role}</span>
                <strong>{maskDeviceToken(device.device_token)}</strong>
                <small>{device.is_active ? "פעיל" : device.disabled_reason ?? "כבוי"}</small>
              </div>
            )) : <div className="empty-state"><strong>אין מכשירים רשומים</strong><span>לאחר חיבור Web Push או Capacitor יופיעו כאן מכשירים.</span></div>}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><RefreshCw size={20} /> Retry והעדפות</h2><p>מוכנות לכשלונות, העדפות קטגוריה ו-dead letter.</p></div>
          <div className="risk-list">
            <div>{preferencesRes.available ? <CheckCircle2 /> : <TriangleAlert />} העדפות קטגוריה <b>{preferencesRes.available ? preferencesRes.count ?? 0 : "לא זמין"}</b></div>
            <div><RefreshCw /> Retry מתוזמן <b>{logsRes.available ? retryScheduled : "לא זמין"}</b></div>
            <div>{providersRes.available ? <CheckCircle2 /> : <TriangleAlert />} ספקים במסד <b>{providersRes.available ? providers.length : "לא זמין"}</b></div>
            <div>{readiness.realSendEnabled ? <CheckCircle2 /> : <TriangleAlert />} שליחה אמיתית <b>{readiness.realSendEnabled ? "פעילה" : "כבויה"}</b></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>לוג Push</h2><p>queued / sent / delivered / opened / failed נשמרים כאן, בהתאם למצב הספק הפעיל.</p></div>
        {!logsRes.available ? <div className="empty-state" role="status"><strong>נתוני הלוג אינם זמינים</strong></div> : logs.length === 0 ? <div className="empty-state"><strong>אין לוגים עדיין</strong><span>כאשר התראה תכין Push, הלוג יופיע כאן.</span></div> : <div className="procedure-list">{logs.map((log) => (
          <article className="card procedure-card" key={log.id}>
            <div>
              <span className={pillForStatus(log.status)}>{statusLabels[log.status] ?? log.status}</span>
              <h3>{log.title}</h3>
              <p>{log.failure_reason ?? log.body ?? "ללא תוכן"}</p>
            </div>
            <div className="procedure-meta">
              <span>{log.platform}</span>
              <span>{log.provider}</span>
              <span>{log.deep_link_type ?? log.action_url ?? "ללא יעד"}</span>
            </div>
          </article>
        ))}</div>}
      </section>
    </DashboardShell>
  );
}
