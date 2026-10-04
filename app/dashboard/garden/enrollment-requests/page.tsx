import Link from "next/link";
import { AlertTriangle, Baby, CalendarDays, CheckCircle2, CircleDot, Clock3, CreditCard, FileQuestion, GraduationCap, Search, UserPlus, UsersRound, WalletCards } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ApplicationDecisionForm } from "@/components/self-service-forms";
import { ManualEnrollmentActivationForm } from "@/components/manual-enrollment-activation-form";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { TeacherAppFrame, TeacherEmptyState } from "@/components/teacher-app-ui";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type SearchParams = { status?: string; q?: string; request?: string };
type EnrollmentRow = Record<string, any> & { id: string; status: string };

const actions = [
  { value: "review", label: "סימון בבדיקה" },
  { value: "request_information", label: "בקשת מידע נוסף" },
  { value: "approve", label: "אישור ושמירת מקום לפני תשלום" },
  { value: "waitlist", label: "העברה לרשימת המתנה" },
  { value: "reject", label: "דחייה" }
];

const lifecycle: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "muted" }> = {
  draft: { label: "טיוטה", tone: "muted" }, submitted: { label: "חדשה", tone: "info" }, under_review: { label: "בבדיקה", tone: "info" },
  information_required: { label: "נדרש מידע", tone: "warning" }, resubmitted: { label: "נשלחה מחדש", tone: "info" }, approved: { label: "אושרה", tone: "success" },
  awaiting_payment: { label: "ממתינה להסדר", tone: "warning" }, waitlisted: { label: "רשימת המתנה", tone: "warning" }, payment_reconciliation_required: { label: "נדרשת התאמה", tone: "danger" },
  activated: { label: "הרשמה פעילה", tone: "success" }, active: { label: "הרשמה פעילה", tone: "success" }, rejected: { label: "נדחתה", tone: "danger" }, cancelled: { label: "בוטלה", tone: "muted" }
};

const filterItems = [
  { value: "all", label: "הכל" }, { value: "submitted", label: "חדשות" }, { value: "information_required", label: "נדרש מידע" },
  { value: "waitlisted", label: "המתנה" }, { value: "awaiting_payment", label: "לפני הפעלה" }, { value: "activated", label: "פעילות" }
];

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}
function rowChild(row: EnrollmentRow) { return row.permanent_child_files as Record<string, unknown> | null; }
function rowParent(row: EnrollmentRow) { return row.profiles as Record<string, unknown> | null; }

export default async function GardenEnrollmentRequestsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const access = await getManagementGardenContext();
  if (!access.allowed) notFound();
  const { profile } = access.session;
  const params = await searchParams;
  const supabase = await createClient();
  const gardenId = access.gardenId;
  const [requestsRes, gardenRes, classroomsRes, reservationsRes] = await Promise.all([
    supabase.from("kindergarten_enrollment_requests" as never).select("id,parent_id,child_profile_id,garden_id,requested_classroom_id,status,requested_age_group,parent_message,published_price_snapshot,payment_status,decision_reason,information_request,information_response,requested_at,created_at,updated_at,reservation_id,permanent_child_files:child_profile_id(full_name,birth_date,duplicate_flags),profiles:parent_id(full_name,phone,email),classrooms:requested_classroom_id(name,capacity_limit)" as any).eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(100),
    supabase.from("gardens" as never).select("name,city" as never).eq("id", gardenId).maybeSingle(),
    supabase.from("classrooms" as never).select("id,name" as never).eq("garden_id", gardenId).eq("status", "active").order("sort_order"),
    supabase.from("classroom_seat_reservations" as never).select("id,enrollment_request_id,classroom_id,status,expires_at" as never).eq("garden_id", gardenId)
  ]);

  const scopedRows = (requestsRes.data ?? []) as unknown as EnrollmentRow[];
  // The authenticated query above is the authorization boundary. The narrow
  // server-only lookup only enriches those already scoped request IDs, because
  // applicant profiles do not yet have an active Garden relationship for RLS.
  const childFileIds = [...new Set(scopedRows.map((row) => String(row.child_profile_id)).filter(Boolean))];
  const parentIds = [...new Set(scopedRows.map((row) => String(row.parent_id)).filter(Boolean))];
  const admin = createAdminClient();
  const [childFilesRes, parentsRes] = await Promise.all([
    childFileIds.length ? admin.from("permanent_child_files").select("id,full_name,birth_date,duplicate_flags").in("id", childFileIds) : Promise.resolve({ data: [], error: null }),
    parentIds.length ? admin.from("profiles").select("id,full_name,phone,email").in("id", parentIds) : Promise.resolve({ data: [], error: null })
  ]);
  const childFileById = new Map((childFilesRes.data ?? []).map((row) => [row.id, row]));
  const parentById = new Map((parentsRes.data ?? []).map((row) => [row.id, row]));
  const rows: EnrollmentRow[] = scopedRows.map((row) => ({
    ...row,
    permanent_child_files: childFileById.get(String(row.child_profile_id)) ?? row.permanent_child_files,
    profiles: parentById.get(String(row.parent_id)) ?? row.profiles
  }) as EnrollmentRow);
  const query = (params.q ?? "").trim().toLocaleLowerCase("he");
  const status = params.status ?? "all";
  const filteredRows = rows.filter((row) => {
    const child = rowChild(row); const parent = rowParent(row);
    const matchesText = !query || `${child?.full_name ?? ""} ${parent?.full_name ?? ""} ${row.requested_age_group ?? ""}`.toLocaleLowerCase("he").includes(query);
    const matchesStatus = status === "all" || row.status === status || (status === "activated" && row.status === "active");
    return matchesText && matchesStatus;
  });
  const selected = filteredRows.find((row) => row.id === params.request) ?? filteredRows[0] ?? null;
  const selectedReservation = ((reservationsRes.data ?? []) as unknown as EnrollmentRow[]).find((item) => item.enrollment_request_id === selected?.id);
  const garden = gardenRes.data as Record<string, unknown> | null;
  const gardenName = String(garden?.name ?? "הגן הפעיל").replace(/\[DEMO\]/g, "").trim();
  const sourceErrors = [requestsRes.error, gardenRes.error, classroomsRes.error, reservationsRes.error, childFilesRes.error, parentsRes.error].filter(Boolean);
  const count = (states: string[]) => rows.filter((row) => states.includes(row.status)).length;

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="בקשות רישום" appHome>
      <TeacherAppFrame role={profile.role === "owner" ? "owner" : "manager"} title="בקשות רישום" subtitle={gardenName} avatarUrl={(profile as { profile_image_url?: string | null }).profile_image_url ?? null} active="children">
        <div className="ux04-domain-workspace ux04-enrollment-workspace">
          <header className="ux04-workspace-header"><div><span className="ux04-eyebrow"><UserPlus size={17} /> קליטה ורישום</span><h2>בקשות רישום</h2><p>{rows.length} בקשות ב{gardenName} · כל שלב נשמר בנפרד</p></div><Link className="button secondary" href="/dashboard/garden/children?new=1"><Baby size={18} /> הוספת ילד/ה ישירות</Link></header>
          <nav className="ux04-domain-tabs" aria-label="ילדים, כיתות ורישום"><Link href="/dashboard/garden/children"><Baby size={18} /> ילדים</Link><Link href="/dashboard/garden/children?section=classrooms"><GraduationCap size={18} /> כיתות</Link><Link className="active" href="/dashboard/garden/enrollment-requests"><CircleDot size={18} /> בקשות רישום</Link></nav>
          {sourceErrors.length ? <div className="ux04-source-error"><AlertTriangle size={20} /><span><b>חלק מנתוני הרישום אינם זמינים</b><small>לא מוצג אפס במקום מקור שנכשל. נסו לרענן.</small></span></div> : null}
          <section className="ux04-summary-strip" aria-label="סיכום בקשות רישום"><span className="blue"><b>{count(["submitted", "resubmitted"])}</b><small>חדשות</small></span><span className="orange"><b>{count(["information_required"])}</b><small>נדרש מידע</small></span><span className="purple"><b>{count(["awaiting_payment", "approved"])}</b><small>לפני הפעלה</small></span><span className="green"><b>{count(["activated", "active"])}</b><small>פעילות</small></span></section>
          <form className="ux04-filter-bar ux04-enrollment-filters" action="/dashboard/garden/enrollment-requests"><label className="ux04-search"><Search size={20} /><input name="q" defaultValue={params.q ?? ""} placeholder="חיפוש לפי ילד/ה, הורה או קבוצת גיל" /></label><div className="ux04-filter-pills" role="group" aria-label="סינון לפי סטטוס">{filterItems.map((item) => <Link className={status === item.value ? "active" : ""} href={`/dashboard/garden/enrollment-requests?status=${item.value}${query ? `&q=${encodeURIComponent(query)}` : ""}`} key={item.value}>{item.label} <b>{item.value === "all" ? rows.length : count(item.value === "activated" ? ["activated", "active"] : [item.value])}</b></Link>)}</div><button className="button secondary" type="submit">חיפוש</button></form>
          {filteredRows.length ? <section className="ux04-enrollment-layout">
            <div className="ux04-list-surface ux04-enrollment-list"><div className="ux04-enrollment-table" role="table" aria-label="בקשות רישום"><div className="ux04-table-head" role="row"><span>ילד/ה</span><span>גיל / קבוצה</span><span>כיתה מבוקשת</span><span>הורה</span><span>סטטוס</span><span>תאריך</span></div>{filteredRows.map((row) => { const child = rowChild(row); const parent = rowParent(row); const state = lifecycle[row.status] ?? { label: row.status, tone: "muted" as const }; const classroom = row.classrooms as Record<string, unknown> | null; return <Link className={`ux04-enrollment-row ${selected?.id === row.id ? "selected" : ""}`} href={`/dashboard/garden/enrollment-requests?status=${status}&request=${row.id}`} key={row.id}><span><b>{String(child?.full_name ?? "ילד/ה")}</b><small>{formatDate(typeof child?.birth_date === "string" ? child.birth_date : null)}</small></span><span>{String(row.requested_age_group ?? "לא צוין")}</span><span>{String(classroom?.name ?? "טרם נבחרה")}</span><span><b>{String(parent?.full_name ?? "הורה")}</b><small>{String(parent?.phone ?? "")}</small></span><StatusChip tone={state.tone}>{state.label}</StatusChip><time>{formatDate(row.requested_at ?? row.created_at)}</time></Link>; })}</div>
              <div className="ux04-mobile-enrollment-list">{filteredRows.map((row) => { const child = rowChild(row); const state = lifecycle[row.status] ?? { label: row.status, tone: "muted" as const }; return <Link className="ux04-mobile-enrollment-card" href={`/dashboard/garden/enrollment-requests?status=${status}&request=${row.id}`} key={`mobile-${row.id}`}><span className="ux04-row-icon"><Baby size={20} /></span><span><b>{String(child?.full_name ?? "ילד/ה")}</b><small>{String(row.requested_age_group ?? "קבוצת גיל")} · {formatDate(row.requested_at ?? row.created_at)}</small></span><StatusChip tone={state.tone}>{state.label}</StatusChip></Link>; })}</div></div>
            {selected ? <EnrollmentDetail request={selected} reservation={selectedReservation} classrooms={(classroomsRes.data ?? []) as unknown as Array<{ id: string; name: string }>} /> : null}
          </section> : <TeacherEmptyState title={query || status !== "all" ? "לא נמצאו בקשות בסינון הזה" : "אין בקשות רישום"} text="בקשה חדשה תופיע כאן עם מצב מדויק ופעולת ההמשך המתאימה." action={<Link className="button secondary" href="/dashboard/garden/enrollment-requests">ניקוי סינון</Link>} />}
        </div>
      </TeacherAppFrame>
    </DashboardShell>
  );
}

