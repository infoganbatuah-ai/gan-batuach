import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Baby, Bell, BriefcaseBusiness, Building2, CalendarDays, ClipboardList, Fingerprint, HeartPulse, LogIn, LogOut, MapPin, MessageSquare, ShieldAlert, Siren, UserRound, UsersRound } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DashboardShell } from "@/components/dashboard-shell";
import { StaffOneHandMode } from "@/components/staff-one-hand-mode";
import {
  StaffActionTile,
  StaffAppFrame,
  StaffInfoPill,
  StaffMessageRow,
  StaffMetricCard,
  StaffSection,
  StaffShiftCard,
  StaffShiftHero,
  StaffTaskRow
} from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function percent(done: number, total: number) {
  return total ? Math.round((done / total) * 100) : 100;
}

function timeText(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "";
}

function formatStatus(status?: string | null) {
  const map: Record<string, string> = {
    draft: "טיוטה",
    submitted: "נשלח",
    under_review: "בתהליך בדיקה",
    more_information_requested: "נדרש מידע נוסף",
    approved_pending_completion: "ממתין לסיום",
    approved: "מאושר",
    rejected: "נדחה",
    cancelled: "בוטל",
    active: "פעיל",
    pending_affiliation: "ממתין לשיוך",
    pending_approval: "ממתין לאישור"
  };
  return map[status ?? ""] ?? status ?? "-";
}

