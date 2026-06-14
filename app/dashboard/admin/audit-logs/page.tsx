import { Activity, AlertTriangle, Camera, DatabaseZap, FileText, LockKeyhole, Scale, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
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

function metadataPreview(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export default async function AdminAuditLogsPage() {
  await requireRole(["admin"]);
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
    <DashboardShell role="admin" title="Audit Logs">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Immutable Evidence</p>
          <h1>יומן audit וראיות משפטיות.</h1>
          <p>מעקב מאוחד אחרי גישה למידע רגיש, מצלמות, מסמכים, AI, תשלומים, אבטחה ואירועים רגולטוריים. המטא־דאטה מסונן ואינו מציג תוכן רפואי, תעודות זהות, סודות או כתובות מצלמה.</p>
        </div>
        <div className="profile-actions">
          <span className={`pill ${scoreTone(auditCoverageScore)}`}>Audit coverage {auditCoverageScore}/100</span>
          <span className={tamperReady ? "pill good" : "pill warn"}>{tamperReady ? "Hash chain ready" : "Hash chain pending"}</span>
        </div>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <StatCard label="Unified events" value={rows.length} tone={rows.length ? "good" : "warn"} />
        <StatCard label="Critical events" value={criticalEvents} tone={criticalEvents ? "bad" : "good"} />
        <StatCard label="High-risk actions" value={highRiskEvents} tone={highRiskEvents ? "warn" : "good"} />
        <StatCard label="Failed access" value={failedAccess} tone={failedAccess ? "bad" : "good"} />
        <StatCard label="Medical access" value={result.data.medical.length} tone={result.data.medical.length ? "warn" : "good"} />
        <StatCard label="Security events" value={result.data.security.length} tone={result.data.security.some((event: any) => event.severity === "critical") ? "bad" : "good"} />
        <StatCard label="Export readiness" value="Future" tone="warn" />
        <StatCard label="Tamper protection" value={tamperReady ? "Ready" : "Partial"} tone={tamperReady ? "good" : "warn"} />
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><DatabaseZap size={20} /> Sensitive Data Access</h2><p>גישה רפואית ונתוני ילדים/הורים.</p></div>
          <div className="risk-list">
            <div>Medical logs <b>{result.data.medical.length}</b></div>
            <div>Child/parent events <b>{rows.filter((event: any) => ["child", "parent", "medical"].includes(event.event_category)).length}</b></div>
            <div>Exports logged <b>{rows.filter((event: any) => /export/i.test(event.event_type)).length}</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><Camera size={20} /> Camera & Observer</h2><p>צפייה, טוקנים, AI וסקירות אנושיות.</p></div>
          <div className="risk-list">
            <div>Camera events <b>{rows.filter((event: any) => event.event_category === "camera").length}</b></div>
            <div>Observer events <b>{rows.filter((event: any) => event.event_category === "observer").length}</b></div>
            <div>Denied attempts <b>{rows.filter((event: any) => /denied|blocked/i.test(event.event_type)).length}</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><LockKeyhole size={20} /> WORM Readiness</h2><p>הכנה לאחסון חיצוני בלתי־מחיק.</p></div>
          <div className="risk-list">
            <div>Hash-chain fields <b>{tamperReady ? "פעיל" : "ממתין"}</b></div>
            <div>Local append-only <b>כן</b></div>
            <div>External WORM <b>עתידי</b></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2><ShieldCheck size={20} /> Audit Coverage</h2><p>כיסוי לפי תחומי מערכת.</p></div>
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
          <div className="section-heading"><h2><Activity size={20} /> Category Activity</h2><p>אירועים לפי תחום.</p></div>
          <div className="procedure-list compact-list">
            {categoryCounts.map((item) => (
              <div className="mini-row" key={item.category}>
                <span>{item.category}</span>
                <strong>{item.count}</strong>
                <small>{item.count ? "audited" : "coverage pending"}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><AlertTriangle size={20} /> Security Events</h2><p>אירועים פתוחים או חשודים.</p></div>
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
        <div className="section-heading"><h2><FileText size={20} /> Event Stream</h2><p>לוגים אחרונים. פרטי metadata עוברים סינון ואינם מיועדים להכיל מידע רגיש.</p></div>
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
                  <span className="pill">IP {log.ip_address ?? log.ip ?? "-"}</span>
                  {isImmutable ? <span className={log.event_hash ? "pill good" : "pill warn"}>{log.event_hash ? "hashed" : "no hash"}</span> : null}
                  <details><summary>metadata</summary><pre>{metadataPreview(isImmutable ? log.metadata : log.after_data ?? log.metadata)}</pre></details>
                </div>
              </article>
            );
          })}
        </div>}
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Scale size={20} /> Retention</h2><p>מדיניות שמירה והחזקה משפטית.</p></div>
          <div className="risk-list">
            <div>Sensitive audit logs <b>24+ months</b></div>
            <div>Security incidents <b>policy-based</b></div>
            <div>Legal hold <b>blocks deletion</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><FileText size={20} /> Export Readiness</h2><p>ייצוא עתידי לביקורת ISO/משפט/פרטיות.</p></div>
          <div className="risk-list">
            <div>CSV / PDF / JSON <b>future-ready</b></div>
            <div>Export action <b>must be audited</b></div>
            <div>Non-admin raw export <b>blocked by policy</b></div>
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}
