import { redirect } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Camera,
  ClipboardCheck,
  LogIn,
  LogOut,
  Megaphone,
  MessageCircle,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UsersRound
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenDashboard() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  if (!gardenId) redirect("/onboarding/kindergarten");

  const supabase = await createClient();
  const [
    gardenRes,
    childrenRes,
    enrollmentRes,
    documentsRes,
    inspectionsRes,
    messagesRes
  ] = await Promise.all([
    supabase.from("gardens" as any).select("id,name,city,status,approval_flow_status,final_approval_status,safe_status,last_inspection_score,next_inspection_at").eq("id", gardenId).maybeSingle(),
    supabase.from("children" as any).select("id,status", { count: "exact", head: true }).eq("garden_id", gardenId).in("status", ["active", "approved"]),
    supabase.from("kindergarten_enrollment_requests" as any).select("id,status", { count: "exact" }).eq("garden_id", gardenId).in("status", ["submitted", "under_review", "more_information_requested", "approved_pending_payment"]).limit(6),
    supabase.from("documents" as any).select("id,status,expires_at", { count: "exact" }).eq("garden_id", gardenId).in("status", ["missing", "expired", "rejected", "pending_review"]).limit(6),
    supabase.from("required_inspections" as any).select("id,title,status,due_at", { count: "exact" }).eq("garden_id", gardenId).neq("status", "done").order("due_at", { ascending: true }).limit(4),
    supabase.from("messages" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).is("read_at", null)
  ]);

  const garden = gardenRes.data as any;
  if (!garden) redirect("/onboarding/kindergarten");

  const pendingRequests = ((enrollmentRes.data ?? []) as any[]).filter((row) => row.status !== "approved_pending_payment").length;
  const waitingPaymentRequests = ((enrollmentRes.data ?? []) as any[]).filter((row) => row.status === "approved_pending_payment").length;
  const nextInspection = ((inspectionsRes.data ?? []) as any[])[0];
  const documentsToHandle = documentsRes.count ?? 0;
  const childrenCount = childrenRes.count ?? 0;
  const todayPriority = pendingRequests
    ? { title: `${pendingRequests} בקשות רישום מחכות`, text: "אישור, דחייה או בקשת מידע מהורה.", href: "/dashboard/garden/enrollment-requests", tone: "warn" }
    : waitingPaymentRequests
      ? { title: `${waitingPaymentRequests} ילדים ממתינים לתשלום`, text: "לא נפתחת גישה מלאה עד הפעלה או החלטת מנהלת.", href: "/dashboard/garden/enrollment-requests", tone: "warn" }
      : documentsToHandle
        ? { title: `${documentsToHandle} מסמכים דורשים טיפול`, text: "השלמת מסמכים ותוקף לפני שהדבר הופך לבעיה.", href: "/dashboard/garden/documents", tone: "warn" }
        : nextInspection
          ? { title: "פיקוח קרוב", text: `${nextInspection.title ?? "ביקורת"} · ${nextInspection.due_at ? new Date(nextInspection.due_at).toLocaleDateString("he-IL") : "תאריך לא נקבע"}`, href: "/dashboard/garden/inspections", tone: "default" }
          : { title: "הגן רגוע כרגע", text: "אין פעולות דחופות. אפשר להמשיך לניהול ילדים, צוות או מסמכים.", href: "/dashboard/garden/command-center", tone: "good" };
  const occupancy = childrenCount ? Math.min(99, Math.round((childrenCount / Math.max(childrenCount + pendingRequests + 1, 1)) * 100)) : 0;
  const checkedIn = Math.max(childrenCount - Math.max(waitingPaymentRequests, 0), 0);
  const checkedOut = Math.min(Math.max(waitingPaymentRequests, 0), childrenCount);
  const capacity = Math.max(childrenCount + pendingRequests + 1, 1);
  const groups = [
    { name: "גן לב", age: "2-3", icon: "❤️", count: "19/21", percent: "89%" },
    { name: "גן פרח", age: "2-3", icon: "🌺", count: "15/18", percent: "83%" },
    { name: "גן ענן", age: "3-4", icon: "☁️", count: "18/20", percent: "90%" },
    { name: "גן שמש", age: "4-5", icon: "☀️", count: "21/24", percent: "88%" },
    { name: "גן כוכב", age: "3-4", icon: "⭐", count: "17/18", percent: "94%" }
  ];
  const schedule = [
    ["08:00", "קבלת ילדים", "😊"],
    ["09:00", "ארוחת בוקר", "🍽️"],
    ["10:00", "פעילות למידה", "📖"],
    ["11:30", "חצר ומשחק חופשי", "🏃"],
    ["12:15", "ארוחת צהריים", "🍴"],
    ["13:00", "שעת סיפור", "🌙"],
    ["14:00", "מנוחה/שקט", "💤"]
  ];

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="בית הגן" appHome>
      <main className="ganenet-reference-phone" dir="rtl">
        <div className="ganenet-statusbar" aria-hidden="true">
          <b>9:41</b>
          <span>▮▮▮ WiFi ▰</span>
        </div>

        <header className="ganenet-reference-header">
          <a className="ganenet-bell" href="/dashboard/garden/notifications" aria-label="התראות">
            <Bell size={34} />
            <i />
          </a>
          <div className="ganenet-greeting">
            <div className="ganenet-avatar">
              {(profile as any).avatar_url ? <img src={(profile as any).avatar_url} alt="" /> : <span>{profile.full_name?.slice(0, 1) ?? "מ"}</span>}
              <i />
            </div>
            <div>
              <h1>בוקר טוב, {profile.full_name?.split(" ")[0] ?? "מאיה"} ☀️</h1>
              <p>{garden.name ?? "גונמה גן ילדים"}, {garden.city ?? "תל אביב"}</p>
            </div>
          </div>
        </header>

        <section className="ganenet-kpis">
          <a className="ganenet-kpi occupancy" href="/dashboard/garden/children">
            <strong>תפוסת הגן</strong>
            <div className="ganenet-gauge" style={{ "--value": `${occupancy}%` } as any}>
              <b>{occupancy}%</b>
              <span>{childrenCount}/{capacity}</span>
            </div>
            <em>ילדים בגן</em>
          </a>
          <a className="ganenet-kpi green" href="/dashboard/garden/attendance">
            <span><UserCheck size={42} /></span>
            <strong>נוכחות היום</strong>
            <b>{childrenCount}</b>
            <small>{checkedIn} נכנסו</small>
          </a>
          <a className="ganenet-kpi blue" href="/dashboard/garden/attendance">
            <span><LogIn size={42} /></span>
            <strong>צ׳ק-אין</strong>
            <b>{checkedIn}</b>
            <small>09:00 ✓</small>
          </a>
          <a className="ganenet-kpi orange" href="/dashboard/garden/attendance">
            <span><LogOut size={42} /></span>
            <strong>צ׳ק-אאוט</strong>
            <b>{checkedOut}</b>
            <small>עד כה היום</small>
          </a>
        </section>

        <section className="ganenet-card ganenet-actions">
          <div className="ganenet-section-title">
            <a href="/dashboard/garden/command-center">צפו בכל הפעולות ›</a>
            <h2>פעולות מהירות</h2>
          </div>
          <div className="ganenet-action-row">
            {[
              ["שליחת הודעה", "/dashboard/garden/messages", Megaphone, "orange"],
              ["תיעוד פעילות", "/dashboard/garden/daily-journal", Camera, "pink"],
              ["רשימת נוכחות", "/dashboard/garden/attendance", ClipboardCheck, "cyan"],
              ["הוספת ילד", "/dashboard/garden/children", Plus, "purple"],
              ["לוח זמנים", "/dashboard/garden/daily-journal", CalendarDays, "blue"]
            ].map(([label, href, Icon, tone]) => (
              <a className={`ganenet-action ${tone}`} href={href as string} key={label as string}>
                <span>{<Icon size={35} />}</span>
                <b>{label as string}</b>
              </a>
            ))}
          </div>
        </section>

        <section className="ganenet-card ganenet-groups">
          <div className="ganenet-section-title">
            <a href="/dashboard/garden/children">צפו בכל הקבוצות ›</a>
            <h2>סטטוס כיתות / קבוצות</h2>
          </div>
          <div className="ganenet-group-row">
            {groups.map((group) => (
              <a className="ganenet-group" href="/dashboard/garden/children" key={group.name}>
                <h3>{group.name}</h3>
                <p>גיל {group.age}</p>
                <span>{group.icon}</span>
                <div><b>{group.percent}</b></div>
                <small>👥 {group.count}</small>
                <em>תקין</em>
              </a>
            ))}
          </div>
        </section>

        <section className="ganenet-three-columns">
          <article className="ganenet-card ganenet-schedule">
            <h2><CalendarDays size={24} /> לוח זמנים להיום</h2>
            <ul>
              {schedule.map(([time, label, icon]) => (
                <li key={time}><b>{time}</b><span>{icon}</span><em>{label}</em></li>
              ))}
            </ul>
            <a href="/dashboard/garden/daily-journal">צפיה בלוח המלא ›</a>
          </article>

          <article className="ganenet-card ganenet-staff">
            <h2><UsersRound size={24} /> צוות בתפקיד</h2>
            {[
              [profile.full_name ?? "מאיה לוי", "גננת", "את"],
              ["שרון כהן", "סייעת", ""],
              ["נועה פרידמן", "סייעת", ""],
              ["עדי בר", "מטפלת רגשית", ""]
            ].map(([name, role, tag]) => (
              <div className="ganenet-staff-row" key={name}>
                <span>{name.slice(0, 1)}</span>
                <p><b>{name}</b><small>{role}</small></p>
                {tag ? <em>{tag}</em> : null}
                <i />
              </div>
            ))}
            <a href="/dashboard/garden/staff">צפו בכל הצוות ›</a>
          </article>

          <article className="ganenet-card ganenet-alerts">
            <h2><ShieldAlert size={24} /> התראות בטיחות</h2>
            {documentsToHandle ? <div className="alert red"><b>מסמכים לטיפול</b><small>{documentsToHandle} דורשים בדיקה</small></div> : null}
            {nextInspection ? <div className="alert orange"><b>פיקוח קרוב</b><small>{nextInspection.due_at ? new Date(nextInspection.due_at).toLocaleDateString("he-IL") : "תאריך לא נקבע"}</small></div> : null}
            {!documentsToHandle && !nextInspection ? <div className="alert blue"><b>הכל תקין</b><small>אין התראות פתוחות</small></div> : null}
            <a href="/dashboard/garden/incidents">צפו בכל ההתראות ›</a>
          </article>
        </section>

        <section className="ganenet-bottom-grid">
          <article className="ganenet-card ganenet-ai">
            <div className="ganenet-bot"><span /></div>
            <div>
              <h2>תובנות AI ✨</h2>
              <p>{todayPriority.title}. {todayPriority.text}</p>
              <a href={todayPriority.href}>לכל התובנות ›</a>
            </div>
          </article>
          <article className="ganenet-card ganenet-insights">
            <h2>תובנות יומיות</h2>
            <div>
              <span><b>+8%</b><small>נוכחות גבוהה מהרגיל</small></span>
              <span><b>-2</b><small>עזיבות מוקדמות פחות מהרגיל</small></span>
              <span><b>+3</b><small>הודעות להורים נשלחו היום</small></span>
            </div>
            <a href="/dashboard/garden/insights">לכל התובנות ›</a>
          </article>
        </section>

        <nav className="ganenet-bottom-nav" aria-label="ניווט גננת">
          <a href="/dashboard/garden/command-center"><span>•••</span><b>עוד</b></a>
          <a href="/dashboard/garden/messages"><MessageCircle size={26} /><i>{messagesRes.count ?? 0}</i><b>הודעות</b></a>
          <a className="active" href="/dashboard/garden"><span><ShieldCheck size={36} /></span><b>דאשבורד</b></a>
          <a href="/dashboard/garden/children"><UsersRound size={28} /><b>ילדים</b></a>
          <a href="/dashboard/garden/daily-journal"><CalendarDays size={28} /><b>יומן</b></a>
        </nav>
      </main>
    </DashboardShell>
  );
}
