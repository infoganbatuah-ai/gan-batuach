import Link from "next/link";
import { BadgeCheck, CalendarClock, ClipboardList, FileCheck2, MapPin, MessageSquare, Timer, UserCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";

const staffActions = [
  { href: "/api/staff/gps-attendance", label: "כניסה / יציאה", icon: MapPin, text: "בדיקת GPS מול כתובת הגן." },
  { href: "/api/staff/shifts", label: "שעות חודשיות", icon: Timer, text: "חישוב שעות, איחורים וחוסרים." },
  { href: "/api/tasks", label: "משימות", icon: ClipboardList, text: "משימות צוות וצפייה מי ראה." },
  { href: "/api/messages", label: "הודעות", icon: MessageSquare, text: "תקשורת פנימית מתועדת." },
  { href: "/api/staff/certificates", label: "תעודות", icon: FileCheck2, text: "עזרה ראשונה, הכשרות ותוקף." },
  { href: "/api/documents", label: "בדיקות רקע", icon: BadgeCheck, text: "אישור עבודה רק עם מסמכים תקפים." }
];

export default async function StaffDashboard() {
  await requireRole(["staff"]);
  return (
    <DashboardShell role="staff" title="ממשק צוות">
      <div className="dashboard-hero-card staff-hero-card"><div><p className="eyebrow">צוות גן</p><h1>נוכחות, משימות, מסמכים ותעודות במקום אחד.</h1><p>איש צוות לא אמור להיות פעיל בלי תעודת יושר, בדיקת רקע ותעודות חובה בתוקף.</p></div><span className="pill warn"><UserCheck size={15} /> בדיקת מסמכים</span></div>
      <div className="grid cols-3 dashboard-kpis"><StatCard label="סטטוס עבודה" value="דורש אימות" tone="warn" /><StatCard label="שעות החודש" value="API" /><StatCard label="משימות" value="API" /></div>
      <section className="dashboard-section"><div className="section-heading"><h2>פעולות צוות</h2><p>המערכת שומרת זמן, מיקום ולוג צפייה לכל פעולה חשובה.</p></div><div className="quick-actions-grid">{staffActions.map((action) => <Link className="quick-action" href={action.href} key={action.label}><action.icon /><strong>{action.label}</strong><span>{action.text}</span></Link>)}</div></section>
      <section className="grid cols-2 dashboard-panels"><article className="card action-panel"><h2>לו״ז היום</h2><div className="risk-list"><div><CalendarClock /> כיתה משויכת <b>לפי מנהל</b></div><div><ClipboardList /> משימות פתוחות <b>במעקב</b></div><div><BadgeCheck /> מסמכי חובה <b>נדרש תוקף</b></div></div></article><article className="card action-panel"><h2>כלל בטיחות</h2><p>אם חסרה תעודת יושר, בדיקת רקע או הכשרה שהוגדרה כחובה, העובד לא אמור להיות מאושר כפעיל.</p></article></section>
    </DashboardShell>
  );
}
