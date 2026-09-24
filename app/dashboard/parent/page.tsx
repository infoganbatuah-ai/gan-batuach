import Link from "next/link";
import { Baby, Bell, Building2, CalendarDays, Camera, FileText, MessageCircle, ShieldCheck, WalletCards } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentChildProfileForm } from "@/components/self-service-forms";
import { ParentKindergartenInvitationsPanel } from "@/components/parent-kindergarten-invitations-panel";
import {
  ParentActionTile,
  ParentAppFrame,
  ParentChildCard,
  ParentEmptyState,
  ParentHero,
  ParentListRow,
  ParentMetricCard,
  ParentSection,
  parentDefaultActions
} from "@/components/parent-app-ui";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel, isSyntheticLabel } from "@/lib/domain/display-label";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
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
  const childContexts = [...enrollmentRows, ...(childProfiles as unknown as DashboardRow[])]
    .filter((child, index, all) => {
      const id = String(child.child_id ?? child.permanent_child_file_id ?? child.id ?? "");
      return id && all.findIndex(item => String(item.child_id ?? item.permanent_child_file_id ?? item.id ?? "") === id) === index;
    });
  const selectedChild = selectAuthorizedChild(childContexts, requestedChildId);
  const selectedChildId = String(selectedChild?.child_id ?? selectedChild?.permanent_child_file_id ?? selectedChild?.id ?? "");
  const activeEnrollment = enrollmentRows.find((enrollment) => String(enrollment.child_id ?? enrollment.permanent_child_file_id) === selectedChildId && ["active", "approved"].includes(String(enrollment.status)))
    ?? enrollmentRows.find((enrollment) => String(enrollment.child_id ?? enrollment.permanent_child_file_id) === selectedChildId);
  const selectedRequests = requests.filter(request => !request.child_profile_id || String(request.child_profile_id) === selectedChildId);
  const pending = selectedRequests.filter((request) => !["approved", "rejected", "cancelled", "expired"].includes(String(request.status)));
  const selectedGarden = ((family.gardens ?? []) as unknown as DashboardRow[]).find((garden) => garden.id === (activeEnrollment?.garden_id ?? activeEnrollment?.kindergarten_id)) ?? selectedRequests[0]?.gardens;
  const selectedGardenId = String(activeEnrollment?.garden_id ?? activeEnrollment?.kindergarten_id ?? "");
  const hasActiveKindergarten = Boolean(selectedGardenId && ["active", "approved"].includes(String(activeEnrollment?.status)));
  const [scheduleRes, attendanceRes, tuitionRes, documentRes, notificationRes] = await Promise.all([
    hasActiveKindergarten
    ? supabase.from("schedule_items" as any)
      .select("id,title,description,starts_at,visible_to_parents")
      .eq("garden_id", selectedGardenId)
      .eq("visible_to_parents", true)
      .order("starts_at", { ascending: true })
      .limit(4)
    : Promise.resolve({ data: [], error: null }),
    selectedChildId ? supabase.from("attendance" as any).select("status,attendance_date,check_in_at,check_out_at").eq("child_id", selectedChildId).order("attendance_date", { ascending: false }).limit(1) : Promise.resolve({ data: [], error: null }),
    selectedChildId ? supabase.from("tuition_billing_periods" as any).select("base_amount,adjustment_total,settled_total,status,due_at,currency").eq("child_id", selectedChildId).not("status", "in", "(paid,waived,cancelled)").limit(100) : Promise.resolve({ data: [], error: null }),
    selectedChildId ? supabase.from("documents" as any).select("id,status,expires_at", { count: "exact", head: true }).eq("child_id", selectedChildId).is("deleted_at", null).in("status", ["pending_review", "expired", "rejected"]) : Promise.resolve({ data: [], count: 0, error: null }),
    supabase.from("notifications" as any).select("id", { count: "exact", head: true }).eq("recipient_id", profile.id).is("read_at", null).is("archived_at", null)
  ]);
  const scheduleItems = (scheduleRes.data ?? []) as any[];
  const todayAttendance = deriveAttendanceSummary((attendanceRes.data ?? []) as unknown as DashboardRow[], hasActiveKindergarten ? 1 : 0);
  const tuition = deriveTuitionSummary((tuitionRes.data ?? []) as unknown as DashboardRow[], new Date().toISOString().slice(0, 10));
  const safetyScore = selectedGarden?.last_inspection_score ?? null;
  const unreadOrPendingCount = (notificationRes.count ?? 0) + pending.length;
  const syntheticSession = [profile.full_name, String(selectedChild?.full_name ?? ""), String(selectedGarden?.name ?? "")].some(isSyntheticLabel);

  return (
    <DashboardShell role="parent" title="אזור הורה" appHome>
      <ParentAppFrame active="dashboard" profileName={profile.full_name} avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title="דשבורד הורים" subtitle="מעקב חכם אחר הילד והגן" />

        {syntheticSession ? <div className="dashboard-environment-notice" role="status">סביבת בדיקה עם נתונים סינתטיים בלבד. נתוני ילדים והורים אמיתיים אינם מופעלים כאן.</div> : null}

        <ParentKindergartenInvitationsPanel />

        {childContexts.length > 1 ? <form className="parent-child-selector" method="get" aria-label="בחירת ילד להצגת הדשבורד">
          <label htmlFor="dashboard-child">הצגת מידע עבור</label>
          <select id="dashboard-child" name="child" defaultValue={selectedChildId}>
            {childContexts.map(child => {
              const id = String(child.child_id ?? child.permanent_child_file_id ?? child.id);
              return <option value={id} key={id}>{cleanSyntheticLabel(String(child.full_name ?? child.child?.full_name ?? ""), "ילד/ה")}</option>;
            })}
          </select>
          <button className="parent-outline-button" type="submit">החלפת ילד</button>
        </form> : null}

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
              <h2>עדיין לא נוסף ילד לחשבון שלך</h2>
              <p>הוסף ילד כדי להגיש בקשת רישום לגן בטוח באזור שלך.</p>
              <div className="parent-child-badges">
                <a className="green" href="#child-profile"><Baby size={18} /> הוסף ילד</a>
                <Link className="blue" href="/dashboard/parent/discover-kindergartens"><Building2 size={18} /> מצא גן בטוח</Link>
              </div>
            </div>
          </section>
        )}

        <section className="parent-metrics-grid">
          <ParentMetricCard title="עדכונים פתוחים" value={unreadOrPendingCount} hint="בקשות/התראות לטיפול" icon={MessageCircle} tone={unreadOrPendingCount ? "orange" : "green"} href="/dashboard/parent/messages" />
          <ParentMetricCard title="שכר לימוד" value={tuition.outstanding > 0 ? new Intl.NumberFormat("he-IL", { style: "currency", currency: tuition.currency }).format(tuition.outstanding) : hasActiveKindergarten ? "אין יתרה" : "טרם הוגדר"} hint={tuition.reconciliation ? "נדרשת התאמה" : tuition.overdue ? `${tuition.overdue} תקופות באיחור` : "לפי ספר שכר הלימוד"} icon={WalletCards} tone={tuition.outstanding > 0 ? "orange" : hasActiveKindergarten ? "green" : "neutral"} href={`/dashboard/parent/payments${selectedChildId ? `?child=${selectedChildId}` : ""}`} />
          <ParentMetricCard title="ציון בטיחות" value={safetyScore ?? "לא פורסם"} hint={safetyScore !== null ? "סיכום שאושר להצגה" : "יופיע אחרי פרסום הגן"} icon={ShieldCheck} tone={safetyScore !== null ? "purple" : "neutral"} href="/dashboard/parent/trust-center" />
          <ParentMetricCard title="נוכחות היום" value={!hasActiveKindergarten ? "לא רלוונטי" : todayAttendance.present ? "בגן" : todayAttendance.departed ? "יצא/ה" : todayAttendance.absent ? "נעדר/ת" : "טרם עודכן"} hint={`${documentRes.count ?? 0} מסמכים דורשים פעולה`} icon={FileText} tone={todayAttendance.present ? "green" : "neutral"} href={`/dashboard/parent/attendance${selectedChildId ? `?child=${selectedChildId}` : ""}`} />
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
