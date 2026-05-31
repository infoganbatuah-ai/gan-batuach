import { AlertTriangle, ClipboardList, FileCheck2, HeartPulse, MapPin, MessageSquare, UserCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { SimpleCommandCenter } from "@/components/simple-command-center";
import { StaffOneHandMode } from "@/components/staff-one-hand-mode";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";

export default async function StaffDashboard() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const [staffRes, tasksRes, certsRes, docsRes, attentionRes, childrenRes] = await Promise.all([
    supabase.from("staff" as any).select("id, full_name, role, profile_photo_url, approved_to_work, background_check_status, police_clearance_status").eq("profile_id", profile.id).maybeSingle(),
    supabase.from("tasks" as any).select("id", { count: "exact", head: true }).eq("assigned_to", profile.id).neq("status", "done"),
    supabase.from("staff_certificates" as any).select("id", { count: "exact", head: true }).eq("garden_id", profile.garden_id ?? ""),
    supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("uploaded_by", profile.id).in("status", ["missing", "expired", "rejected"]),
    supabase.from("children" as any).select("id", { count: "exact", head: true }).eq("garden_id", profile.garden_id ?? "").or("allergies.not.is.null,medical_notes.not.is.null"),
    supabase.from("children" as any).select("id, garden_id, full_name, photo_url, face_image_url, allergies, medical_notes").eq("garden_id", profile.garden_id ?? "").in("status", ["active", "approved"]).order("full_name").limit(24)
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
      <div className="dashboard-hero-card staff-hero-card premium-identity-hero"><div><p className="eyebrow">מסך עבודה יומי</p><h1>{staff?.full_name ?? profile.full_name ?? "ממשק צוות"}</h1><p>מה שצריך למשמרת: כניסה/יציאה, ילדים לעדכון, משימות, אירוע והודעה למנהלת. בלי כספים ובלי ניתוחים.</p></div><Avatar name={staff?.full_name ?? profile.full_name} src={staff?.profile_photo_url ?? profile.profile_image_url} size="lg" /><span className={staff?.approved_to_work ? "pill good" : "pill warn"}><UserCheck size={15} /> {staff?.approved_to_work ? "מאושר/ת לעבודה" : "ממתין לאישור"}</span></div>
      <div className="grid cols-3 dashboard-kpis zero-click-kpis"><StatCard label="סטטוס עבודה" value={staff?.approved_to_work ? "פעיל" : "דורש אימות"} tone={staff?.approved_to_work ? "good" : "warn"} /><StatCard label="ילדים לעדכון" value={attentionRes.count ?? 0} tone={attentionRes.count ? "warn" : "good"} /><StatCard label="משימות פתוחות" value={tasksRes.count ?? 0} tone={tasksRes.count ? "warn" : "good"} /></div>
      <SimpleCommandCenter title="מה לעשות במשמרת עכשיו?" subtitle="מצב פשוט לצוות: רק הדברים שצריך לבצע היום, בלי כספים ובלי מסכים מורכבים." items={staffCommandItems} />
      <StaffOneHandMode children={(childrenRes.data ?? []) as any[]} />
      {(docsRes.count ?? 0) > 0 ? <section className="staff-operating-center"><div><p className="eyebrow">נדרש ממך</p><h2>חסרים מסמכי צוות</h2><p>השלמת המסמכים עוזרת למנהלת לסמן אותך כמאושר/ת לעבודה.</p></div><div className="spotlight-metrics"><span>מסמכים חסרים <b>{docsRes.count ?? 0}</b></span><span>תעודות במערכת <b>{certsRes.count ?? 0}</b></span></div></section> : null}
    </DashboardShell>
  );
}
