import { Activity, AlertTriangle, Camera, DatabaseZap, FileText, LockKeyhole, Scale, ShieldCheck } from "lucide-react";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { AdminDataError } from "@/components/admin-data-state";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

function riskTone(risk: string): "good" | "warn" | "bad" {
  if (risk === "critical" || risk === "high") return "bad";
  if (risk === "medium") return "warn";
  return "good";
}

function scoreTone(score: number): "good" | "warn" | "bad" {
  if (score >= 80) return "good";
  if (score >= 55) return "warn";
  return "bad";
}

function metadataKeys(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>)
    .filter((key) => !/token|secret|password|medical|phone|email|address|url|path|content|message/i.test(key))
    .slice(0, 8);
}

const categoryLabels: Record<string, string> = {
  medical: "מידע רפואי",
  camera: "מצלמות",
  document: "מסמכים",
  observer: "תצפיתן דיגיטלי",
  payment: "תשלומים",
  admin: "פעולות מנהל",
  security: "אבטחה",
  regulatory: "רגולציה"
};

export default async function AdminAuditLogsPage() {
  const { profile } = await requireRole(["admin"]);
  const result = await safeAdminData("audit logs", async () => {
    const supabase = await createClient();
    const [immutableRes, legacyRes, medicalRes, securityRes, coverageRes] = await Promise.all([
      supabase.from("immutable_audit_events" as any).select("*, actor:actor_profile_id(full_name, role), gardens(name, city)").order("created_at", { ascending: false }).limit(300),
      supabase.from("audit_logs" as any).select("*, actor:actor_id(full_name, role), gardens(name, city)").order("created_at", { ascending: false }).limit(120),
      supabase.from("medical_data_access_logs" as any).select("*").order("created_at", { ascending: false }).limit(120),
      supabase.from("security_events" as any).select("*").order("created_at", { ascending: false }).limit(120),
      supabase.from("audit_coverage_readiness" as any).select("*").order("coverage_area").limit(80)
    ]);
    [immutableRes, legacyRes, medicalRes, securityRes, coverageRes].forEach((query, index) => logSupabaseError(`audit center query ${index}`, (query as any).error));
    return {
      immutable: immutableRes.data ?? [],
      legacy: legacyRes.data ?? [],
      medical: medicalRes.data ?? [],
      security: securityRes.data ?? [],
      coverage: coverageRes.data ?? [],
      queryError: [immutableRes.error, legacyRes.error, medicalRes.error, securityRes.error, coverageRes.error].some(Boolean)
        ? "חלק מנתוני audit לא נטענו. ייתכן שמיגרציות Phase 153/154 עדיין לא הורצו."
        : null
    };
  }, { immutable: [] as any[], legacy: [] as any[], medical: [] as any[], security: [] as any[], coverage: [] as any[], queryError: null as string | null });

  const rows = result.data.immutable;
  const fallbackRows = rows.length ? rows : result.data.legacy;
  const criticalEvents = rows.filter((event: any) => event.risk_level === "critical").length;
  const highRiskEvents = rows.filter((event: any) => ["critical", "high"].includes(String(event.risk_level))).length;
  const failedAccess = rows.filter((event: any) => /failed|denied|blocked/i.test(String(event.event_type))).length + result.data.security.filter((event: any) => ["open", "reviewing"].includes(String(event.status))).length;
  const categories = ["medical", "camera", "document", "observer", "payment", "admin", "security", "regulatory"];
  const categoryCounts = categories.map((category) => ({ category, count: rows.filter((event: any) => event.event_category === category).length }));
  const auditCoverageScore = result.data.coverage.length ? Math.round(result.data.coverage.reduce((sum: number, item: any) => sum + Number(item.coverage_score ?? 0), 0) / result.data.coverage.length) : 0;
  const tamperReady = rows.some((event: any) => event.event_hash) || result.data.coverage.some((item: any) => item.coverage_key === "security-event-audit");

  return (
    <AdminAppFrame profile={profile} activeHref="/dashboard/admin/audit-logs" title="Audit ואבטחה" subtitle="פעולות רגישות, כיסוי וממצאים ללא חשיפת payload פרטי." badge="Audit">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">יומן ראיות בלתי־ניתן לשינוי</p>
          <h1>יומן ביקורת ופעולות רגישות.</h1>
          <p>מעקב מאוחד אחרי גישה למידע רגיש, מצלמות, מסמכים, AI, תשלומים, אבטחה ואירועים רגולטוריים. המטא־דאטה מסונן ואינו מציג תוכן רפואי, תעודות זהות, סודות או כתובות מצלמה.</p>
        </div>
        <div className="profile-actions">
          <span className={`pill ${scoreTone(auditCoverageScore)}`}>כיסוי ביקורת {auditCoverageScore}/100</span>
          <span className={tamperReady ? "pill good" : "pill warn"}>{tamperReady ? "הגנת שינוי מוכנה" : "הגנת שינוי ממתינה"}</span>
        </div>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <StatCard label="אירועים מאוחדים" value={rows.length} tone={rows.length ? "good" : "warn"} />
        <StatCard label="אירועים קריטיים" value={criticalEvents} tone={criticalEvents ? "bad" : "good"} />
        <StatCard label="פעולות בסיכון גבוה" value={highRiskEvents} tone={highRiskEvents ? "warn" : "good"} />
        <StatCard label="גישות שנחסמו" value={failedAccess} tone={failedAccess ? "bad" : "good"} />
        <StatCard label="גישות למידע רפואי" value={result.data.medical.length} tone={result.data.medical.length ? "warn" : "good"} />
        <StatCard label="אירועי אבטחה" value={result.data.security.length} tone={result.data.security.some((event: any) => event.severity === "critical") ? "bad" : "good"} />
        <StatCard label="מוכנות ייצוא" value="עתידי" tone="warn" />
        <StatCard label="הגנת שינוי" value={tamperReady ? "מוכנה" : "חלקית"} tone={tamperReady ? "good" : "warn"} />
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><DatabaseZap size={20} /> גישה למידע רגיש</h2><p>גישה רפואית ונתוני ילדים/הורים.</p></div>
          <div className="risk-list">
            <div>לוגים רפואיים <b>{result.data.medical.length}</b></div>
            <div>אירועי ילדים והורים <b>{rows.filter((event: any) => ["child", "parent", "medical"].includes(event.event_category)).length}</b></div>
            <div>ייצואים מתועדים <b>{rows.filter((event: any) => /export/i.test(event.event_type)).length}</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><Camera size={20} /> מצלמות ותצפיתן</h2><p>צפייה, הרשאות, AI וסקירות אנושיות.</p></div>
          <div className="risk-list">
            <div>אירועי מצלמות <b>{rows.filter((event: any) => event.event_category === "camera").length}</b></div>
            <div>אירועי תצפיתן <b>{rows.filter((event: any) => event.event_category === "observer").length}</b></div>
            <div>ניסיונות שנחסמו <b>{rows.filter((event: any) => /denied|blocked/i.test(event.event_type)).length}</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><LockKeyhole size={20} /> מוכנות לאחסון בלתי־מחיק</h2><p>הכנה לאחסון חיצוני בלתי־מחיק.</p></div>
          <div className="risk-list">
            <div>שרשרת אימות <b>{tamperReady ? "פעילה" : "ממתינה"}</b></div>
            <div>יומן מקומי מצטבר בלבד <b>כן</b></div>
            <div>אחסון חיצוני בלתי־מחיק <b>עתידי</b></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2><ShieldCheck size={20} /> כיסוי ביקורת</h2><p>כיסוי לפי תחומי מערכת.</p></div>
        <div className="grid cols-4">
          {result.data.coverage.map((item: any) => (
            <article className="card compact-card" key={item.id ?? item.coverage_key}>
              <span className={`pill ${scoreTone(Number(item.coverage_score ?? 0))}`}>{item.coverage_score}/100</span>
              <h3>{item.title}</h3>
              <p>{item.recommended_action}</p>
              <small>{item.audited_routes}/{item.required_routes} routes · {item.readiness_status}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Activity size={20} /> פעילות לפי תחום</h2><p>אירועים לפי תחום.</p></div>
          <div className="procedure-list compact-list platform-admin-category-list">
            {categoryCounts.map((item) => (
              <div className="mini-row" key={item.category}>
                <span>{categoryLabels[item.category] ?? item.category}</span>
                <strong>{item.count}</strong>
                <small>{item.count ? "מתועד" : "הכיסוי ממתין"}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><AlertTriangle size={20} /> אירועי אבטחה</h2><p>אירועים פתוחים או חשודים.</p></div>
          <div className="procedure-list compact-list">
            {result.data.security.slice(0, 8).map((event: any) => (
              <div className="mini-row" key={event.id}>
                <span>{event.event_type}</span>
                <strong className={`pill ${riskTone(event.severity)}`}>{event.severity}</strong>
                <small>{event.status} · {event.created_at ? new Date(event.created_at).toLocaleString("he-IL") : ""}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2><FileText size={20} /> זרם אירועים</h2><p>לוגים אחרונים. המטא־דאטה מסונן ואינו מיועד להכיל מידע רגיש.</p></div>
        <section className="filter-bar">
          <input placeholder="סינון לפי פעולה / משתמש / גן" />
          <select><option>כל הקטגוריות</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
          <input type="date" />
        </section>
        {fallbackRows.length === 0 ? <div className="empty-state"><strong>אין לוגים להצגה</strong><span>פעולות רגישות, צפייה, שינויי תפקידים ואירועים רגולטוריים יופיעו כאן.</span></div> : <div className="procedure-list">
          {fallbackRows.slice(0, 120).map((log: any) => {
            const isImmutable = Boolean(log.event_category);
            return (
              <article className="card procedure-card" key={log.id}>
                <div>
                  <span className={`pill ${riskTone(String(log.risk_level ?? "low"))}`}>{log.risk_level ?? log.actor_role ?? log.actor?.role ?? "system"}</span>
                  <h3>{isImmutable ? log.event_type : log.action}</h3>
                  <p>{isImmutable ? `${log.event_category} · ${log.target_type ?? "-"}` : `${log.entity_type} · ${log.entity_id}`}</p>
                  <small>{log.actor?.full_name ?? log.actor_profile_id ?? log.actor_id ?? "-"} · {log.gardens?.name ?? log.garden_id ?? "ללא גן"} · {log.created_at ? new Date(log.created_at).toLocaleString("he-IL") : ""}</small>
                </div>
                <div className="procedure-meta">
                  {isImmutable ? <span className={log.event_hash ? "pill good" : "pill warn"}>{log.event_hash ? "hashed" : "no hash"}</span> : null}
                  <div className="platform-admin-safe-meta" aria-label="שדות metadata בטוחים">
                    {metadataKeys(isImmutable ? log.metadata : log.after_data ?? log.metadata).map((key) => <span key={key}>{key}</span>)}
                    {metadataKeys(isImmutable ? log.metadata : log.after_data ?? log.metadata).length === 0 ? <span>ללא metadata בטוח להצגה</span> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>}
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Scale size={20} /> שמירת נתונים</h2><p>מדיניות שמירה והחזקה משפטית.</p></div>
          <div className="risk-list">
            <div>לוגים רגישים <b>24+ חודשים</b></div>
            <div>אירועי אבטחה <b>לפי מדיניות</b></div>
            <div>החזקה משפטית <b>חוסמת מחיקה</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><FileText size={20} /> מוכנות ייצוא</h2><p>ייצוא עתידי לביקורת ISO/משפט/פרטיות.</p></div>
          <div className="risk-list">
            <div>CSV / PDF / JSON <b>מוכנות עתידית</b></div>
            <div>פעולת ייצוא <b>חייבת תיעוד</b></div>
            <div>ייצוא גולמי ללא הרשאת מנהל <b>חסום במדיניות</b></div>
          </div>
        </article>
      </section>
    </AdminAppFrame>
  );
}
