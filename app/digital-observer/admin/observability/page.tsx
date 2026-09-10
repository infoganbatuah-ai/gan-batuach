import { Activity, AlertTriangle, BarChart3, Database, Eye, Gauge, Radio, ShieldCheck } from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireDigitalObserverAdmin } from "@/lib/domain/digital-observer/admin-access";
import { loadDigitalObserverOperationalTelemetry, type OperationalHealth, type OperationalSeverity } from "@/lib/domain/digital-observer/operational-telemetry";
import { formatObserverDate } from "@/lib/domain/digital-observer/runtime";

function healthLabel(value: OperationalHealth) {
  return ({ HEALTHY: "תקין", DEGRADED: "מוחלש", UNAVAILABLE: "לא זמין", UNKNOWN: "לא ידוע" })[value];
}

function severityTone(value: OperationalSeverity) {
  return value === "CRITICAL" || value === "HIGH" ? "bad" : value === "WARNING" ? "warn" : "info";
}

export default async function DigitalObserverAdminObservabilityPage() {
  const { profile } = await requireDigitalObserverAdmin("/digital-observer/admin/observability");
  const snapshot = await loadDigitalObserverOperationalTelemetry();
  const healthy = snapshot.domains.filter((domain) => domain.health === "HEALTHY").length;
  const degraded = snapshot.domains.filter((domain) => domain.health === "DEGRADED").length;
  const unknown = snapshot.domains.filter((domain) => domain.health === "UNKNOWN" || domain.health === "UNAVAILABLE").length;

  return <ObserverAppShell profile={profile} mode="admin" activeHref="/digital-observer/admin/observability" title="תצפית תפעולית" statusLabel="מטא־דאטה בלבד">
    <div className="do-page-stack">
      <section className="do-business-summary">
        <article className="do-metric"><Activity /><strong>{healthy}</strong><span>תחומים תקינים</span></article>
        <article className={degraded ? "do-metric alert" : "do-metric"}><AlertTriangle /><strong>{degraded}</strong><span>תחומים מוחלשים</span></article>
        <article className={unknown ? "do-metric alert" : "do-metric"}><Eye /><strong>{unknown}</strong><span>תחומים לא ידועים</span></article>
        <article className="do-metric"><Radio /><strong>{snapshot.alerts.length}</strong><span>התראות תפעול פעילות</span></article>
      </section>

      <section className="do-panel">
        <div className="do-section-head"><div><h2>גרסה ומוכנות</h2><p>כל מצב מקורו בקריאה מוגבלת וגלויה; נתון חסר מוצג כלא ידוע ולא כתקין.</p></div><Gauge /></div>
        <div className="do-summary-list">
          <div><span>סביבה</span><strong>{snapshot.version.environment}</strong></div>
          <div><span>גרסת אפליקציה</span><strong>{snapshot.version.appRevision}</strong></div>
          <div><span>מצב סכימה</span><strong>{snapshot.version.schemaState === "PUSH_25_MIGRATION_PENDING" ? "מיגרציית PUSH 25 ממתינה לפריסה" : "לא ידוע"}</strong></div>
          <div><span>עודכן</span><strong>{formatObserverDate(snapshot.collectedAt)}</strong></div>
        </div>
      </section>

      <section className="do-grid cols-2">
        {snapshot.domains.map((domain) => <article className="do-panel" key={domain.domain}>
          <div className="do-section-head"><div><h2>{domain.domain.replaceAll("_", " ")}</h2><p>{domain.lastActivityAt ? `פעילות אחרונה: ${formatObserverDate(domain.lastActivityAt)}` : "אין פעילות מדודה כרגע"}</p></div><b className={`do-badge ${domain.health === "HEALTHY" ? "good" : domain.health === "DEGRADED" ? "warn" : "bad"}`}>{healthLabel(domain.health)}</b></div>
          <div className="do-summary-list">{domain.metrics.map((item) => <div key={item.name}><span>{item.name.replaceAll("_", " ")}</span><strong>{item.available ? item.value ?? "—" : "לא זמין"}</strong></div>)}</div>
          {domain.issues.length ? <div className="do-notice warn"><AlertTriangle /><span>{domain.issues.map((item) => `${item.category}: ${item.count}`).join(" · ")}</span></div> : null}
        </article>)}
      </section>

      <section className="do-grid cols-2">
        <article className="do-panel"><div className="do-section-head"><div><h2>התראות תפעוליות</h2><p>ממוזגות לפי תחום וקטגוריה; הן אינן התראות אבטחה ללקוח.</p></div><AlertTriangle /></div>
          {snapshot.alerts.length ? <div className="do-summary-list">{snapshot.alerts.map((alert) => <div key={alert.dedupeKey}><span>{alert.domain} · {alert.category}</span><strong className={`do-badge ${severityTone(alert.severity)}`}>{alert.severity} · {alert.count}</strong></div>)}</div> : <div className="do-empty compact"><ShieldCheck /><strong>אין התראות תפעול פעילות</strong><span>המצב תלוי בנתונים הזמינים בלבד.</span></div>}
        </article>
        <article className="do-panel"><div className="do-section-head"><div><h2>גבולות תפעול</h2><p>בריאות מערכת, איכות מוצר ואירועי אבטחה נשארים שכבות נפרדות.</p></div><Database /></div>
          <div className="do-summary-list"><div><span>PUSH 16</span><strong>חסום — מקור פיזי עצמאי נדרש</strong></div><div><span>PUSH 25</span><strong>ממצא RLS billing דחוי באזור קפוא</strong></div><div><span>מדיה ופרטיות</span><strong>אין תוכן וידאו, URLs חתומים או סודות בתצפית</strong></div></div>
        </article>
      </section>

      <section className="do-panel"><div className="do-section-head"><div><h2>תמונת אבחון בטוחה</h2><p>לשימוש admin מורשה בלבד: מדדים, בריאות וקטגוריות שגיאה. אין PII, טקסט חקירה, credentials או מדיה.</p></div><BarChart3 /></div><div className="do-notice info"><span>השירות בונה את התצפית בקריאה בלבד. כשל ב־telemetry מציג UNKNOWN ואינו משנה Event, Incident, Evidence או Decision.</span></div></section>
    </div>
  </ObserverAppShell>;
}
