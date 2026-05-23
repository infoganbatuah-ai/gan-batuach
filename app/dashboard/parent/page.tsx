import Link from "next/link";
import { Baby, Camera, CalendarDays, HeartPulse, Image, MessageCircle, ShieldCheck, Siren } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";

const parentActions = [
  { href: "/parent-onboarding", label: "עדכון כרטיס ילד", icon: Baby, text: "בריאות, פרטים, אנשי קשר והסכמות." },
  { href: "/api/parent/messages", label: "פנייה לגן", icon: MessageCircle, text: "שאלה או הודעה מתועדת לגננת." },
  { href: "/api/parent/complaints", label: "הגשת תלונה", icon: Siren, text: "פנייה לגורם מוסמך לפי חומרה." },
  { href: "/api/parent/cameras", label: "צפייה במצלמות", icon: Camera, text: "רק מצלמות מורשות ובחלון צפייה מוגדר." },
  { href: "/api/parent/schedule", label: "לו״ז ותפריט", icon: CalendarDays, text: "סדר יום, אוכל, פעילויות והודעות." },
  { href: "/api/parent/gallery", label: "גלריה", icon: Image, text: "תמונות לפי הרשאות צילום." }
];

export default async function ParentDashboard() {
  await requireRole(["parent"]);
  return (
    <DashboardShell role="parent" title="אזור הורים">
      <div className="dashboard-hero-card parent-hero-card"><div><p className="eyebrow">שקט להורים</p><h1>כל מה שחשוב לדעת על הילד והגן, בלי עומס.</h1><p>נוכחות, איסוף, הודעות, מצלמות, פיקוח, מסמכים ותלונות במקום אחד וברור.</p></div><span className="pill good"><ShieldCheck size={15} /> מידע לפי הרשאה</span></div>
      <div className="grid cols-3 dashboard-kpis"><StatCard label="כרטיס ילד" value="ממתין" tone="warn" /><StatCard label="נוכחות היום" value="טרם עודכן" /><StatCard label="מצלמות מורשות" value="לפי כיתה" /></div>
      <section className="dashboard-section"><div className="section-heading"><h2>פעולות הורה</h2><p>כל פעולה נשמרת ומתועדת כדי להגן על הילד ועל פרטיות המשפחה.</p></div><div className="quick-actions-grid">{parentActions.map((action) => <Link className="quick-action" href={action.href} key={action.label}><action.icon /><strong>{action.label}</strong><span>{action.text}</span></Link>)}</div></section>
      <section className="grid cols-2 dashboard-panels"><article className="card action-panel"><h2>תקציר בטיחות הגן</h2><div className="risk-list"><div><ShieldCheck /> סטטוס גן בטוח <b>לפי הרשאה</b></div><div><HeartPulse /> מידע רפואי <b>ניתן לעדכון</b></div><div><Camera /> צפייה בלייב <b>Token זמני</b></div></div></article><article className="card action-panel"><h2>מה ההורה רואה?</h2><p>הודעות מהגן, נוכחות, איסוף, לו״ז, תפריט, גלריה, פרטי פקח, סיכום ביקורת אחרון וטפסי הסכמה.</p></article></section>
    </DashboardShell>
  );
}