export default async function StaffDashboard() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [staffRes, gardenRes] = await Promise.all([
    supabase.from("staff" as any).select("id, full_name, role, role_title, profile_photo_url, approved_to_work, onboarding_status").eq("profile_id", profile.id).maybeSingle(),
    profile.garden_id ? supabase.from("gardens" as any).select("id, name, logo_url, image_url, address, gps_lat, gps_lng").eq("id", profile.garden_id).maybeSingle() : { data: null, error: null }
  ]);
  const staff = staffRes.data as any;
  if (!staff || !profile.garden_id) {
    const applicationsRes = await supabase.from("staff_job_applications" as any)
      .select("id,status,submitted_at,gardens(name,city),kindergarten_staff_openings(role_needed)")
      .eq("staff_candidate_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20);
    const applications = (applicationsRes.data ?? []) as any[];
    return (
      <DashboardShell role="staff" title="מועמדות צוות" appHome>
        <StaffAppFrame avatarUrl={(profile as any).profile_image_url ?? null}>
          <section className="staff-unassigned-card">
            <div className="staff-search-art" aria-hidden="true" />
            <div>
              <h1>עדיין לא שובצת לגן</h1>
              <p>אנחנו שמחים שאת איתנו! בינתיים תוכלי לחפש גנים באזור שלך ולהציע את עצמך לעבודה.</p>
            </div>
          </section>

          <StaffSection title="העדפות העבודה שלי" action={<Link href="/dashboard/staff/settings">עריכה</Link>}>
            <div className="staff-preference-grid">
              <StaffInfoPill title="תפקיד" value="סייעת מועדפת" icon={UsersRound} />
              <StaffInfoPill title="אזור" value="גם מתאים" icon={MapPin} />
              <StaffInfoPill title="ניסיון" value="מועדפת" icon={BriefcaseBusiness} />
            </div>
          </StaffSection>

          <StaffSection title="חיפוש גנים באזור">
            <div className="staff-action-grid-ref">
              <StaffActionTile title="שוק משרות" href="/dashboard/staff/job-market" icon={ClipboardList} />
              <StaffActionTile title="פרופיל ומסמכים" href="/dashboard/staff/settings" icon={ShieldAlert} />
              <StaffActionTile title="התראות" href="/dashboard/staff/notifications" icon={Bell} />
            </div>
          </StaffSection>

          <StaffSection title="מועמדויות שהוגשו">
            {applications.length === 0 ? (
              <div className="staff-empty-ref"><strong>עוד לא הוגשה מועמדות</strong><span>פתחי את שוק המשרות כדי להגיש בקשה לגן.</span></div>
            ) : (
              <div className="staff-application-list" id="applications">
                {applications.map((application) => (
                  <Link href="/dashboard/staff/job-market" key={application.id}>
                    <strong>{application.gardens?.name ?? "גן"} · {formatStatus(application.status)}</strong>
                    <span>{application.gardens?.city ?? ""} · {application.kindergarten_staff_openings?.role_needed ?? "צוות"}</span>
                  </Link>
                ))}
              </div>
            )}
          </StaffSection>
        </StaffAppFrame>
      </DashboardShell>
    );
  }
  if (staff && (!staff.approved_to_work || staff.onboarding_status !== "active")) redirect("/onboarding/staff");

  const staffId = staff?.id ?? "";
  const gardenId = profile.garden_id ?? staff?.garden_id ?? "";
  const [
    tasksRes,
    childrenRes,
    journalsRes,
    shiftsRes,
    incidentsRes,
    docsRes,
    messagesRes,
    notificationsRes,
    medicineRes
  ] = await Promise.all([
    supabase.from("tasks" as any).select("id,title,priority,status,due_at", { count: "exact" }).or(`assigned_to.eq.${profile.id},assigned_role.eq.staff`).eq("garden_id", gardenId).neq("status", "done").order("created_at", { ascending: false }).limit(6),
    supabase.from("children" as any).select("id, garden_id, full_name, photo_url, face_image_url, allergies, medical_notes, regular_medications").eq("garden_id", gardenId).in("status", ["active", "approved"]).order("full_name").limit(80),
    supabase.from("child_daily_journals" as any).select("child_id, meals, sleep_summary, mood, bathroom, incidents, notes_to_parents").eq("garden_id", gardenId).eq("journal_date", today),
    staffId ? supabase.from("staff_shifts" as any).select("id, shift_date, planned_start, planned_end, actual_start, actual_end, start_gps_verified, end_gps_verified, status").eq("staff_id", staffId).eq("shift_date", today).order("created_at", { ascending: false }).limit(1) : Promise.resolve({ data: [] }),
    supabase.from("incident_reports" as any).select("id,title,severity,status,child_id", { count: "exact" }).eq("garden_id", gardenId).neq("status", "closed").order("created_at", { ascending: false }).limit(5),
    supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("staff_id", staffId).in("status", ["missing", "expired", "rejected"]),
    supabase.from("messages" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).eq("recipient_id", profile.id).is("read_at", null),
    supabase.from("notifications" as any).select("id", { count: "exact", head: true }).or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id}`).is("read_at", null),
    supabase.from("medicine_given_logs" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).gte("given_at", `${today}T00:00:00`)
  ]);

  const garden = gardenRes.data as any;
  const staffName = staff?.full_name ?? profile.full_name ?? "איש/ת צוות";
  const staffRole = staff?.role_title ?? staff?.role ?? "צוות גן";
  const children = (childrenRes.data ?? []) as any[];
  const journals = (journalsRes.data ?? []) as any[];
  const journalByChild = new Map(journals.map((journal: any) => [journal.child_id, journal]));
  const shift = ((shiftsRes.data ?? []) as any[])[0] as any;
  const checkedIn = Boolean(shift?.actual_start && !shift?.actual_end);
  const checkedOut = Boolean(shift?.actual_end);
  const shiftStatus = checkedIn ? "במשמרת" : checkedOut ? "יציאה נשמרה" : "טרם נכנסת";
  const updatedChildren = children.filter((child) => journalByChild.has(child.id)).length;
  const mealUpdates = journals.filter((journal: any) => Array.isArray(journal.meals) && journal.meals.length > 0).length;
  const sleepUpdates = journals.filter((journal: any) => journal.sleep_summary).length;
  const healthUpdates = journals.filter((journal: any) => journal.notes_to_parents || journal.incidents).length;
  const shiftProgress = percent(updatedChildren + mealUpdates + sleepUpdates, Math.max(children.length * 3, 1));
  const childrenNeedingAttention = children.filter((child) => {
    const journal = journalByChild.get(child.id) as any;
    return !journal || child.allergies || child.medical_notes || child.regular_medications || journal?.incidents;
  }).slice(0, 8);
  const urgentAlerts = (incidentsRes.count ?? 0) + (notificationsRes.count ?? 0);

  return (
    <DashboardShell role="staff" title="משמרת" appHome>
      <StaffAppFrame avatarUrl={staff?.profile_photo_url ?? profile.profile_image_url}>
        <StaffShiftHero name={staffName.split(" ")[0] ?? staffName} subtitle="אנחנו שמחים שאת איתנו היום!">
          <div className="staff-side-info">
            <StaffInfoPill title="הגן שלי" value={garden?.name ?? "גן"} icon={Building2} />
            <StaffInfoPill title="קבוצת גיל" value="גילאי 3-4" icon={UsersRound} />
          </div>
        </StaffShiftHero>

        <StaffShiftCard status={shiftStatus} hours="07:30 - 16:00">
          <div className="staff-shift-buttons">
            <Link href="/dashboard/staff/attendance"><LogIn size={22} /> כניסה</Link>
            <Link href="/dashboard/staff/attendance"><LogOut size={22} /> יציאה</Link>
            <Link href="/dashboard/staff/shifts"><Fingerprint size={22} /> בהפסקה</Link>
          </div>
        </StaffShiftCard>

        <section className="staff-metric-grid-ref">
          <StaffMetricCard title="השלמת משימות" value={`${updatedChildren}/${Math.max(children.length, 1)}`} hint={`${shiftProgress}% הושלם`} icon={ClipboardList} tone={shiftProgress >= 80 ? "green" : "purple"} href="/dashboard/staff/tasks" />
          <StaffMetricCard title="ילדים בקבוצה" value={children.length} hint="בקבוצת הגן" icon={UsersRound} tone="purple" href="/dashboard/staff/child-journal" />
          <StaffMetricCard title="עדכוני צוות" value={notificationsRes.count ?? 0} hint="הודעות חדשות" icon={Bell} tone={urgentAlerts ? "orange" : "blue"} href="/dashboard/staff/notifications" />
          <StaffMetricCard title="הודעות מהורים" value={messagesRes.count ?? 0} hint="חדשות" icon={MessageSquare} tone="purple" href="/dashboard/staff/messages" />
        </section>

        <section className="staff-dashboard-columns-ref">
          <StaffSection title="המשימות שלי היום" action={<Link href="/dashboard/staff/tasks">צפייה בכל המשימות</Link>}>
            <div className="staff-task-list-ref">
              <StaffTaskRow title="הכנת אזור ארוחת בוקר" time="07:15" done />
              <StaffTaskRow title="סיוע בקבלת הילדים בבוקר" time="07:30" done />
              <StaffTaskRow title="השגחה על משחק בחצר" time="09:30" done />
              <StaffTaskRow title="סיוע בהגשת ארוחת צהריים" time="12:00" done />
              <StaffTaskRow title="תמיכה בזמן מנוחה" time="13:00" />
              <StaffTaskRow title="ניקיון צעצועים וחומרים" time="14:30" />
              <StaffTaskRow title="הכנת הגן למסירת סוף יום" time="15:30" />
            </div>
          </StaffSection>

          <div className="staff-side-stack-ref">
            <StaffSection title="מהורים" action={<Link href="/dashboard/staff/messages">צפייה בכל</Link>}>
              <StaffMessageRow title="אמא של יובל" body="יובל התעורר עם קצת חום, תשימו לב בבקשה" time="08:21" />
              <StaffMessageRow title="אבא של מאיה" body="מאיה קצת עייפה הבוקר, תודה על תשומת הלב" time="07:48" />
            </StaffSection>
            <StaffSection title="עדכוני צוות" action={<Link href="/dashboard/staff/notifications">צפייה בכל</Link>}>
              <StaffMessageRow title="מיכל, מנהלת" body="היום מגיע מדריכה לביקור בגן בשעה 10:00" time="06:45" />
            </StaffSection>
          </div>
        </section>

        <section className="staff-action-grid-ref">
          <StaffActionTile title="משמרות" href="/dashboard/staff/shifts" icon={CalendarDays} />
          <StaffActionTile title="נוכחות" href="/dashboard/staff/attendance" icon={Fingerprint} />
          <StaffActionTile title="הודעות" href="/dashboard/staff/messages" icon={MessageSquare} />
          <StaffActionTile title="תפקידים" href="/dashboard/staff/tasks" icon={UserRound} />
        </section>

        <details className="staff-management-details">
          <summary>ניהול מתקדם לצוות</summary>
          <section className="staff-two-column">
            <article className="staff-attention-card">
              <div className="section-heading"><h2>ילדים שדורשים תשומת לב</h2><p>בלי חיפוש. קודם הילדים שצריך לעדכן או לבדוק.</p></div>
              {childrenNeedingAttention.length === 0 ? <div className="empty-state"><strong>אין ילדים שממתינים לעדכון</strong><span>כל הילדים עודכנו או שאין דגשי בריאות פתוחים.</span></div> : <div className="staff-attention-list">{childrenNeedingAttention.map((child) => {
                const journal = journalByChild.get(child.id) as any;
                return <Link href={`/dashboard/staff/child-journal?childId=${child.id}`} key={child.id}><Avatar name={child.full_name} src={child.photo_url ?? child.face_image_url} /><div><strong>{child.full_name}</strong><span>{!journal ? "אין עדכון היום" : child.allergies ? `אלרגיה: ${child.allergies}` : child.medical_notes ? "הערת בריאות" : "דורש בדיקה"}</span></div><small>{journal?.mood ?? "עדכון"}</small></Link>;
              })}</div>}
            </article>
            <article className="staff-assistant-card">
              <ShieldAlert />
              <h2>עוזר צוות</h2>
              <p>שאלות קצרות שמובילות למסך הנכון.</p>
              <div>
                <Link href="/dashboard/staff/child-journal">מי עדיין צריך עדכון?</Link>
                <Link href="/dashboard/staff/tasks">אילו משימות נשארו?</Link>
                <Link href="/dashboard/staff/child-journal?health=1">למי יש דגש בריאותי?</Link>
                <Link href="/dashboard/staff/incidents">צריך לדווח אירוע?</Link>
              </div>
            </article>
          </section>
          <StaffOneHandMode children={children.slice(0, 24)} />
          <section className="staff-emergency-center">
            <div><p className="eyebrow">פעולות חירום</p><h2>תמיד קרוב</h2><p>לדווח מהר, ליצור קשר עם מנהלת או לפתוח התראה דחופה.</p></div>
            <div className="profile-actions">
              <Link className="button primary" href="/dashboard/staff/incidents"><AlertTriangle size={16} /> דיווח אירוע</Link>
              <Link className="button secondary" href="/dashboard/staff/messages"><MessageSquare size={16} /> הודעה למנהלת</Link>
              <Link className="button secondary" href="/dashboard/staff/notifications"><Bell size={16} /> התראות</Link>
            </div>
          </section>
          {(docsRes.count ?? 0) > 0 ? <section className="staff-emergency-center documents"><div><p className="eyebrow">נדרש ממך</p><h2>חסרים מסמכי צוות</h2><p>השלמת המסמכים עוזרת למנהלת להשאיר אותך מאושר/ת לעבודה.</p></div><Link className="button primary" href="/dashboard/staff/documents">השלמת מסמכים</Link></section> : null}
        </details>
      </StaffAppFrame>
    </DashboardShell>
  );
}
