import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AlertTriangle, Baby, Bell, CheckCircle2, ClipboardList, HeartPulse, MapPin, MessageSquare, ShieldAlert, Siren, Timer, Utensils } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { StaffAttendanceActions } from "@/components/staff-attendance-actions";
import { StaffOfflineQueue } from "@/components/staff-offline-queue";
import { StaffOneHandMode } from "@/components/staff-one-hand-mode";
import { ActionCard as GBActionCard, MetricCard, StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame } from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function pct(done: number, total: number) {
  return total ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 100;
}

function timeText(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "";
}

function dateTimeText(value?: string | null) {
  return value ? new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "לא נקבע";
}

function taskTone(count: number) {
  return count ? "warning" as const : "success" as const;
}

function tone(value: "good" | "warn" | "bad" | "default") {
  if (value === "good") return "success";
  if (value === "warn") return "warning";
  if (value === "bad") return "danger";
  return "primary";
}

function RoleMetricCard({ label, value, hint, tone: cardTone = "default", href }: { label: string; value: string | number; hint?: string; tone?: "good" | "warn" | "bad" | "default"; href?: string }) {
  return <MetricCard label={label} value={value} hint={hint} tone={tone(cardTone)} href={href} />;
}

function StatusBadge({ children, tone: chipTone = "default" }: { children: ReactNode; tone?: "good" | "warn" | "bad" | "default" }) {
  return <StatusChip tone={tone(chipTone)}>{children}</StatusChip>;
}

function ActionCard({ title, text, href, icon, tone: cardTone = "default" }: { title: string; text?: string; href?: string; icon: any; tone?: "good" | "warn" | "bad" | "default" }) {
  return <GBActionCard title={title} text={text} href={href} icon={icon} tone={tone(cardTone)} />;
}

