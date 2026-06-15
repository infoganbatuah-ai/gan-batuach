import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Baby, Bell, ClipboardList, HeartPulse, MapPin, MessageSquare, ShieldAlert, Siren } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DashboardShell } from "@/components/dashboard-shell";
import { StaffOneHandMode } from "@/components/staff-one-hand-mode";
import { ActionCard, RoleMetricCard } from "@/components/premium-dashboard";
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
      <DashboardShell role="staff" title="מועמדות צוות">
        <section className="dashboard-hero-card">
          <div>
            <p className="eyebrow">חשבון צוות מוגבל</p>
            <h1>מצאו גן שמחפש עובדים והגישו מועמדות.</h1>
            <p>עד שמנהלת גן מאשרת אותך, אין גישה לילדים, הורים, מסמכים, מצלמות או מידע פנימי של גן.</p>
          </div>
          <span className="pill warn">ממתין לשיוך</span>
        </section>
        <section className="staff-action-grid">
          <ActionCard title="שוק משרות" text="משרות שגנים פרסמו לצוות" href="/dashboard/staff/job-market" icon={ClipboardList} tone="good" />
          <ActionCard title="פרופיל ומסמכים" text="השלמת פרטים ומסמכים" href="/dashboard/staff/settings" icon={ShieldAlert} />
          <ActionCard title="התראות" text="עדכונים על מועמדות" href="/dashboard/staff/notifications" icon={Bell} />
        </section>
        <section className="dashboard-section">
          <div className="section-heading"><h2>מועמדויות שהוגשו</h2><p>סטטוס הבקשות שלך לגנים.</p></div>
          {applications.length === 0 ? <div className="empty-state"><strong>עוד לא הוגשה מועמדות</strong><span>פתחו את שוק המשרות כדי להגיש בקשה לגן.</span></div> : <div className="procedure-list">{applications.map((application) => (
            <article className="card procedure-card" key={application.id}>
              <div>
              <span className={application.status === "approved" ? "pill good" : application.status === "rejected" ? "pill bad" : "pill warn"}>{formatStatus(application.status)}</span>
                <h3>{application.gardens?.name ?? "גן"}</h3>
                <p>{application.gardens?.city ?? ""} · {application.kindergarten_staff_openings?.role_needed ?? "צוות"}</p>
              </div>
            </article>
          ))}</div>}
        </section>
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
    <DashboardShell role="staff" title="משמרת">
      <div className="staff-workspace-shell">
        <section className="staff-shift-hero">
          <div className="staff-shift-status">
            <MapPin />
            <strong>{shiftStatus}</strong>
            <span>{checkedIn ? `נכנסת ב-${timeText(shift.actual_start)}` : checkedOut ? `יצאת ב-${timeText(shift.actual_end)}` : "התחילו בהחתמה"}</span>
          </div>
          <div>
            <p className="eyebrow">מה צריך לעשות עכשיו?</p>
            <h1>שלום, {staffName}</h1>
            <p>{garden?.name ?? "הגן"} · {staffRole}. עדכוני ילדים, משימות, נוכחות ואירועים במקום אחד מהיר.</p>
            <div className="parent-status-row">
              <span className={checkedIn ? "pill good" : "pill warn"}>{checkedIn ? "נוכחות פעילה" : "נדרשת החתמה"}</span>
              <span className={urgentAlerts ? "pill bad" : "pill good"}>{urgentAlerts} התראות</span>
              <span className={tasksRes.count ? "pill warn" : "pill good"}>{tasksRes.count ?? 0} משימות</span>
            </div>
          </div>
          <Avatar name={staffName} src={staff?.profile_photo_url ?? profile.profile_image_url} size="lg" />
        </section>

        <section className="staff-metric-strip">
          <RoleMetricCard label="התקדמות משמרת" value={`${shiftProgress}%`} hint="ילדים, ארוחות ושינה" tone={shiftProgress >= 80 ? "good" : "warn"} />
          <RoleMetricCard label="ילדים לעדכון" value={Math.max(0, children.length - updatedChildren)} hint="עדיין בלי עדכון" tone={children.length - updatedChildren ? "warn" : "good"} href="/dashboard/staff/child-journal" />
          <RoleMetricCard label="משימות" value={tasksRes.count ?? 0} hint="פתוחות" tone={tasksRes.count ? "warn" : "good"} href="/dashboard/staff/tasks" />
          <RoleMetricCard label="אירועים" value={incidentsRes.count ?? 0} hint="פתוחים" tone={incidentsRes.count ? "bad" : "good"} href="/dashboard/staff/incidents" />
        </section>

        <section className="staff-progress-card">
          <div><p className="eyebrow">התקדמות משמרת</p><h2>{shiftProgress}% הושלם</h2><p>מדד עבודה מהיר לצוות: עדכוני ילדים, ארוחות, שינה, בריאות ואירועים.</p></div>
          <div className="staff-progress-bars">
            <span><b style={{ width: `${percent(updatedChildren, children.length)}%` }} />ילדים עודכנו {updatedChildren}/{children.length}</span>
            <span><b style={{ width: `${percent(mealUpdates, children.length)}%` }} />ארוחות {mealUpdates}/{children.length}</span>
            <span><b style={{ width: `${percent(sleepUpdates, children.length)}%` }} />שינה {sleepUpdates}/{children.length}</span>
            <span><b style={{ width: `${percent(healthUpdates + (medicineRes.count ?? 0), Math.max(children.length, 1))}%` }} />בריאות/תרופות {healthUpdates + (medicineRes.count ?? 0)}</span>
          </div>
        </section>

        <section className="staff-action-grid">
          <ActionCard title="תפעול משמרת" text="כל הפעולות במסך אחד" href="/dashboard/staff/operations" icon={ClipboardList} tone="good" />
          <ActionCard title="כניסה / יציאה" text="נוכחות עם מיקום" href="/dashboard/staff/attendance" icon={MapPin} tone={checkedIn ? "good" : "warn"} />
          <ActionCard title="עדכון ילד" text="ארוחה, שינה, שירותים" href="/dashboard/staff/child-journal" icon={Baby} />
          <ActionCard title="דיווח אירוע" text="מהיר ומתועד" href="/dashboard/staff/incidents" icon={Siren} tone="warn" />
          <ActionCard title="משימות" text="מה שנשאר למשמרת" href="/dashboard/staff/tasks" icon={ClipboardList} />
          <ActionCard title="הודעות" text="מנהלת וצוות" href="/dashboard/staff/messages" icon={MessageSquare} />
          <ActionCard title="בריאות" text="תרופה או תצפית" href="/dashboard/staff/child-journal?health=1" icon={HeartPulse} />
        </section>

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
      </div>
    </DashboardShell>
  );
}
