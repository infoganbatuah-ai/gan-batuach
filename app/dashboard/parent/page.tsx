import Link from "next/link";
import { Baby, Camera, CalendarDays, HeartPulse, Image, MessageCircle, ShieldCheck, Siren } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const parentActions = [
  { href: "/parent-onboarding", label: "עדכון כרטיס ילד", icon: Baby, text: "בריאות, פרטים, אנשי קשר והסכמות." },
  { href: "/dashboard/parent/messages", label: "פנייה לגן", icon: MessageCircle, text: "שאלה או הודעה מתועדת לגננת." },
  { href: "/dashboard/parent/complaints", label: "הגשת תלונה", icon: Siren, text: "פנייה לגורם מוסמך לפי חומרה." },
  { href: "/dashboard/parent/cameras", label: "צפייה במצלמות", icon: Camera, text: "רק מצלמות מורשות ובחלון צפייה מוגדר." },
  { href: "/dashboard/parent/schedule", label: "לו״ז ותפריט", icon: CalendarDays, text: "סדר יום, אוכל, פעילויות והודעות." },
  { href: "/dashboard/parent/gallery", label: "גלריה", icon: Image, text: "תמונות לפי הרשאות צילום." }
];

export default async function ParentDashboard() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const { data: latestInspection } = await supabase.from("inspections" as any).select("id, completed_at, weighted_score, violation_count").eq("garden_id", profile.garden_id ?? "").eq("status", "done").order("completed_at", { ascending: false }).limit(1).maybeSingle();
  return (
    <DashboardShell role="parent" title="אזור הורים">
      <div className="dashboard-hero-card parent-hero-card"><div><p className="eyebrow">שקט להורים</p><h1>כל מה שחשוב לדעת על הילד והגן, בלי עומס.</h1><p>נוכחות, איסוף, הודעות, מצלמות, פיקוח, מסמכים ותלונות במקום אחד וברור.</p></div><span className="pill good"><ShieldCheck size={15} /> מידע לפי הרשאה</span></div>
      <div className="grid cols-3 dashboard-kpis"><StatCard label="כרטיס ילד" value="ממתין" tone="warn" /><StatCard label="נוכחות היום" value="טרם עודכן" /><StatCard label="מצלמות מורשות" value="לפי כיתה" /></div>
      <section className="dashboard-section"><div className="section-heading"><h2>פעולות הורה</h2><p>כל פעולה נשמרת ומתועדת כדי להגן על הילד ועל פרטיות המשפחה.</p></div><div className="quick-actions-grid">{parentActions.map((action) => <Link className="quick-action" href={action.href} key={action.label}><action.icon /><strong>{action.label}</strong><span>{action.text}</span></Link>)}</div></section>
      <section className="grid cols-2 dashboard-panels"><article className="card action-panel"><h2>תקציר בטיחות הגן</h2><div className="risk-list"><div><ShieldCheck /> סטטוס גן בטוח <b>לפי הרשאה</b></div><div><HeartPulse /> מידע רפואי <b>ניתן לעדכון</b></div><div><Camera /> צפייה בלייב <b>Token זמני</b></div></div></article><article className="card action-panel"><h2>דוח ביקורת אחרון</h2>{latestInspection ? <div className="list-item"><div><strong>ציון {latestInspection.weighted_score ?? "-"}</strong><span>{latestInspection.completed_at ? new Date(latestInspection.completed_at).toLocaleDateString("he-IL") : ""} · ליקויים {latestInspection.violation_count ?? 0}</span></div><Link className="button secondary" href={`/api/inspections/${latestInspection.id}/report?format=view`}>צפייה בדוח</Link></div> : <p>עדיין אין דוח ביקורת מאושר להצגה.</p>}</article></section>
    </DashboardShell>
  );
}