export default async function StaffOperationsPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [staffRes, gardenRes] = await Promise.all([
    supabase.from("staff" as any).select("id,garden_id,full_name,role,role_title,profile_photo_url,approved_to_work,onboarding_status").eq("profile_id", profile.id).maybeSingle(),
    profile.garden_id ? supabase.from("gardens" as any).select("id,name,logo_url,image_url,address,gps_lat,gps_lng").eq("id", profile.garden_id).maybeSingle() : { data: null, error: null }
  ]);

  const staff = staffRes.data as any;
  if (staff && (!staff.approved_to_work || staff.onboarding_status !== "active")) redirect("/onboarding/staff");

  const staffId = staff?.id ?? "";
  const gardenId = profile.garden_id ?? staff?.garden_id ?? "";
  const [
    childrenRes,
    journalsRes,
    attendanceRes,
    shiftsRes,
    tasksRes,
    doneTasksRes,
    incidentsRes,
    messagesRes,
    notificationsRes,
    medicineRes,
    documentsRes
  ] = await Promise.all([
    supabase.from("children" as any).select("id,garden_id,full_name,photo_url,face_image_url,allergies,medical_notes,regular_medications,status").eq("garden_id", gardenId).in("status", ["active", "approved"]).order("full_name").limit(120),
    supabase.from("child_daily_journals" as any).select("child_id,meals,sleep_summary,mood,bathroom,incidents,notes_to_parents").eq("garden_id", gardenId).eq("journal_date", today),
    supabase.from("attendance" as any).select("child_id,status").eq("garden_id", gardenId).eq("attendance_date", today),
    staffId ? supabase.from("staff_shifts" as any).select("id,shift_date,planned_start,planned_end,actual_start,actual_end,start_gps_verified,end_gps_verified,status").eq("staff_id", staffId).eq("shift_date", today).order("created_at", { ascending: false }).limit(1) : Promise.resolve({ data: [] }),
    supabase.from("tasks" as any).select("id,title,status,due_at,priority", { count: "exact" }).eq("garden_id", gardenId).or(`assigned_to.eq.${profile.id},assigned_role.eq.staff`).neq("status", "done").order("created_at", { ascending: false }).limit(8),
    supabase.from("tasks" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).or(`assigned_to.eq.${profile.id},assigned_role.eq.staff`).in("status", ["done", "completed"]),
    supabase.from("incident_reports" as any).select("id,title,severity,status,child_id,created_at", { count: "exact" }).eq("garden_id", gardenId).neq("status", "closed").order("created_at", { ascending: false }).limit(6),
    supabase.from("messages" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).eq("recipient_id", profile.id).is("read_at", null),
    supabase.from("notifications" as any).select("id,title,body,created_at", { count: "exact" }).or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id}`).is("read_at", null).order("created_at", { ascending: false }).limit(5),
    supabase.from("medicine_given_logs" as any).select("id,child_id", { count: "exact" }).eq("garden_id", gardenId).gte("given_at", `${today}T00:00:00`),
    supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("staff_id", staffId).in("status", ["missing", "expired", "rejected"])
  ]);

  const garden = gardenRes.data as any;
  const children = (childrenRes.data ?? []) as any[];
  const journals = (journalsRes.data ?? []) as any[];
  const attendance = (attendanceRes.data ?? []) as any[];
  const shift = ((shiftsRes.data ?? []) as any[])[0] as any;
  const tasks = (tasksRes.data ?? []) as any[];
  const incidents = (incidentsRes.data ?? []) as any[];
  const notices = (notificationsRes.data ?? []) as any[];
  const journalByChild = new Map(journals.map((journal: any) => [journal.child_id, journal]));
  const attendanceByChild = new Map(attendance.map((row: any) => [row.child_id, row.status]));

  const checkedIn = Boolean(shift?.actual_start && !shift?.actual_end);
  const checkedOut = Boolean(shift?.actual_end);
  const shiftStatus = checkedIn ? "במשמרת" : checkedOut ? "משמרת נסגרה" : "נוכחות אוטומטית";
  const childrenUpdated = children.filter((child) => journalByChild.has(child.id)).length;
  const attendanceDone = attendance.length;
  const mealUpdates = journals.filter((journal: any) => Array.isArray(journal.meals) && journal.meals.length > 0).length;
  const sleepUpdates = journals.filter((journal: any) => journal.sleep_summary).length;
  const healthUpdates = journals.filter((journal: any) => journal.notes_to_parents || journal.incidents).length + (medicineRes.count ?? 0);
  const tasksDone = doneTasksRes.count ?? 0;
  const totalTaskWork = Math.max((tasksRes.count ?? tasks.length) + tasksDone, 1);
  const shiftCompletion = Math.round((
    pct(attendanceDone, children.length) +
    pct(childrenUpdated, children.length) +
    pct(mealUpdates, children.length) +
    pct(sleepUpdates, children.length) +
    pct(tasksDone, totalTaskWork)
  ) / 5);
  const urgentCount = incidents.filter((item) => ["critical", "high", "urgent"].includes(String(item.severity))).length + notices.length;

  const attentionChildren = children.filter((child) => {
    const journal = journalByChild.get(child.id) as any;
    const attendanceStatus = attendanceByChild.get(child.id);
    return !attendanceStatus || !journal || child.allergies || child.medical_notes || child.regular_medications || journal?.incidents;
  }).slice(0, 10);

  const assistantLinks = [
    { label: "מי עדיין צריך עדכון?", href: "/dashboard/staff/child-journal" },
    { label: "מה המשימות שלי?", href: "/dashboard/staff/tasks" },
    { label: "יש דגשי בריאות?", href: "/dashboard/staff/child-journal?health=1" },
    { label: "צריך לדווח אירוע?", href: "/dashboard/staff/incidents" }
  ];

  return (
    <StaffAppFrame active="home" avatarUrl={staff?.profile_photo_url ?? profile.profile_image_url}>
      <div className="staff-workspace-shell staff-operations-2">
        <section className="staff-shift-hero">
          <div className="staff-shift-status">
            <MapPin />
            <strong>{shiftStatus}</strong>
            <span>{checkedIn ? `זוהית ב-${timeText(shift.actual_start)}` : checkedOut ? `יציאה זוהתה ב-${timeText(shift.actual_end)}` : "בדיקת מיקום"}</span>
          </div>
          <div>
            <p className="eyebrow">מה לעשות עכשיו?</p>
            <h1>{staff?.full_name ?? profile.full_name ?? "צוות גן"}, המשמרת שלך במקום אחד.</h1>
            <p>{garden?.name ?? "הגן"} · עדכוני ילדים, נוכחות, משימות, הודעות ואירועים במסך מהיר אחד.</p>
            <div className="parent-status-row">
              <span className={checkedIn ? "pill good" : checkedOut ? "pill good" : "pill warn"}>{checkedIn ? "נוכחות פעילה" : checkedOut ? "משמרת נסגרה" : "ממתין לזיהוי"}</span>
              <span className={urgentCount ? "pill bad" : "pill good"}>{urgentCount} דחופים</span>
              <span className={shiftCompletion >= 80 ? "pill good" : "pill warn"}>{shiftCompletion}% משמרת</span>
            </div>
          </div>
          <Avatar name={staff?.full_name ?? profile.full_name} src={staff?.profile_photo_url ?? profile.profile_image_url} size="lg" />
        </section>

        <section className="staff-metric-strip">
          <RoleMetricCard label="התקדמות" value={`${shiftCompletion}%`} hint="נוכחות, עדכונים ומשימות" tone={shiftCompletion >= 80 ? "good" : "warn"} />
          <RoleMetricCard label="ילדים לעדכון" value={Math.max(0, children.length - childrenUpdated)} hint="יומן היום" tone={children.length - childrenUpdated ? "warn" : "good"} href="/dashboard/staff/child-journal" />
          <MetricCard label="משימות" value={tasksRes.count ?? tasks.length} hint="פתוחות" tone={taskTone(tasksRes.count ?? tasks.length)} href="/dashboard/staff/tasks" />
          <RoleMetricCard label="התראות" value={(messagesRes.count ?? 0) + notices.length} hint="הודעות ועדכונים" tone={(messagesRes.count ?? 0) + notices.length ? "warn" : "good"} href="/dashboard/staff/notifications" />
        </section>

        <section className="staff-ops-grid">
          <StaffAttendanceActions staffId={staffId} gardenId={gardenId} hasOpenShift={checkedIn} />
          <StaffOfflineQueue />
        </section>

        <section className="staff-progress-card">
          <div>
            <p className="eyebrow">מנוע התקדמות משמרת</p>
            <h2>{shiftCompletion}% הושלם</h2>
            <p>מדד קצר שמראה אם הילדים, הארוחות, השינה והמשימות סגורים.</p>
          </div>
          <div className="staff-progress-bars">
            <span><b style={{ width: `${pct(attendanceDone, children.length)}%` }} />נוכחות {attendanceDone}/{children.length}</span>
            <span><b style={{ width: `${pct(childrenUpdated, children.length)}%` }} />ילדים עודכנו {childrenUpdated}/{children.length}</span>
            <span><b style={{ width: `${pct(mealUpdates, children.length)}%` }} />ארוחות {mealUpdates}/{children.length}</span>
            <span><b style={{ width: `${pct(sleepUpdates, children.length)}%` }} />שינה {sleepUpdates}/{children.length}</span>
            <span><b style={{ width: `${pct(tasksDone, totalTaskWork)}%` }} />משימות הושלמו {tasksDone}/{totalTaskWork}</span>
          </div>
        </section>

        <section className="staff-action-grid">
          <ActionCard title="עדכון ילד" text="אוכל, שינה, שירותים" href="/dashboard/staff/child-journal" icon={Baby} tone="good" />
          <ActionCard title="ארוחה" text="עדכון מהיר" href="/dashboard/staff/child-journal?meal=1" icon={Utensils} />
          <ActionCard title="בריאות" text="תרופה או הערה" href="/dashboard/staff/child-journal?health=1" icon={HeartPulse} />
          <ActionCard title="משימות" text="מה נשאר" href="/dashboard/staff/tasks" icon={ClipboardList} tone={tasks.length ? "warn" : "good"} />
          <ActionCard title="הודעות" text="מנהלת וצוות" href="/dashboard/staff/messages" icon={MessageSquare} />
          <ActionCard title="אירוע מהיר" text="פחות מ-30 שניות" href="/dashboard/staff/incidents" icon={Siren} tone="warn" />
        </section>

        <section className="staff-two-column">
          <article className="staff-attention-card">
            <div className="section-heading"><h2>תור תשומת לב</h2><p>הילדים והפעולות שצריך לסגור קודם.</p></div>
            {attentionChildren.length === 0 ? <div className="empty-state"><strong>אין ילדים שממתינים לטיפול</strong><span>כל הילדים קיבלו נוכחות ועדכון בסיסי.</span></div> : <div className="staff-attention-list">{attentionChildren.map((child) => {
              const journal = journalByChild.get(child.id) as any;
              const reason = !attendanceByChild.has(child.id) ? "אין נוכחות" : !journal ? "אין עדכון היום" : child.allergies ? `אלרגיה: ${child.allergies}` : child.medical_notes ? "הערת בריאות" : journal?.incidents ? "מעקב אירוע" : "בדיקה";
              return <Link href={`/dashboard/staff/child-journal?childId=${child.id}`} key={child.id}><Avatar name={child.full_name} src={child.photo_url ?? child.face_image_url} /><div><strong>{child.full_name}</strong><span>{reason}</span></div><small>עדכון</small></Link>;
            })}</div>}
          </article>
          <article className="staff-assistant-card">
            <ShieldAlert />
            <h2>עוזר צוות</h2>
            <p>תשובות קצרות שמובילות לפעולה.</p>
            <div>{assistantLinks.map((item) => <Link href={item.href} key={item.label}>{item.label}</Link>)}</div>
          </article>
        </section>

        <StaffOneHandMode children={children.slice(0, 36)} />

        <section className="staff-two-column">
          <article className="staff-attention-card">
            <div className="section-heading"><h2>משימות והודעות</h2><p>מה שמחכה לך במשמרת.</p></div>
            <div className="staff-task-summary">
              <span>פתוחות <b>{tasks.length}</b></span>
              <span>באיחור <b>{tasks.filter((task) => task.due_at && new Date(task.due_at).getTime() < Date.now()).length}</b></span>
              <span>הודעות <b>{messagesRes.count ?? 0}</b></span>
            </div>
            <div className="staff-attention-list">{tasks.slice(0, 4).map((task) => <Link href="/dashboard/staff/tasks" key={task.id}><Timer /><div><strong>{task.title}</strong><span>{dateTimeText(task.due_at)}</span></div><small>{task.status}</small></Link>)}</div>
          </article>
          <article className="staff-attention-card">
            <div className="section-heading"><h2>הודעות מנהלת</h2><p>עדכונים קצרים, בלי רעש.</p></div>
            {notices.length === 0 ? <div className="empty-state"><strong>אין הודעות פתוחות</strong><span>אם תהיה הודעה מהמנהלת, היא תופיע כאן.</span></div> : <div className="staff-attention-list">{notices.map((notice) => <Link href="/dashboard/staff/notifications" key={notice.id}><Bell /><div><strong>{notice.title}</strong><span>{notice.body}</span></div><small>{dateTimeText(notice.created_at)}</small></Link>)}</div>}
          </article>
        </section>

        <section className="staff-emergency-center">
          <div><p className="eyebrow">מצב חירום</p><h2>פעולות שתמיד קרובות</h2><p>דיווח אירוע, הודעה למנהלת או פתיחת התראה. מינימום הקלדה.</p></div>
          <div className="profile-actions">
            <Link className="button primary" href="/dashboard/staff/incidents"><AlertTriangle size={16} /> דיווח אירוע</Link>
            <Link className="button secondary" href="/dashboard/staff/messages"><MessageSquare size={16} /> הודעה למנהלת</Link>
            <Link className="button secondary" href="/dashboard/staff/notifications"><Bell size={16} /> התראות</Link>
          </div>
        </section>

        <section className="staff-performance-note">
          <CheckCircle2 />
          <span>מדדי השלמת עדכונים, משימות ונוכחות זמינים למנהלת בלבד. אין דירוג ציבורי ואין השוואה בין אנשי צוות.</span>
          {(documentsRes.count ?? 0) ? <StatusBadge tone="warn">{documentsRes.count} מסמכים חסרים</StatusBadge> : <StatusBadge tone="good">מסמכים תקינים</StatusBadge>}
        </section>
      </div>
    </StaffAppFrame>
  );
}
