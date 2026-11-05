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
    async function query<T>(index: number, run: () => PromiseLike<{ data: T[] | null; error: unknown }>) {
      try {
        const response = await run();
        logSupabaseError(`audit center query ${index}`, response.error);
        return { data: response.error ? [] as T[] : response.data ?? [], available: !response.error };
      } catch (error) {
        logSupabaseError(`audit center query ${index}`, error);
        return { data: [] as T[], available: false };
      }
    }
    const [immutableRes, legacyRes, medicalRes, securityRes, coverageRes] = await Promise.all([
      query(0, () => supabase.from("immutable_audit_events" as any).select("*, actor:actor_profile_id(full_name, role), gardens(name, city)").order("created_at", { ascending: false }).limit(300)),
      query(1, () => supabase.from("audit_logs" as any).select("*, actor:actor_id(full_name, role), gardens(name, city)").order("created_at", { ascending: false }).limit(120)),
      query(2, () => supabase.from("medical_data_access_logs" as any).select("*").order("created_at", { ascending: false }).limit(120)),
      query(3, () => supabase.from("security_events" as any).select("*").order("created_at", { ascending: false }).limit(120)),
      query(4, () => supabase.from("audit_coverage_readiness" as any).select("*").order("coverage_area").limit(80))
    ]);
    const available = [immutableRes, legacyRes, medicalRes, securityRes, coverageRes].map((response) => response.available);
    return {
      immutable: immutableRes.data ?? [],
      legacy: legacyRes.data ?? [],
      medical: medicalRes.data ?? [],
      security: securityRes.data ?? [],
      coverage: coverageRes.data ?? [],
      available,
      queryError: available.some((known) => !known)
        ? "חלק מרשומות הביקורת אינן זמינות. מקורות תקינים מוצגים בנפרד."
        : null
    };
  }, { immutable: [] as any[], legacy: [] as any[], medical: [] as any[], security: [] as any[], coverage: [] as any[], available: Array<boolean>(5).fill(false), queryError: null as string | null });

  const rows = result.data.immutable;
  const fallbackRows = rows.length ? rows : result.data.legacy;
  const criticalEvents = rows.filter((event: any) => event.risk_level === "critical").length;
  const highRiskEvents = rows.filter((event: any) => ["critical", "high"].includes(String(event.risk_level))).length;
  const failedAccess = rows.filter((event: any) => /failed|denied|blocked/i.test(String(event.event_type))).length + result.data.security.filter((event: any) => ["open", "reviewing"].includes(String(event.status))).length;
  const categories = ["medical", "camera", "document", "observer", "payment", "admin", "security", "regulatory"];
  const categoryCounts = categories.map((category) => ({ category, count: rows.filter((event: any) => event.event_category === category).length }));
  const auditCoverageScore = result.data.coverage.length ? Math.round(result.data.coverage.reduce((sum: number, item: any) => sum + Number(item.coverage_score ?? 0), 0) / result.data.coverage.length) : 0;
  const tamperReady = rows.some((event: any) => event.event_hash) || result.data.coverage.some((item: any) => item.coverage_key === "security-event-audit");

  const known = (index: number) => result.data.available[index];
  const unavailable = "לא זמין";
  const tamperKnown = tamperReady || (known(0) && known(4));
  const streamKnown = (known(0) && rows.length > 0) || known(1);
  const partialLegacy = !known(0) && known(1);
  const streamNotice = known(0) && rows.length > 0 ? null : known(1)
    ? partialLegacy ? "המקור הראשי אינו זמין — רשומות ישנות חלקיות בלבד; אין כאן זרם מלא." : "רשומות ישנות (legacy); המקור הראשי נטען ללא רשומות."
    : null;

  return (
    <AdminAppFrame profile={profile} activeHref="/dashboard/admin/audit-logs" title="Audit ואבטחה" subtitle="פעולות רגישות, כיסוי וממצאים ללא חשיפת payload פרטי." badge="Audit">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">דרישה: יומן ראיות בלתי־ניתן לשינוי</p>
          <h1>יומן ביקורת ופעולות רגישות.</h1>
          <p>מעקב מאוחד אחרי גישה למידע רגיש, מצלמות, מסמכים, AI, תשלומים, אבטחה ואירועים רגולטוריים. המטא־דאטה מסונן ואינו מציג תוכן רפואי, תעודות זהות, סודות או כתובות מצלמה.</p>
          <p>רשומות ומדדי מוכנות בלבד — לא הוכחת אחסון בלתי־מחיק, שרשרת hash מאומתת, פרטיות רפואית/DLP, אכיפת שמירה או החזקה משפטית, או הרשאת ייצוא.</p>
        </div>
        <div className="profile-actions">
          <span className={`pill ${known(4) ? scoreTone(auditCoverageScore) : "default"}`}>כיסוי ביקורת {known(4) ? `${auditCoverageScore}/100` : unavailable}</span>
          <span className={!tamperKnown ? "pill default" : tamperReady ? "pill good" : "pill warn"}>{!tamperKnown ? unavailable : tamperReady ? "רשומת הגנת שינוי מוכנה" : "רשומת הגנת שינוי ממתינה"}</span>
        </div>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <StatCard label="אירועים מאוחדים" value={known(0) ? (rows.length) : unavailable} tone={known(0) ? (rows.length ? "good" : "warn") : "default"} />
        <StatCard label="אירועים קריטיים" value={known(0) ? (criticalEvents) : unavailable} tone={known(0) ? (criticalEvents ? "bad" : "good") : "default"} />
        <StatCard label="פעולות בסיכון גבוה" value={known(0) ? (highRiskEvents) : unavailable} tone={known(0) ? (highRiskEvents ? "warn" : "good") : "default"} />
        <StatCard label="גישות שנחסמו" value={known(0) && known(3) ? (failedAccess) : unavailable} tone={known(0) && known(3) ? (failedAccess ? "bad" : "good") : "default"} />
        <StatCard label="גישות למידע רפואי" value={known(2) ? (result.data.medical.length) : unavailable} tone={known(2) ? (result.data.medical.length ? "warn" : "good") : "default"} />
        <StatCard label="אירועי אבטחה" value={known(3) ? (result.data.security.length) : unavailable} tone={known(3) ? (result.data.security.some((event: any) => event.severity === "critical") ? "bad" : "good") : "default"} />
        <StatCard label="מוכנות ייצוא" value="עתידי" tone="warn" />
        <StatCard label="הגנת שינוי" value={tamperKnown ? (tamperReady ? "מוכנה" : "חלקית") : unavailable} tone={tamperKnown ? (tamperReady ? "good" : "warn") : "default"} />
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><DatabaseZap size={20} /> גישה למידע רגיש</h2><p>גישה רפואית ונתוני ילדים/הורים.</p></div>
          <div className="risk-list">
            <div>לוגים רפואיים <b>{known(2) ? result.data.medical.length : unavailable}</b></div>
            <div>אירועי ילדים והורים <b>{known(0) ? rows.filter((event: any) => ["child", "parent", "medical"].includes(event.event_category)).length : unavailable}</b></div>
            <div>ייצואים מתועדים <b>{known(0) ? rows.filter((event: any) => /export/i.test(event.event_type)).length : unavailable}</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><Camera size={20} /> מצלמות ותצפיתן</h2><p>צפייה, הרשאות, AI וסקירות אנושיות.</p></div>
          <div className="risk-list">
            <div>אירועי מצלמות <b>{known(0) ? rows.filter((event: any) => event.event_category === "camera").length : unavailable}</b></div>
            <div>אירועי תצפיתן <b>{known(0) ? rows.filter((event: any) => event.event_category === "observer").length : unavailable}</b></div>
            <div>ניסיונות שנחסמו <b>{known(0) ? rows.filter((event: any) => /denied|blocked/i.test(event.event_type)).length : unavailable}</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><LockKeyhole size={20} /> מוכנות לאחסון בלתי־מחיק</h2><p>הכנה לאחסון חיצוני בלתי־מחיק.</p></div>
          <div className="risk-list">
            <div>שרשרת אימות <b>{!tamperKnown ? unavailable : tamperReady ? "סימן מוכנות רשום" : "ממתינה"}</b></div>
            <div>יומן מקומי מצטבר בלבד <b>דרישה: כן</b></div>
            <div>אחסון חיצוני בלתי־מחיק <b>עתידי</b></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2><ShieldCheck size={20} /> כיסוי ביקורת</h2><p>כיסוי לפי תחומי מערכת.</p></div>
        <div className="grid cols-4">
          {!known(4) ? <div className="empty-mini">{unavailable}</div> : result.data.coverage.map((item: any) => (
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
                <strong>{known(0) ? item.count : unavailable}</strong>
                <small>{!known(0) ? unavailable : item.count ? "מתועד" : "הכיסוי ממתין"}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><AlertTriangle size={20} /> אירועי אבטחה</h2><p>אירועים פתוחים או חשודים.</p></div>
          <div className="procedure-list compact-list">
            {!known(3) ? <div className="empty-mini">{unavailable}</div> : result.data.security.slice(0, 8).map((event: any) => (
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
        {streamNotice ? <p className="data-notice">{streamNotice}</p> : null}
        {!streamKnown ? <div className="empty-mini">{unavailable}</div> : fallbackRows.length === 0 && partialLegacy ? <div className="empty-mini">המקור הראשי אינו זמין; מקור הרשומות הישנות נטען ללא רשומות.</div> : fallbackRows.length === 0 ? <div className="empty-state"><strong>אין לוגים להצגה</strong><span>פעולות רגישות, צפייה, שינויי תפקידים ואירועים רגולטוריים יופיעו כאן.</span></div> : <div className="procedure-list">
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
          <div className="section-heading"><h2><Scale size={20} /> שמירת נתונים</h2><p>דרישות/תכנון: מדיניות שמירה והחזקה משפטית; לא הוכחת אכיפה או ייעוץ משפטי.</p></div>
          <div className="risk-list">
            <div>לוגים רגישים <b>24+ חודשים</b></div>
            <div>אירועי אבטחה <b>לפי מדיניות</b></div>
            <div>החזקה משפטית <b>חוסמת מחיקה</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><FileText size={20} /> מוכנות ייצוא</h2><p>דרישות ייצוא עתידי לביקורת ISO/משפט/פרטיות; לא הרשאת ייצוא.</p></div>
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
