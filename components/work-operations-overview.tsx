import Link from "next/link";
import type { CSSProperties } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ClipboardList, MessageSquareWarning, ShieldCheck, Wrench } from "lucide-react";

export function WorkOperationsOverview({
  taskCounts,
  complaintCounts,
  correctiveCounts
}: {
  taskCounts: { open: number; overdue: number; completed: number };
  complaintCounts: { open: number; escalated: number; resolved: number };
  correctiveCounts: { open: number; review: number; verified: number };
}) {
  const openTotal = taskCounts.open + complaintCounts.open + correctiveCounts.open;
  const urgentTotal = taskCounts.overdue + complaintCounts.escalated + correctiveCounts.review;
  const doneTotal = taskCounts.completed + complaintCounts.resolved + correctiveCounts.verified;
  const total = openTotal + doneTotal;
  const completion = total ? Math.round((doneTotal / total) * 100) : 100;
  return <section className="work-overview" aria-label="מרכז עבודה תפעולי">
    <header><div><span className="work-eyebrow"><ShieldCheck size={16} /> תמונת מצב קנונית</span><h1>מרכז עבודה</h1><p>משימות, תלונות ופעולות תיקון נשארות תהליכים נפרדים ומוצגות יחד רק כסיכום תפעולי.</p></div><div className="work-overview-score" style={{ "--work-progress": `${completion * 3.6}deg` } as CSSProperties}><span><strong>{completion}%</strong><small>הושלם</small></span></div></header>
    <div className="work-overview-metrics"><article><span className="blue"><ClipboardList /></span><div><strong>{openTotal}</strong><small>פריטים פתוחים</small></div></article><article><span className="red"><AlertTriangle /></span><div><strong>{urgentTotal}</strong><small>דורשי פעולה</small></div></article><article><span className="green"><CheckCircle2 /></span><div><strong>{doneTotal}</strong><small>טופלו ונסגרו</small></div></article></div>
    <div className="work-overview-domains">
      <Link href="/dashboard/garden/tasks"><span className="work-domain-icon blue"><ClipboardList /></span><div><h2>משימות</h2><p>אחריות תפעולית, יעד ואישור.</p><dl><div><dt>פתוחות</dt><dd>{taskCounts.open}</dd></div><div><dt>באיחור</dt><dd>{taskCounts.overdue}</dd></div><div><dt>הושלמו</dt><dd>{taskCounts.completed}</dd></div></dl></div><ChevronLeft /></Link>
      <Link href="/dashboard/garden/complaints"><span className="work-domain-icon orange"><MessageSquareWarning /></span><div><h2>תלונות</h2><p>סטטוס, יעד, הסלמה ותגובה.</p><dl><div><dt>פתוחות</dt><dd>{complaintCounts.open}</dd></div><div><dt>מוסלמות</dt><dd>{complaintCounts.escalated}</dd></div><div><dt>טופלו</dt><dd>{complaintCounts.resolved}</dd></div></dl></div><ChevronLeft /></Link>
      <Link href="/dashboard/garden/corrective-actions"><span className="work-domain-icon purple"><Wrench /></span><div><h2>פעולות תיקון</h2><p>ממצא, ראיה והחלטת מפקח.</p><dl><div><dt>פתוחות</dt><dd>{correctiveCounts.open}</dd></div><div><dt>בבדיקה</dt><dd>{correctiveCounts.review}</dd></div><div><dt>אומתו</dt><dd>{correctiveCounts.verified}</dd></div></dl></div><ChevronLeft /></Link>
    </div>
  </section>;
}
