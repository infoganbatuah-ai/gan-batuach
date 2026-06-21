import Image from "next/image";
import { redirect } from "next/navigation";
import {
  Bell,
  BarChart3,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronLeft,
  ClipboardCheck,
  Home,
  Megaphone,
  MessageCircle,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UsersRound,
  Zap
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenDashboard() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  if (!gardenId) redirect("/onboarding/kindergarten");

  const supabase = await createClient();
  const [gardenRes, childrenRes, enrollmentRes, documentsRes, inspectionsRes, messagesRes] = await Promise.all([
    supabase.from("gardens" as any).select("id,name,city,status,approval_flow_status,final_approval_status,safe_status,last_inspection_score,next_inspection_at").eq("id", gardenId).maybeSingle(),
    supabase.from("children" as any).select("id,status", { count: "exact", head: true }).eq("garden_id", gardenId).in("status", ["active", "approved"]),
    supabase.from("kindergarten_enrollment_requests" as any).select("id,status", { count: "exact" }).eq("garden_id", gardenId).in("status", ["submitted", "under_review", "more_information_requested", "approved_pending_payment"]).limit(6),
    supabase.from("documents" as any).select("id,status,expires_at", { count: "exact" }).eq("garden_id", gardenId).in("status", ["missing", "expired", "rejected", "pending_review"]).limit(6),
    supabase.from("required_inspections" as any).select("id,title,status,due_at", { count: "exact" }).eq("garden_id", gardenId).neq("status", "done").order("due_at", { ascending: true }).limit(4),
    supabase.from("messages" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).is("read_at", null)
  ]);

  const garden = gardenRes.data as any;
  if (!garden) redirect("/onboarding/kindergarten");

  const cleanDemoText = (value?: string | null, fallback = "") =>
    (value ?? fallback).replace(/\[DEMO\]/g, "").replace(/\s+/g, " ").trim();
  const cleanProfileName = cleanDemoText(profile.full_name, "רונית");
  const teacherFirstName = cleanProfileName.split(" ").filter(Boolean)[0] || "רונית";
  const displayGardenName = cleanDemoText(garden.name, "גן הפרחים") || "גן הפרחים";
  const rawAvatarUrl = (profile as any).avatar_url;
  const avatarUrl = typeof rawAvatarUrl === "string" && rawAvatarUrl.trim() ? rawAvatarUrl : "/assets/teacher-avatar.svg";

  const pendingRequests = ((enrollmentRes.data ?? []) as any[]).filter((row) => row.status !== "approved_pending_payment").length;
  const waitingPaymentRequests = ((enrollmentRes.data ?? []) as any[]).filter((row) => row.status === "approved_pending_payment").length;
  const nextInspection = ((inspectionsRes.data ?? []) as any[])[0];
  const documentsToHandle = documentsRes.count ?? 0;
  const childrenCount = childrenRes.count ?? 0;
  const capacity = Math.max(childrenCount + pendingRequests + 4, 28);
  const checkedIn = Math.max(childrenCount - Math.max(waitingPaymentRequests, 0), 0);
  const absent = Math.max(capacity - checkedIn, 0);
  const occupancy = childrenCount ? Math.min(99, Math.round((childrenCount / capacity) * 100)) : 0;
  const todayPriority = pendingRequests
    ? { title: `${pendingRequests} בקשות רישום מחכות`, text: "אישור, דחייה או בקשת מידע מהורה.", href: "/dashboard/garden/enrollment-requests" }
    : waitingPaymentRequests
      ? { title: `${waitingPaymentRequests} ילדים ממתינים לתשלום`, text: "לא נפתחת גישה מלאה עד הפעלה או החלטת מנהלת.", href: "/dashboard/garden/enrollment-requests" }
      : documentsToHandle
        ? { title: `${documentsToHandle} מסמכים דורשים טיפול`, text: "השלמת מסמכים ותוקף לפני שהדבר הופך לבעיה.", href: "/dashboard/garden/documents" }
        : nextInspection
          ? { title: "פיקוח קרוב", text: `${nextInspection.title ?? "ביקורת"} · ${nextInspection.due_at ? new Date(nextInspection.due_at).toLocaleDateString("he-IL") : "תאריך לא נקבע"}`, href: "/dashboard/garden/inspections" }
          : { title: "הכל רגוע היום", text: "אין פעולות דחופות. אפשר להמשיך לניהול ילדים, צוות או מסמכים.", href: "/dashboard/garden/command-center" };

  const schedule = [
    ["08:00 - 09:15", "קבלת ילדים ופעילות חופשית", "☀️"],
    ["09:15 - 10:00", "מפגש בוקר", "👥"],
    ["10:00 - 10:45", "פעילות יצירה", "🎨"],
    ["10:45 - 11:15", "ארוחת עשר", "🍎"],
    ["11:15 - 12:00", "חצר ומשחק חופשי", "🛝"]
  ];

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="בית הגן" appHome>
      <main className="ganenet-reference-phone" dir="rtl">
        <header className="ganenet-reference-header">
          <div className="ganenet-logo-lockup" aria-label="גן בטוח">
            <Image src="/assets/company-name.png" alt="גן בטוח" width={300} height={96} priority />
            <Image src="/assets/company-symbol.png" alt="" width={92} height={92} priority />
          </div>

          <div className="ganenet-profile-actions">
            <a className="ganenet-avatar" href="/dashboard/garden/settings" aria-label="פרופיל">
              <img src={avatarUrl} alt="" />
            </a>
            <ChevronDown className="ganenet-profile-chevron" size={28} />
            <a className="ganenet-bell" href="/dashboard/garden/notifications" aria-label="התראות">
              <Bell size={34} />
              <i />
            </a>
          </div>

          <div className="ganenet-greeting">
            <div>
              <h1>בוקר טוב, {teacherFirstName} <span>🌸</span></h1>
              <p>ברוכה הבאה ל{displayGardenName} <ChevronLeft size={22} /></p>
            </div>
          </div>
        </header>

        <div className="ganenet-date-pill">
          <CalendarDays size={32} />
          <span>יום ראשון, כ״ה אייר תשפ״ה<br />25 במאי 2025</span>
        </div>

        <section className="ganenet-kpis">
          <a className="ganenet-kpi occupancy" href="/dashboard/garden/attendance">
            <div className="ganenet-card-icon"><UsersRound size={38} /></div>
            <strong>נוכחות ילדים</strong>
            <div className="ganenet-gauge" style={{ "--value": `${occupancy}%` } as any}>
              <b>{childrenCount || 24}</b>
              <span>מתוך {capacity}</span>
            </div>
            <div className="ganenet-attendance-legend">
              <span>נוכחים <b>{checkedIn || 24}</b></span>
              <span className="pink">נעדרים <b>{absent > 12 ? 4 : absent}</b></span>
            </div>
            <em>עדכון אחרון: 07:45</em>
          </a>

          <a className="ganenet-kpi staff-present" href="/dashboard/garden/staff">
            <div className="ganenet-card-icon"><UserCheck size={38} /></div>
            <strong>צוות נוכח היום</strong>
            <b>5</b>
            <small>מתוך 6</small>
            <div className="ganenet-mini-avatars">
              {[0, 1, 2, 3].map((item) => <span key={item}>{profile.full_name?.slice(0, 1) ?? "מ"}</span>)}
              <em>+1</em>
            </div>
            <em>עדכון אחרון: 07:45</em>
          </a>

          <a className="ganenet-kpi safety" href="/dashboard/garden/trust-center">
            <div className="ganenet-card-icon"><ShieldCheck size={38} /></div>
            <strong>סטטוס בטיחות</strong>
            <div className="ganenet-shield"><ShieldCheck size={96} /></div>
            <b>הכל תקין</b>
            <small>אין התראות פעילות</small>
          </a>
        </section>

        <section className="ganenet-mid-grid">
          <article className="ganenet-card ganenet-updates">
            <div className="ganenet-section-title">
              <h2>עדכונים אחרונים <Megaphone size={30} /></h2>
              <a href="/dashboard/garden/notifications">לכל העדכונים ›</a>
            </div>
            {[
              ["הוזן אירוע קל", "חדר גן סגול", "08:30", "purple"],
              ["עליה של יעל לוי", "עלייה מההסעה", "08:15", "green"],
              ["הודעה להורים", "טיול שנתי - עדכון פרטים", "07:50", "blue"]
            ].map(([title, text, time, tone]) => (
              <a className="ganenet-update-row" href="/dashboard/garden/notifications" key={title}>
                <i className={tone} />
                <div><b>{title}</b><span>{text}</span></div>
                <em>{time}</em>
              </a>
            ))}
          </article>

          <article className="ganenet-card ganenet-schedule">
            <div className="ganenet-section-title">
              <h2>לוח זמנים להיום <CalendarDays size={30} /></h2>
              <a href="/dashboard/garden/daily-journal">לכל לוח הזמנים ›</a>
            </div>
            <ul>
              {schedule.map(([time, label, icon]) => (
                <li key={time}><span>{icon}</span><em>{label}</em><b>{time}</b></li>
              ))}
            </ul>
          </article>
        </section>

        <section className="ganenet-card ganenet-actions">
          <div className="ganenet-section-title">
            <h2>פעולות מהירות <span className="ganenet-section-icon"><Zap size={28} /></span></h2>
          </div>
          <div className="ganenet-action-row">
            {[
              ["קבלת ילד", "/dashboard/garden/children?new=1#new-child", UsersRound, "purple"],
              ["ספירת נוכחות", "/dashboard/garden/attendance", ClipboardCheck, "blue"],
              ["דיווח אירוע", "/dashboard/garden/incidents?new=1#incident-workbench", ShieldAlert, "pink"],
              ["הודעה להורים", "/dashboard/garden/messages?compose=1#message-workbench", Megaphone, "purple"],
              ["הוספת עדכון", "/dashboard/garden/daily-journal?workbench=1#daily-journal-workbench", Plus, "purple"]
            ].map(([label, href, Icon, tone]) => (
              <a className={`ganenet-action ${tone}`} href={href as string} key={label as string}>
                <span>{<Icon size={35} />}</span>
                <b>{label as string}</b>
              </a>
            ))}
          </div>
        </section>

        <section className="ganenet-bottom-grid">
          <article className="ganenet-card ganenet-parent-messages">
            <h2>הודעות הורים <MessageCircle size={30} /></h2>
            <a href="/dashboard/garden/messages"><em>2</em><div><b>אמא של יעל</b><span>הודעה על אלרגיה</span></div><small>08:32</small></a>
            <a href="/dashboard/garden/messages"><em>1</em><div><b>אבא של עומר</b><span>שאלה לגבי טיול</span></div><small>07:58</small></a>
            <strong>לכל ההודעות ›</strong>
          </article>

          <article className="ganenet-card ganenet-tasks">
            <h2>משימות להיום <ClipboardCheck size={30} /></h2>
            {["להעביר תרופות", "לעדכן יומן גן", "להכין דוח שבועי"].map((task, index) => (
              <label key={task}><input type="checkbox" readOnly /> <span>{task}<small>עד {index === 0 ? "09:00" : index === 1 ? "12:00" : "16:00"}</small></span></label>
            ))}
            <strong>לכל המשימות ›</strong>
          </article>

          <article className="ganenet-card ganenet-shortcuts">
            <h2>קיצורי דרך</h2>
            <div>
              {[
                ["ילדים", "/dashboard/garden/children", UsersRound],
                ["צוות", "/dashboard/garden/staff", UsersRound],
                ["מצלמות", "/dashboard/garden/cameras", Camera],
                ["תשלומים", "/dashboard/garden/finance", ClipboardCheck],
                ["בקשות הצטרפות", "/dashboard/garden/enrollment-requests", UserCheck],
                ["דוחות", "/dashboard/garden/reports", BarChart3]
              ].map(([label, href, Icon]) => (
                <a href={href as string} key={label as string}><Icon size={28} /><span>{label as string}</span></a>
              ))}
            </div>
          </article>

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
          <a href="/dashboard/garden/messages"><Bell size={26} /><i>{messagesRes.count ?? 0}</i><b>התראות</b></a>
          <a className="active" href="/dashboard/garden"><span><Home size={38} /></span><b>דשבורד</b></a>
          <a href="/dashboard/garden/daily-journal"><CalendarDays size={28} /><b>יומן</b></a>
          <a href="/dashboard/garden"><Home size={28} /><b>בית</b></a>
        </nav>
      </main>
    </DashboardShell>
  );
}
