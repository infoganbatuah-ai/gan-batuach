import Link from "next/link";
import { AlertTriangle, BellRing, Bot, Camera, ClipboardCheck, FileWarning, ShieldAlert } from "lucide-react";

type Alert = {
  title: string;
  body: string;
  severity: "good" | "warn" | "bad";
  href: string;
  icon: "inspection" | "camera" | "ai" | "documents" | "staff" | "incidents";
};

const iconByType = {
  inspection: ClipboardCheck,
  camera: Camera,
  ai: Bot,
  documents: FileWarning,
  staff: ShieldAlert,
  incidents: AlertTriangle
};

export function GlobalAlertsCenter({ alerts }: { alerts: Alert[] }) {
  const criticalCount = alerts.filter((alert) => alert.severity === "bad").length;
  const warningCount = alerts.filter((alert) => alert.severity === "warn").length;
  const healthyCount = alerts.length === 0 ? 1 : alerts.filter((alert) => alert.severity === "good").length;

  return (
    <section className="global-alerts-center">
      <div className="section-heading"><h2><BellRing size={20} /> מרכז התראות גלובלי</h2><p>הדברים שדורשים החלטה מהירה לפני שהם הופכים לסיכון תפעולי.</p></div>
      <div className="alerts-summary-strip">
        <span className="summary-critical">{criticalCount} קריטי</span>
        <span className="summary-warning">{warningCount} אזהרה</span>
        <span className="summary-healthy">{healthyCount} בריא</span>
      </div>
      {alerts.length === 0 ? <div className="empty-state"><strong>אין התראות דחופות</strong><span>פיקוחים, מסמכים, מצלמות, צוות ו-AI נראים תקינים לפי הנתונים הקיימים.</span></div> : <div className="alerts-grid">{alerts.map((alert) => { const Icon = iconByType[alert.icon]; return <Link className={`alert-card ${alert.severity}`} href={alert.href} key={alert.title}><Icon /><div><strong>{alert.title}</strong><span>{alert.body}</span></div></Link>; })}</div>}
    </section>
  );
}