function EnrollmentDetail({ request, reservation, classrooms }: { request: EnrollmentRow; reservation?: EnrollmentRow; classrooms: Array<{ id: string; name: string }> }) {
  const child = rowChild(request); const parent = rowParent(request); const state = lifecycle[request.status] ?? { label: request.status, tone: "muted" as const };
  return <aside className="ux04-enrollment-detail" aria-label="פרטי בקשת הרישום"><header><div><span className="ux04-eyebrow">בקשה נבחרת</span><h3>{String(child?.full_name ?? "ילד/ה")}</h3><p>{String(request.requested_age_group ?? "קבוצת גיל לא צוינה")} · הוגשה {formatDate(request.requested_at ?? request.created_at)}</p></div><StatusChip tone={state.tone}>{state.label}</StatusChip></header>
    <div className="ux04-enrollment-facts"><span><UsersRound size={18} /><small>הורה/אפוטרופוס</small><b>{String(parent?.full_name ?? "לא צוין")}</b></span><span><CalendarDays size={18} /><small>תאריך לידה</small><b>{formatDate(typeof child?.birth_date === "string" ? child.birth_date : null)}</b></span><span><WalletCards size={18} /><small>שכר לימוד שפורסם</small><b>{request.published_price_snapshot == null ? "לא פורסם" : `₪${Number(request.published_price_snapshot).toLocaleString("he-IL")}`}</b></span><span><CreditCard size={18} /><small>מצב תשלום</small><b>{String(request.payment_status ?? "טרם הוסדר")}</b></span></div>
    {request.parent_message ? <section className="ux04-detail-note"><b>הודעת ההורה</b><p>{String(request.parent_message)}</p></section> : null}
    {request.information_request ? <section className="ux04-detail-note warning"><b>מידע שהתבקש</b><p>{String(request.information_request)}</p>{request.information_response ? <small>תשובה: {String(request.information_response)}</small> : null}</section> : null}
    {reservation ? <section className="ux04-reservation-state"><Clock3 size={19} /><span><b>שמירת מקום: {String(reservation.status)}</b><small>{reservation.expires_at ? `בתוקף עד ${formatDate(String(reservation.expires_at))}` : "ללא מועד תפוגה מוצג"}</small></span></section> : <section className="ux04-reservation-state muted"><FileQuestion size={19} /><span><b>אין שמירת מקום פעילה</b><small>האישור והקיבולת נקבעים בתהליך הקנוני.</small></span></section>}
    <section className="ux04-decision-panel"><h4>המשך טיפול</h4><ApplicationDecisionForm endpoint={`/api/garden/enrollment-requests/${request.id}`} actions={actions} classrooms={classrooms} /></section>
    {request.status === "awaiting_payment" ? <section className="ux04-activation-panel"><h4><CheckCircle2 size={18} /> הסדר ידני והפעלת הרשמה</h4><p>ההפעלה אטומית ומאמתת מקום, תשלום וסטטוס בקשה בצד השרת.</p><ManualEnrollmentActivationForm requestId={request.id} suggestedAmount={request.published_price_snapshot} /></section> : null}
    {request.status === "payment_reconciliation_required" ? <p className="ux04-policy-note danger"><AlertTriangle size={18} /> נדרשת התאמת תשלום ידנית לפני הפעלה.</p> : null}
  </aside>;
}
