import { CheckCircle2, CircleAlert, ShieldCheck } from "lucide-react";

export function ReadyStatusCard({ items }: { items: Array<{ label: string; ok: boolean; help: string }> }) {
  const missing = items.filter((item) => !item.ok);
  const blocked = missing.length > 3;
  const status = missing.length === 0 ? "ready" : blocked ? "blocked" : "missing";
  return (
    <article className={`card action-panel ready-status ${status}`}>
      <div className="section-heading">
        <h2><ShieldCheck size={20} /> גן מוכן להפעלה</h2>
        <p>בדיקה אחת שמרכזת מסמכים, צוות, ילדים, מצלמות, פיקוח ותקנונים.</p>
      </div>
      <div className="readiness-meter"><span style={{ width: `${Math.round(((items.length - missing.length) / Math.max(items.length, 1)) * 100)}%` }} /></div>
      <strong className="ready-title">{status === "ready" ? "מוכן להפעלה" : status === "blocked" ? "חסום עד טיפול" : "חסרים פריטים"}</strong>
      <div className="ready-list">
        {items.map((item) => <div key={item.label} className={item.ok ? "ready-row ok" : "ready-row missing"}>{item.ok ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}<span><strong>{item.label}</strong><small>{item.help}</small></span></div>)}
      </div>
    </article>
  );
}
