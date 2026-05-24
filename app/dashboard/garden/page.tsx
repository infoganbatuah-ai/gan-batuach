import Link from "next/link";
import { Bell, CalendarCheck, Camera, ClipboardCheck, FileClock, MessageSquare, Plus, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { Avatar } from "@/components/avatar";
import { ReadyStatusCard } from "@/components/ready-status-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const quickActions = [
  { href: "/dashboard/garden/onboarding", label: "קליטת הורה/ילד", icon: Plus, help: "יצירת הורה, אשף ילד ואישור תלמיד." },
  { href: "/dashboard/garden/onboarding", label: "הוספת הורה", icon: UserPlus, help: "יוצר Auth, פרופיל ולוג ביקורת." },
  { href: "/dashboard/garden/onboarding", label: "הוספת צוות", icon: UsersRound, help: "עובד לא יופעל בלי מסמכי חובה." },
  { href: "/dashboard/garden/attendance", label: "סימון נוכחות", icon: CalendarCheck, help: "נוכחות ילדים וצוות עם לוג שינוי." },
  { href: "/dashboard/garden/messages", label: "שליחת הודעה", icon: MessageSquare, help: "תקשורת מתועדת מול הורים/פקח." },
  { href: "/dashboard/garden/cameras", label: "ניהול מצלמות", icon: Camera, help: "חיבור DVR/RTSP והרשאות הורים." }
];

export default async function GardenDashboard() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id;
  const [gardenRes, childrenRes, staffRes, parentsRes, tasksRes, leadsRes, complaintsRes, violationsRes, camerasRes, aiRes, documentsRes, messagesRes, inspectionRes] = await Promise.all([
    supabase.from("gardens" as any).select("id, name, city, logo_url, image_url, safe_status, first_inspection_due_at, last_inspection_score").eq("id", gardenId ?? "").maybeSingle(),
    supabase.from("children").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? ""),
    supabase.from("staff").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? ""),
    supabase.from("parents").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? ""),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "done"),
    supabase.from("leads").select("id, parent_name, phone, child_name, child_age, status, created_at", { count: "exact" }).eq("garden_id", gardenId ?? "").eq("lead_type", "parent").limit(5),
    supabase.from("complaints").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "closed"),
    supabase.from("violations").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "done"),
    supabase.from("camera_streams").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "online"),
    supabase.from("ai_events").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "closed"),
    supabase.from("documents").select("name, document_type, expires_at, status").eq("garden_id", gardenId ?? "").limit(4),
    supabase.from("messages").select("id, subject, content, body, created_at, status").eq("garden_id", gardenId ?? "").eq("recipient_id", profile.id).order("created_at", { ascending: false }).limit(4),
    supabase.from("inspections" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").eq("status", "done")
  ]);
  const garden = gardenRes.data as any;
  const readyItems = [
    { label: "מסמכי גן", ok: (documentsRes.data ?? []).length > 0, help: "לפחות מסמך אחד הועלה ונמצא במעקב." },
    { label: "צוות מאושר", ok: (staffRes.count ?? 0) > 0, help: "יש אנשי צוות פעילים/בתהליך אישור." },
    { label: "ביקורת ראשונה", ok: (inspectionRes.count ?? 0) > 0, help: "בוצעה לפחות ביקורת אחת." },
    { label: "ילדים פעילים", ok: (childrenRes.count ?? 0) > 0, help: "יש כרטיסי ילדים פעילים." },
    { label: "הורים משויכים", ok: (parentsRes.count ?? 0) > 0, help: "יש הורים מחוברים למערכת." },
    { label: "מצלמות מוגדרות", ok: (camerasRes.count ?? 0) === 0, help: "אין תקלות מצלמה פתוחות." },
    { label: "מדיניות ותקנונים", ok: true, help: "שער אישור תקנון פעיל בכניסה." }
  ];

  return (
    <DashboardShell role="manager" title="ממשק גן">
      <div className="dashboard-hero-card garden-hero-card premium-identity-hero">
        <div>
          <p className="eyebrow">ניהול יומי</p>
          <h1>בוקר טוב, {garden?.name ?? "הגן שלך"}.</h1>
          <p>{garden?.city ? `${garden.city} · ` : ""}לידים, ילדים, צוות, בריאות, איסוף, משימות, מצלמות ומסמכים במקום אחד.</p>
        </div>
        <Avatar name={garden?.name} src={garden?.logo_url ?? garden?.image_url} size="lg" />
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
        <ReadyStatusCard items={readyItems} />
        <article className="card action-panel"><div className="section-heading"><h2>יום עבודה בקליק</h2><p>מסלולים מהירים לניהול היומי שהכי חשוב לגן.</p></div><div className="quick-actions-grid compact"><Link className="quick-action" href="/dashboard/garden/child-journal">יומן ילד<span>עדכון יומי להורים</span></Link><Link className="quick-action" href="/dashboard/garden/health">בריאות ותרופות<span>אלרגיות ואישורים</span></Link><Link className="quick-action" href="/dashboard/garden/pickup">איסוף והחזרה<span>מורשים ו-GPS</span></Link><Link className="quick-action" href="/dashboard/garden/incidents">דיווח אירוע<span>ציר טיפול ותיעוד</span></Link></div></article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel"><div className="section-heading"><h2>הודעות אדמין</h2><p>הודעות שנשלחו מהאדמין למנהלת או לבעלים.</p></div>{(messagesRes.data ?? []).length === 0 ? <div className="empty-mini">אין הודעות חדשות.</div> : (messagesRes.data ?? []).map((message: any) => <div className="list-item" key={message.id}><div><strong>{message.subject}</strong><span>{message.content ?? message.body}</span></div><span className="pill">{message.status ?? "unread"}</span></div>)}</article>
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
