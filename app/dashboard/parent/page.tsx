import Link from "next/link";
import { Baby, Bell, Building2, CalendarDays, Camera, FileText, MessageCircle, Phone, Plus, ShieldCheck, WalletCards } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentChildProfileForm } from "@/components/self-service-forms";
import { ParentKindergartenInvitationsPanel } from "@/components/parent-kindergarten-invitations-panel";
import {
  ParentActionTile,
  ParentAppFrame,
  ParentChildCard,
  ParentChildContextCard,
  ParentEmptyState,
  ParentHero,
  ParentListRow,
  ParentMetricCard,
  ParentSection,
  parentDefaultActions
} from "@/components/parent-app-ui";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel, isSyntheticLabel } from "@/lib/domain/display-label";
import { getParentFamilyContext, requestMatchesParentChild, resolveParentDashboardChild } from "@/lib/domain/parent-family";
import { deriveAttendanceSummary, deriveTuitionSummary, selectAuthorizedChild } from "@/lib/management/dashboard-read-model";
import { createClient } from "@/lib/supabase/server";

type DashboardRow = Record<string, unknown> & {
  id?: unknown;
  child_id?: unknown;
  permanent_child_file_id?: unknown;
  full_name?: unknown;
  photo_url?: unknown;
  status?: unknown;
  base_amount?: unknown;
  adjustment_total?: unknown;
  settled_total?: unknown;
  due_at?: unknown;
  currency?: unknown;
  child?: Record<string, unknown>;
  gardens?: Record<string, unknown>;
};

function formatStatus(status?: string | null) {
  const map: Record<string, string> = {
    draft: "טיוטה",
    submitted: "נשלח",
    under_review: "בבדיקה",
    more_information_requested: "נדרש מידע נוסף",
    approved_pending_payment: "אושר, ממתין לתשלום",
    approved: "מאושר",
    rejected: "נדחה",
    cancelled: "בוטל",
    expired: "פג תוקף",
    pending_affiliation: "ממתין לשיוך",
    active: "פעיל"
  };
  return map[status ?? ""] ?? status ?? "-";
}

