import Link from "next/link";
import { Bell, CalendarCheck, Camera, ClipboardCheck, FileClock, MessageSquare, Plus, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const quickActions = [
  { href: "/api/children", label: "הוספת ילד", icon: Plus, help: "פתיחת תלמיד ראשוני והזמנת הורה להשלים פרטים." },
  { href: "/api/parents", label: "הוספת הורה", icon: UserPlus, help: "יצירת קשר הורה וחיבור לילד/גן." },
  { href: "/api/staff", label: "הוספת צוות", icon: UsersRound, help: "עובד לא יופעל בלי מסמכי חובה." },
  { href: "/api/attendance", label: "סימון נוכחות", icon: CalendarCheck, help: "נוכחות ילדים וצוות עם לוג שינוי." },
  { href: "/api/messages", label: "שליחת הודעה", icon: MessageSquare, help: "תקשורת מתועדת מול הורים/פקח." },
  { href: "/dashboard/garden/cameras", label: "ניהול מצלמות", icon: Camera, help: "חיבור DVR/RTSP והרשאות הורים." }
];

export default async function GardenDashboard() {
  const { profile } = await requireRole(["manager"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id;
  const [childrenRes, staffRes, tasksRes, leadsRes, complaintsRes, violationsRes, camerasRes, aiRes, documentsRes] = await Promise.all([
    supabase.from("children").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? ""),
    supabase.from("staff").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? ""),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "done"),
    supabase.from("leads").select("id, parent_name, phone, child_name, child_age, status, created_at", { count: "exact" }).eq("garden_id", gardenId ?? "").eq("lead_type", "parent").limit(5),
    supabase.from("complaints").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "closed"),
    supabase.from("violations").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "done"),
    supabase.from("camera_streams").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "online"),
    supabase.from("ai_events").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "closed"),
    supabase.from("documents").select("name, document_type, expires_at, status").eq("garden_id", gardenId ?? "").limit(4)
  ]);

  return (
    <DashboardShell role="manager" title="ממשק גן">
      <div className="dashboard-hero-card garden-hero-card">
        <div>
          <p className="eyebrow">ניהול יומי</p>
          <h1>בוקר טוב, הנה מה שדורש תשומת לב בגן.</h1>
          <p>לידים, אישורי ילדים, משימות תיקון, מצלמות, מסמכים ואירועי בטיחות במקום אחד.</p>
        </div>
        <span className="pill good"><ShieldCheck size={15} /> סטטוס ניהול פעיל</span>
      </div>

      <div className="grid cols-4 dashboard-kpis">
        <StatCard label="תלמידים פעילים" value={childrenRes.count ?? 0} tone="good" />
        <StatCard label="אנשי צוות" value={staffRes.count ?? 0} />
        <StatCard label="לידים ממתינים" value={leadsRes.count ?? 0} tone="warn" />
        <StatCard label="משימות פתוחות" value={tasksRes.count ?? 0} tone="warn" />
      </div>

      <section className="dashboard-section">
        <div className="section-heading"><h2>פעולות מהירות</h2><p>כל פעולה פותחת תהליך מתועד עם הרשאות ולוגים.</p></div>
        <div className="quick-actions-grid">
          {quickActions.map((action) => (
            <Link className="quick-action" href={action.href} key={action.label}>
              <action.icon size={22} />
              <strong>{action.label}</strong>
              <span>{action.help}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel"><div className="section-heading"><h2>לידים חדשים מהורים</h2><p>אשרו, דחו, צרו קשר או בקשו פרטים נוספים.</p></div>{(leadsRes.data ?? []).length === 0 ? <div className="empty-mini">אין לידים חדשים כרגע.</div> : (leadsRes.data ?? []).map((lead: any) => <div className="list-item" key={lead.id}><div><strong>{lead.parent_name}</strong><span>{lead.phone} · {lead.child_name ?? "ילד/ה"} · {lead.child_age ?? "גיל לא צוין"}</span></div><span className="pill warn">{lead.status}</span></div>)}</article>
        <article className="card action-panel"><div className="section-heading"><h2>ציות ותפעול</h2><p>פריטים שדורשים טיפול לפני ביקורת או במהלך החודש.</p></div><div className="risk-list"><div><Bell /> תלונות פתוחות <b>{complaintsRes.count ?? 0}</b></div><div><ClipboardCheck /> ליקויי ביקורת <b>{violationsRes.count ?? 0}</b></div><div><Camera /> תקלות מצלמה <b>{camerasRes.count ?? 0}</b></div><div><FileClock /> מסמכים למעקב <b>{documentsRes.data?.length ?? 0}</b></div></div></article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>מסמכים שפג תוקפם בקרוב</h2><p>ביטוח, בטיחות, תברואה, עזרה ראשונה, פרטיות ואישורי מצלמות.</p></div>
        <div className="document-strip">{(documentsRes.data ?? []).length === 0 ? <div className="empty-mini">אין מסמכים להצגה.</div> : (documentsRes.data ?? []).map((doc: any) => <div className="document-chip" key={`${doc.name}-${doc.document_type}`}><strong>{doc.name}</strong><span>{doc.document_type} · {doc.expires_at ? new Date(doc.expires_at).toLocaleDateString("he-IL") : "ללא תוקף"}</span></div>)}</div>
      </section>
    </DashboardShell>
  );
}
