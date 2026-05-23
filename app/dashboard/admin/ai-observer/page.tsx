import { AlertTriangle, Bot, Camera, CheckCircle2, ClipboardPlus, EyeOff, MessageSquareWarning, UserRoundSearch } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

const events = ["violence detection", "child alone", "restricted area", "cry detection", "staff absence", "child outside allowed zone", "overcrowding", "sleeping anomaly", "no movement", "panic movement", "fall detection"];

export default async function AiObserverDashboardPage() {
  await requireRole(["admin"]);
  return (
    <DashboardShell role="admin" title="תצפיתן AI">
      <div className="dashboard-hero-card ai-hero-card"><div><p className="eyebrow">Digital Safety Assistant</p><h1>תצפיתן AI שמתרגם אירועים למשימות טיפול.</h1><p>המודול עובד עם confidence, threshold, cooldown, snapshot, timeline, alerts ויצירת משימה במקרה קריטי.</p></div><span className="pill bad"><Bot size={15} /> אירועים בזמן אמת</span></div>
      <section className="grid cols-3 feature-grid">{events.map((event) => <article className="card ai-event-type" key={event}><Bot /><strong>{event}</strong><span>threshold + cooldown + severity</span></article>)}</section>
      <section className="grid cols-2 dashboard-panels"><article className="card action-panel"><h2>כרטיס אירוע AI</h2><div className="event-card-preview"><div className="snapshot-placeholder"><Camera /> snapshot</div><div><span className="pill bad">critical</span><h3>Child alone detected</h3><p>מצלמה: חצר צפונית · confidence 0.91 · 10:42</p><div className="actions"><button className="button primary" type="button"><ClipboardPlus size={16} /> יצירת משימה</button><button className="button" type="button"><CheckCircle2 size={16} /> טופל</button><button className="button" type="button"><EyeOff size={16} /> זיהוי שגוי</button></div></div></div></article><article className="card action-panel"><h2>פעולות מומלצות</h2><div className="risk-list"><div><UserRoundSearch /> שיוך מטפל <b>פקח / מנהל</b></div><div><AlertTriangle /> הסלמה <b>לפי חומרה</b></div><div><MessageSquareWarning /> הערות טיפול <b>נשמרות בציר זמן</b></div></div></article></section>
    </DashboardShell>
  );
}