export default async function ParentDashboard({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const { profile } = await requireRole(["parent"]);
  const requestedChildId = (await searchParams).child ?? null;
  const supabase = await createClient();
  const requestsRes = await supabase.from("kindergarten_enrollment_requests" as any)
    .select("id,child_profile_id,status,payment_status,requested_at,decided_at,published_price_snapshot,gardens(name,city)")
    .eq("parent_id", profile.id).order("created_at", { ascending: false }).limit(20);
  const family = await getParentFamilyContext(supabase as any, profile);
  const childProfiles = (family.childFiles ?? []) as any[];
  const requests = (requestsRes.data ?? []) as any[];
  const enrollmentRows = (family.enrollments ?? []) as unknown as DashboardRow[];
  const childContextKey = (child: DashboardRow) => String(child.permanent_child_file_id ?? child.child?.permanent_child_file_id ?? child.child_id ?? child.id ?? "");
  const childContexts = [
    ...[...enrollmentRows].sort((left, right) => Number(["active", "approved"].includes(String(right.status))) - Number(["active", "approved"].includes(String(left.status)))),
    ...(childProfiles as unknown as DashboardRow[])
  ]
    .filter((child, index, all) => {
      const id = childContextKey(child);
      return id && all.findIndex(item => childContextKey(item) === id) === index;
    });
  const selectedChild = selectAuthorizedChild(childContexts, requestedChildId);
  const attendanceChildren = childContexts.slice(0, 4);
  if (selectedChild && !attendanceChildren.includes(selectedChild)) attendanceChildren.splice(3, 1, selectedChild);
  const childIdentity = resolveParentDashboardChild(selectedChild, enrollmentRows);
  const selectedChildId = childIdentity.contextId;
  const selectedChildFileId = childIdentity.fileId;
  const activeEnrollment = childIdentity.enrollment;
  const selectedAttendanceChildId = childIdentity.gardenChildId;
  const selectedRequests = requests.filter(request => !selectedChild ? !requestedChildId : requestMatchesParentChild(request, selectedChildFileId));
  const pending = selectedRequests.filter((request) => !["approved", "rejected", "cancelled", "expired"].includes(String(request.status)));
  const selectedGarden = ((family.gardens ?? []) as unknown as DashboardRow[]).find((garden) => garden.id === (activeEnrollment?.garden_id ?? activeEnrollment?.kindergarten_id)) ?? selectedRequests[0]?.gardens;
  const selectedGardenId = String(activeEnrollment?.garden_id ?? activeEnrollment?.kindergarten_id ?? "");
  const hasActiveKindergarten = Boolean(selectedGardenId && ["active", "approved"].includes(String(activeEnrollment?.status)));
  const attendanceDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const attendanceChildIds = Array.from(new Set([
    ...childContexts.slice(0, 12).map(child => String(child.child_id ?? "")).filter(Boolean),
    selectedAttendanceChildId
  ].filter(Boolean)));
  const [scheduleRes, attendanceRes, tuitionRes, documentRes, notificationRes] = await Promise.all([
    hasActiveKindergarten
    ? supabase.from("schedule_items" as any)
      .select("id,title,description,starts_at,visible_to_parents")
      .eq("garden_id", selectedGardenId)
      .eq("visible_to_parents", true)
      .order("starts_at", { ascending: true })
      .limit(4)
    : Promise.resolve({ data: [], error: null }),
    attendanceChildIds.length ? supabase.from("attendance" as any).select("child_id,status,attendance_date,check_in_at,check_out_at").in("child_id", attendanceChildIds).eq("attendance_date", attendanceDate).limit(13) : Promise.resolve({ data: [], error: null }),
    selectedAttendanceChildId ? supabase.from("tuition_billing_periods" as any).select("base_amount,adjustment_total,settled_total,status,due_at,currency").eq("child_id", selectedAttendanceChildId).not("status", "in", "(paid,waived,cancelled)").limit(100) : Promise.resolve({ data: [], error: null }),
    selectedAttendanceChildId ? supabase.from("documents" as any).select("id,status,expires_at", { count: "exact", head: true }).eq("child_id", selectedAttendanceChildId).is("deleted_at", null).in("status", ["pending_review", "expired", "rejected"]) : Promise.resolve({ data: [], count: 0, error: null }),
    supabase.from("notifications" as any).select("id", { count: "exact", head: true }).eq("recipient_id", profile.id).is("read_at", null).is("archived_at", null)
  ]);
  const scheduleItems = (scheduleRes.data ?? []) as any[];
  const attendanceRows = (attendanceRes.data ?? []) as DashboardRow[];
  const latestAttendance = attendanceRows.find(row => String(row.child_id) === selectedAttendanceChildId) ?? null;
  const todayAttendance = deriveAttendanceSummary(latestAttendance ? [latestAttendance] : [], hasActiveKindergarten ? 1 : 0);
  const tuition = deriveTuitionSummary((tuitionRes.data ?? []) as unknown as DashboardRow[], new Date().toISOString().slice(0, 10));
  const safetyScore = selectedGarden?.last_inspection_score ?? null;
  const unreadOrPendingCount = (notificationRes.count ?? 0) + pending.length;
  const syntheticSession = [profile.full_name, String(selectedChild?.full_name ?? ""), String(selectedGarden?.name ?? "")].some(isSyntheticLabel);
  const requestedUnavailableChild = Boolean(requestedChildId && childContexts.length && !selectedChild);
  const dataUnavailable = Boolean(family.sourceUnavailable || requestsRes.error || attendanceRes.error || tuitionRes.error || documentRes.error || notificationRes.error || scheduleRes.error);

  return (
    <DashboardShell role="parent" title="אזור הורה" appHome>
      <ParentAppFrame active="dashboard" profileName={profile.full_name} avatarUrl={(profile as any).profile_image_url ?? null} contentClassName={`parent-dashboard-home${childContexts.length > 1 ? " parent-dashboard-multi-child" : " parent-dashboard-assigned"}`}>
        <ParentHero title={`שלום, ${cleanSyntheticLabel(profile.full_name, "הורה")}`} subtitle="כיף לראות אתכם שוב · כל מה שחשוב על הילד והגן במקום אחד" />

        {syntheticSession ? <div className="dashboard-environment-notice" role="status">סביבת בדיקה עם נתונים סינתטיים בלבד. נתוני ילדים והורים אמיתיים אינם מופעלים כאן.</div> : null}
        {dataUnavailable ? <div className="parent-dashboard-data-warning" role="alert">חלק מהנתונים אינם זמינים כעת. נסו לרענן לפני פעולה לפי הנתונים במסך.</div> : null}

        <ParentKindergartenInvitationsPanel />

        {childContexts.length ? <nav className="parent-child-selector parent-child-card-selector" aria-label="בחירת ילד להצגת הדשבורד" data-child-count={childContexts.length}>
          <input type="hidden" name="child" value={selectedChildId} />
          <div className="parent-child-selector-heading"><Baby size={22} /><span><b>{childContexts.length > 1 ? "הילדים שלי" : "הילד שלי"}</b><small>{childContexts.length > 1 ? "בחירה מעדכנת מיד את כל המידע במסך" : "המידע המעודכן מהגן במקום אחד"}</small></span></div>
          <div className="parent-child-selector-track">{childContexts.map(child => {
            const id = String(child.child_id ?? child.permanent_child_file_id ?? child.id);
            const enrollment = resolveParentDashboardChild(child, enrollmentRows).enrollment;
            const garden = ((family.gardens ?? []) as unknown as DashboardRow[]).find(item => item.id === (enrollment?.garden_id ?? enrollment?.kindergarten_id));
            const childState = enrollment?.status ? formatStatus(String(enrollment.status)) : "טרם שויך";
            return <ParentChildContextCard
              key={id}
              href={`/dashboard/parent?child=${encodeURIComponent(id)}`}
              active={id === selectedChildId}
              name={cleanSyntheticLabel(String(child.full_name ?? child.child?.full_name ?? ""), "ילד/ה")}
              garden={cleanSyntheticLabel(String(garden?.name ?? ""), enrollment ? "הקשר הגן" : "טרם שויך לגן")}
              status={`${id === selectedChildId ? "נבחר · " : ""}${childState}`}
              image={(child as DashboardRow).photo_url as string | null | undefined}
            />;
          })}<Link className="parent-child-context-add" href="#child-profile"><Plus aria-hidden="true" /><span><b>הוספת ילד</b><small>פרופיל ובקשת שיוך</small></span></Link></div>
        </nav> : null}

        {selectedChild ? (
          <ParentChildCard
            name={cleanSyntheticLabel(String(selectedChild.full_name ?? ""), "הילד שלי")}
            meta={`${cleanSyntheticLabel(String(selectedGarden?.name ?? ""), "עדיין לא משויך לגן")} · ${cleanSyntheticLabel(String(selectedGarden?.city ?? ""), "בקשת הצטרפות")}`}
            image={(selectedChild as any).photo_url ?? null}
            status={hasActiveKindergarten ? "משויך לגן" : "ממתין לשיוך"}
            secondary={hasActiveKindergarten ? "מידע לפי הרשאה" : "בקשה פתוחה"}
            href={`/dashboard/parent/children/${selectedChild.child_id ?? selectedChild.permanent_child_file_id ?? selectedChild.id}`}
          />
        ) : (
          <section className="parent-child-card no-child">
            <div>
              <h2>{requestedUnavailableChild ? "הילד שביקשת אינו זמין בחשבונך" : family.sourceUnavailable ? "לא הצלחנו לטעון את רשימת הילדים" : "עדיין לא נוסף ילד לחשבון שלך"}</h2>
              <p>{requestedUnavailableChild ? "בחרו ילד מהכרטיסים המורשים למעלה או חזרו למסך הבית של ההורה." : family.sourceUnavailable ? "נסו לרענן את המסך. פרטי הילדים לא שונו." : "הוסף ילד כדי להגיש בקשת רישום לגן בטוח באזור שלך."}</p>
              <div className="parent-child-badges">
                {requestedUnavailableChild || family.sourceUnavailable ? <Link className="blue" href="/dashboard/parent">{requestedUnavailableChild ? "חזרה לילדים שלי" : "נסה שוב"}</Link> : <><a className="green" href="#child-profile"><Baby size={18} /> הוסף ילד</a><Link className="blue" href="/dashboard/parent/discover-kindergartens"><Building2 size={18} /> מצא גן בטוח</Link></>}
              </div>
            </div>
          </section>
        )}

        {selectedChild ? <section className="parent-primary-reference-grid" aria-label="תמונת מצב יומית">
          <ParentSection title="נוכחות היום" subtitle={cleanSyntheticLabel(String(selectedChild.full_name ?? ""), "הילד שלי")}>
            <div className="parent-primary-attendance">
              {attendanceChildren.map(child => {
                const childId = String(child.child_id ?? "");
                const attendance = attendanceRows.find(row => String(row.child_id) === childId);
                const summary = deriveAttendanceSummary(attendance ? [attendance] : [], childId ? 1 : 0);
                const selected = String(child.child_id ?? child.permanent_child_file_id ?? child.id ?? "") === selectedChildId;
                const label = attendanceRes.error ? "לא זמין" : !childId ? "ממתין לשיוך" : summary.departed ? "יצא/ה" : summary.present ? "נוכח/ת" : summary.absent ? "נעדר/ת" : "טרם עודכן";
                return <div className={`parent-primary-attendance-row${selected ? " is-selected" : ""}`} key={childContextKey(child)}>
                  <span className={`parent-primary-attendance-avatar${child.photo_url ? " has-photo" : ""}`} style={child.photo_url ? { backgroundImage: `url(${String(child.photo_url)})` } : undefined}>{child.photo_url ? null : cleanSyntheticLabel(String(child.full_name ?? ""), "ילד").charAt(0)}</span>
                  <span className="parent-primary-attendance-identity"><strong>{cleanSyntheticLabel(String(child.full_name ?? ""), "הילד/ה שלי")}</strong><small>{selected ? "הילד שנבחר" : "ילד נוסף בחשבון"}</small></span>
                  <span className={`parent-primary-attendance-status ${summary.present ? "is-present" : summary.absent ? "is-absent" : "is-pending"}`}><ShieldCheck size={16} />{label}</span>
                  <time>{attendance?.check_in_at ? new Date(String(attendance.check_in_at)).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "—"}</time>
                </div>;
              })}
              <small>{dataUnavailable ? "עדכון הנוכחות אינו זמין כעת" : hasActiveKindergarten ? "לפי רשומות הנוכחות של הגן להיום" : "המידע יוצג לאחר שיוך פעיל"}</small>
              <Link href={`/dashboard/parent/attendance${selectedChildId ? `?child=${selectedChildId}` : ""}`}>לפרטי הנוכחות</Link>
            </div>
          </ParentSection>

          <nav className="parent-mobile-quick-actions" aria-label="פעולות מהירות להורה">
            <Link href="/dashboard/parent/messages"><MessageCircle size={20} aria-hidden="true" />הודעות</Link>
            <Link href="/dashboard/parent/documents"><FileText size={20} aria-hidden="true" />מסמכים</Link>
            <Link href={`/dashboard/parent/payments${selectedChildFileId ? `?child=${selectedChildFileId}` : ""}`}><WalletCards size={20} aria-hidden="true" />תשלומים</Link>
          </nav>

          <ParentSection title="מצלמות הגן" subtitle={hasActiveKindergarten ? cleanSyntheticLabel(selectedGarden?.name, "גן הילד") : "ייפתח לאחר אישור הגן"} action={<Link href="/dashboard/parent/cameras">למצלמות</Link>}>
            <div className="parent-primary-camera">
              <div className="parent-camera-preview"><Camera size={34} /><strong>{hasActiveKindergarten ? "צפייה רק לאחר בדיקת הרשאה" : "ממתין לשיוך"}</strong><span>לא מוצג שידור חי לא מאומת</span></div>
            </div>
          </ParentSection>

          <ParentSection title="הודעות אחרונות" subtitle={`${unreadOrPendingCount} עדכונים פתוחים`}>
            <div className="parent-primary-updates">
              {selectedRequests.length ? selectedRequests.slice(0, 3).map((request) => <ParentListRow
                key={`primary-${request.id}`}
                title={`${cleanSyntheticLabel(request.gardens?.name, "גן")} · ${formatStatus(request.status)}`}
                subtitle={`תשלום: ${formatStatus(request.payment_status)}`}
                time={request.requested_at ? new Date(request.requested_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : undefined}
                icon={Bell}
                tone={request.status === "approved" ? "green" : request.status === "rejected" ? "red" : "purple"}
              />) : <>
                <ParentListRow title={hasActiveKindergarten ? "השיוך לגן פעיל" : "השיוך לגן עדיין בתהליך"} subtitle={cleanSyntheticLabel(String(selectedGarden?.name ?? ""), "הקשר הגן")} icon={Building2} tone={hasActiveKindergarten ? "green" : "purple"} />
                <ParentListRow title={documentRes.error ? "מצב המסמכים אינו זמין" : (documentRes.count ?? 0) ? `${documentRes.count} מסמכים דורשים פעולה` : "המסמכים מעודכנים"} subtitle="מרכז המסמכים של הילד" icon={FileText} tone={documentRes.error ? "neutral" : (documentRes.count ?? 0) ? "orange" : "green"} />
                <ParentListRow title={tuitionRes.error ? "מצב התשלומים אינו זמין" : tuition.outstanding > 0 ? "קיימת יתרה פתוחה" : "אין יתרה פתוחה"} subtitle="שכר לימוד ותשלומים" icon={WalletCards} tone={tuition.outstanding > 0 ? "orange" : "green"} />
              </>}
            </div>
          </ParentSection>
        </section> : null}

        {selectedChild ? <section className="parent-primary-reference-actions" aria-label="פעולות מרכזיות">
          <ParentActionTile title="יצירת קשר" href="/dashboard/parent/messages" icon={Phone} tone="blue" detail={cleanSyntheticLabel(String(selectedGarden?.name ?? ""), "צוות הגן")} />
          <ParentActionTile title="אירועים קרובים" href="/dashboard/parent/schedule" icon={CalendarDays} tone="purple" detail={scheduleRes.error ? "לוח הגן לא זמין" : scheduleItems.length ? new Date(String(scheduleItems[0].starts_at)).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" }) : "אין אירוע קרוב"} />
          <ParentActionTile title="מסמכים" href="/dashboard/parent/documents" icon={FileText} tone={documentRes.error ? "neutral" : (documentRes.count ?? 0) ? "orange" : "green"} detail={documentRes.error ? "הסטטוס לא זמין" : (documentRes.count ?? 0) ? `${documentRes.count} מסמכים לטיפול` : "המסמכים מעודכנים"} />
          <ParentActionTile title="תשלומים" href={`/dashboard/parent/payments${selectedChildFileId ? `?child=${selectedChildFileId}` : ""}`} icon={WalletCards} tone={tuition.outstanding > 0 ? "orange" : "green"} detail={tuitionRes.error ? "הסטטוס לא זמין" : tuition.outstanding > 0 ? new Intl.NumberFormat("he-IL", { style: "currency", currency: tuition.currency }).format(tuition.outstanding) : "אין יתרה פתוחה"} />
        </section> : null}

        <section className="parent-metrics-grid">
          <ParentMetricCard title="עדכונים פתוחים" value={unreadOrPendingCount} hint="בקשות/התראות לטיפול" icon={MessageCircle} tone={unreadOrPendingCount ? "orange" : "green"} href="/dashboard/parent/messages" />
          <ParentMetricCard title="שכר לימוד" value={tuitionRes.error ? "לא זמין" : tuition.outstanding > 0 ? new Intl.NumberFormat("he-IL", { style: "currency", currency: tuition.currency }).format(tuition.outstanding) : hasActiveKindergarten ? "אין יתרה" : "טרם הוגדר"} hint={tuition.reconciliation ? "נדרשת התאמה" : tuition.overdue ? `${tuition.overdue} תקופות באיחור` : "לפי ספר שכר הלימוד"} icon={WalletCards} tone={tuition.outstanding > 0 ? "orange" : hasActiveKindergarten ? "green" : "neutral"} href={`/dashboard/parent/payments${selectedChildFileId ? `?child=${selectedChildFileId}` : ""}`} />
          <ParentMetricCard title="ציון בטיחות" value={safetyScore ?? "לא פורסם"} hint={safetyScore !== null ? "סיכום שאושר להצגה" : "יופיע אחרי פרסום הגן"} icon={ShieldCheck} tone={safetyScore !== null ? "purple" : "neutral"} href="/dashboard/parent/trust-center" />
          <ParentMetricCard title="נוכחות היום" value={!hasActiveKindergarten ? "לא רלוונטי" : todayAttendance.present ? "בגן" : todayAttendance.departed ? "יצא/ה" : todayAttendance.absent ? "נעדר/ת" : "טרם עודכן"} hint={documentRes.error ? "מצב המסמכים אינו זמין" : `${documentRes.count ?? 0} מסמכים דורשים פעולה`} icon={FileText} tone={todayAttendance.present ? "green" : "neutral"} href={`/dashboard/parent/attendance${selectedChildId ? `?child=${selectedChildId}` : ""}`} />
        </section>

        <ParentSection title="מצב מצלמות" subtitle={hasActiveKindergarten ? cleanSyntheticLabel(selectedGarden?.name, "גן הילד") : "ייפתח לאחר אישור הגן"} action={<Link href="/dashboard/parent/cameras">בדיקת זמינות</Link>}>
          <div className="parent-camera-card">
            <div className="parent-camera-preview">
              <Camera size={44} />
              <strong>אין שידור חי במסך הבית</strong>
              <span>{hasActiveKindergarten ? "בדיקת הרשאה נדרשת" : "ממתין לשיוך"}</span>
            </div>
            <div>
              <span className="parent-camera-icon"><Camera size={30} /></span>
              <h3>{hasActiveKindergarten ? "צפיית הורים נעולה עד לבדיקת הרשאה" : "מצלמות ייפתחו רק לאחר אישור"}</h3>
              <p>{hasActiveKindergarten ? "מסך הסטטוס יבדוק אם הגן, המדיניות והשער המאובטח מאפשרים צפייה. אין כאן תצוגת וידאו מדומה." : "אין גישה למצלמות לפני שיוך פעיל לגן."}</p>
              <Link className="parent-outline-button" href="/dashboard/parent/cameras">בדוק זמינות</Link>
            </div>
          </div>
        </ParentSection>

        <section className="parent-action-grid">
          {parentDefaultActions.map((action) => (
            <ParentActionTile key={action.title} title={action.title} href={action.href} icon={action.icon} tone={action.tone} />
          ))}
        </section>

        <section className="parent-two-columns">
          <ParentSection title="היום בגן">
            {scheduleItems.length ? scheduleItems.map((item) => (
              <ParentListRow
                key={item.id}
                title={item.title ?? "פעילות"}
                subtitle={item.description ?? "פורסם על ידי הגן"}
                time={item.starts_at ? new Date(item.starts_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : undefined}
                icon={CalendarDays}
                tone="purple"
              />
            )) : <ParentEmptyState title="אין לו״ז מפורסם כרגע" text="כאשר הגן יפרסם סדר יום להורים, הוא יופיע כאן." />}
          </ParentSection>

          <ParentSection title="התראות אחרונות">
            {selectedRequests.length ? selectedRequests.slice(0, 3).map((request) => (
              <ParentListRow
                key={request.id}
                title={`${cleanSyntheticLabel(request.gardens?.name, "גן")} · ${formatStatus(request.status)}`}
                subtitle={`${cleanSyntheticLabel(request.gardens?.city)} · תשלום: ${formatStatus(request.payment_status)}`}
                time={request.requested_at ? new Date(request.requested_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : undefined}
                icon={Bell}
                tone={request.status === "approved" ? "green" : request.status === "rejected" ? "red" : "purple"}
              />
            )) : <ParentEmptyState title="אין התראות חדשות" text="כשתוגש בקשה או יתקבל עדכון מהגן, הוא יופיע כאן." />}
          </ParentSection>
        </section>

        <section className="parent-management-section" id="requests">
          <div className="parent-section-head">
            <div>
              <h3>בקשות הצטרפות</h3>
              <p>סטטוס הבקשות שהגשתם לגנים.</p>
            </div>
            <Link href="/dashboard/parent/discover-kindergartens">הגשת בקשה חדשה</Link>
          </div>
          {selectedRequests.length === 0 ? (
            <ParentEmptyState title="עוד לא הוגשה בקשה" text="צרו כרטיס ילד ואז בחרו גן מרשימת הגנים הציבורית." action={<Link className="parent-outline-button" href="/dashboard/parent/discover-kindergartens">מצא גן בטוח</Link>} />
          ) : (
            <div className="parent-request-list">
              {selectedRequests.map((request) => (
                <Link href={request.status === "approved_pending_payment" ? "/dashboard/parent/payments" : "#requests"} key={request.id}>
                  <strong>{cleanSyntheticLabel(request.gardens?.name, "גן")} · {formatStatus(request.status)}</strong>
                  <span>{cleanSyntheticLabel(request.gardens?.city)} · תשלום: {formatStatus(request.payment_status)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <ParentSection title="כרטיס ילד" subtitle="המידע נשאר שלך עד שתבחרו גן ותשלחו בקשה." className="parent-management-section">
          <div id="child-profile">
            <ParentChildProfileForm />
          </div>
        </ParentSection>
      </ParentAppFrame>
    </DashboardShell>
  );
}
