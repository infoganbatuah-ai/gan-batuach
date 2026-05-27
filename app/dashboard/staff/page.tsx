import Link from "next/link";
import { AlertTriangle, BadgeCheck, CalendarClock, ClipboardList, FileCheck2, HeartPulse, MapPin, MessageSquare, Timer, UserCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { SimpleCommandCenter } from "@/components/simple-command-center";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";

const staffActions = [
  { href: "/dashboard/staff/attendance", label: "כניסה / יציאה", icon: MapPin, text: "בדיקת GPS מול כתובת הגן." },
  { href: "/dashboard/staff/shifts", label: "שעות חודשיות", icon: Timer, text: "חישוב שעות, איחורים וחוסרים." },
  { href: "/dashboard/staff/tasks", label: "משימות", icon: ClipboardList, text: "משימות צוות וצפייה מי ראה." },
  { href: "/dashboard/staff/messages", label: "הודעות", icon: MessageSquare, text: "תקשורת פנימית מתועדת." },
  { href: "/dashboard/staff/certificates", label: "תעודות", icon: FileCheck2, text: "עזרה ראשונה, הכשרות ותוקף." },
  { href: "/dashboard/staff/background", label: "בדיקות רקע", icon: BadgeCheck, text: "אישור עבודה רק עם מסמכים תקפים." }
];

export default async function StaffDashboard() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const [staffRes, tasksRes, certsRes, docsRes, attentionRes] = await Promise.all([
    supabase.from("staff" as any).select("id, full_name, role, profile_photo_url, approved_to_work, background_check_status, police_clearance_status").eq("profile_id", profile.id).maybeSingle(),
    supabase.from("tasks" as any).select("id", { count: "exact", head: true }).eq("assigned_to", profile.id).neq("status", "done"),
    supabase.from("staff_certificates" as any).select("id", { count: "exact", head: true }).eq("garden_id", profile.garden_id ?? ""),
    supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("uploaded_by", profile.id).in("status", ["missing", "expired", "rejected"]),
    supabase.from("children" as any).select("id", { count: "exact", head: true }).eq("garden_id", profile.garden_id ?? "").or("allergies.not.is.null,medical_notes.not.is.null")
  ]);
  const staff = staffRes.data as any;
  const staffCommandItems = [
    { title: "החתמת נוכחות", count: "עכשיו", description: "כניסה/יציאה עם בדיקת GPS", href: "/dashboard/staff/attendance", tone: "warn" as const, icon: MapPin },
    { title: "משימות היום", count: tasksRes.count ?? 0, description: "מה שהמנהלת ביקשה לבצע", href: "/dashboard/staff/tasks", tone: (tasksRes.count ?? 0) ? "warn" as const : "good" as const, icon: ClipboardList },
    { title: "ילדים לתשומת לב", count: attentionRes.count ?? 0, description: "אלרגיות, הערות בריאות או רגישויות", href: "/dashboard/staff/child-journal", tone: (attentionRes.count ?? 0) ? "warn" as const : "good" as const, icon: HeartPulse },
    { title: "מסמכים חסרים", count: docsRes.count ?? 0, description: "מסמכי עובד שצריך להשלים", href: "/dashboard/staff/documents", tone: (docsRes.count ?? 0) ? "bad" as const : "good" as const, icon: FileCheck2 },
    { title: "דיווח אירוע", count: "מהיר", description: "אם קרה משהו חריג, מתעדים מיד", href: "/dashboard/staff/child-journal", tone: "good" as const, icon: AlertTriangle },
    { title: "הודעה למנהלת", count: "פתיחה", description: "שאלה או עדכון לצוות הניהול", href: "/dashboard/staff/messages", tone: "good" as const, icon: MessageSquare }
  ];
  return (
    <DashboardShell role="staff" title="ממשק צוות">
      <div className="dashboard-hero-card staff-hero-card premium-identity-hero"><div><p className="eyebrow">צוות גן</p><h1>{staff?.full_name ?? profile.full_name ?? "ממשק צוות"}</h1><p>נוכחות, משימות, יומן ילד, מסמכים ותעודות במקום אחד.</p></div><Avatar name={staff?.full_name ?? profile.full_name} src={staff?.profile_photo_url ?? profile.profile_image_url} size="lg" /><span className={staff?.approved_to_work ? "pill good" : "pill warn"}><UserCheck size={15} /> {staff?.approved_to_work ? "מאושר/ת לעבודה" : "ממתין לאישור"}</span></div>
      <div className="grid cols-3 dashboard-kpis"><StatCard label="סטטוס עבודה" value={staff?.approved_to_work ? "פעיל" : "דורש אימות"} tone={staff?.approved_to_work ? "good" : "warn"} /><StatCard label="תעודות במערכת" value={certsRes.count ?? 0} /><StatCard label="משימות פתוחות" value={tasksRes.count ?? 0} /></div>
      <SimpleCommandCenter title="מה לעשות במשמרת עכשיו?" subtitle="מצב פשוט לצוות: רק הדברים שצריך לבצע היום, בלי כספים ובלי מסכים מורכבים." items={staffCommandItems} />
      <section className="staff-operating-center"><div><p className="eyebrow">Operating Center</p><h2>מה חשוב במשמרת היום?</h2><p>כניסה/יציאה, ילדים רגישים, משימות, מסמכים והכשרות.</p></div><div className="spotlight-metrics"><span>ילדים לתשומת לב <b>{attentionRes.count ?? 0}</b></span><span>מסמכים חסרים <b>{docsRes.count ?? 0}</b></span><span>הכשרות <b>{certsRes.count ?? 0}</b></span></div></section>
      <section className="dashboard-section"><div className="section-heading"><h2>פעולות צוות</h2><p>המערכת שומרת זמן, מיקום ולוג צפייה לכל פעולה חשובה.</p></div><div className="quick-actions-grid">{staffActions.map((action) => <Link className="quick-action" href={action.href} key={action.label}><action.icon /><strong>{action.label}</strong><span>{action.text}</span></Link>)}</div></section>
      <section className="grid cols-2 dashboard-panels"><article className="card action-panel"><h2>לו״ז היום</h2><div className="risk-list"><div><CalendarClock /> כיתה משויכת <b>לפי מנהל</b></div><div><ClipboardList /> משימות פתוחות <b>במעקב</b></div><div><BadgeCheck /> מסמכי חובה <b>נדרש תוקף</b></div></div></article><article className="card action-panel"><h2>כלל בטיחות</h2><p>אם חסרה תעודת יושר, בדיקת רקע או הכשרה שהוגדרה כחובה, העובד לא אמור להיות מאושר כפעיל.</p></article></section>
    </DashboardShell>
  );
}
