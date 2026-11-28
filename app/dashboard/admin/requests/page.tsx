import Link from "next/link";
import { Baby, BriefcaseBusiness, Building2, ClipboardCheck, ShieldAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, RoleMetricCard } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { parseAdminRequestSelection, selectAdminRequestRow } from "@/lib/management/admin-request-selection";
import { createClient } from "@/lib/supabase/server";

type GardenSummary = { name?: string | null; city?: string | null } | null;
type ApplicantSummary = { full_name?: string | null } | null;
type RequestSummary = { id: string; status?: string | null; created_at?: string | null; gardens?: GardenSummary; permanent_child_files?: ApplicantSummary; staff_candidate_profiles?: ApplicantSummary; payment_status?: string | null; requested_role?: string | null; approval_flow_status?: string | null };

function statusTone(status?: string | null) {
  if (status === "approved" || status === "active") return "pill good";
  if (status === "rejected" || status === "suspended") return "pill bad";
  return "pill warn";
}

function formatStatus(status?: string | null) {
  const map: Record<string, string> = {
    draft: "טיוטה",
    submitted: "נשלח",
    under_review: "נבדק",
    more_information_requested: "נדרש מידע נוסף",
    approved_pending_payment: "אושר, ממתין לתשלום",
    approved_pending_subscription: "אושר, ממתין למנוי",
    approved: "מאושר",
    rejected: "נדחה",
    cancelled: "בוטל",
    expired: "פג תוקף",
    suspended: "מושהה",
    activation_in_progress: "בהקמה",
    onboarding_submitted: "הגשה לאדמין",
    pending_final_approval: "ממתין לאישור סופי",
    correction_required: "נדרש תיקון",
    payment_pending: "ממתין לתשלום",
    pending_affiliation: "ממתין לשיוך",
    active: "פעיל",
    processing: "מעובד",
    completed: "בוצע",
    review_required: "דורש בדיקה"
  };
  return map[status ?? ""] ?? status ?? "-";
}

export default async function AdminRequestsPage({ searchParams }: { searchParams: Promise<{ kind?: string | string[]; id?: string | string[] }> }) {
  await requireRole(["admin"]);
  const query = await searchParams;
  const selection = parseAdminRequestSelection(query);
  const supabase = await createClient();
  const [enrollments, staffApps, inspectorApps, affiliations, gardenApps] = await Promise.all([
    supabase.from("kindergarten_enrollment_requests" as never).select("id,status,payment_status,created_at,gardens(name,city),permanent_child_files:child_profile_id(full_name)" as never).order("created_at", { ascending: false }).limit(80),
    supabase.from("staff_job_applications" as never).select("id,status,requested_role,created_at,gardens(name,city),staff_candidate_profiles:staff_candidate_id(full_name)" as never).order("created_at", { ascending: false }).limit(80),
    supabase.from("inspector_applications" as never).select("id,status,created_at,full_name,city,duplicate_flags" as never).order("created_at", { ascending: false }).limit(80),
    supabase.from("user_affiliation_requests" as never).select("id,status,request_type,target_type,created_at" as never).order("created_at", { ascending: false }).limit(80),
    supabase.from("gardens" as never).select("id,name,city,approval_flow_status,created_at" as never).in("approval_flow_status" as never, ["activation_in_progress", "onboarding_submitted", "pending_final_approval", "correction_required", "payment_pending"] as never).order("created_at", { ascending: false }).limit(80)
  ]);
  const parentRows = (enrollments.data ?? []) as unknown as RequestSummary[];
  const staffRows = (staffApps.data ?? []) as unknown as RequestSummary[];
  const inspectorRows = (inspectorApps.data ?? []) as unknown as Array<RequestSummary & { full_name?: string | null; city?: string | null }>;
  const affiliationRows = (affiliations.data ?? []) as unknown as RequestSummary[];
  const gardenRows = (gardenApps.data ?? []) as unknown as RequestSummary[];
  const selectedRow = selection?.kind === "parent"
    ? selectAdminRequestRow(parentRows, selection.id)
    : selection?.kind === "staff" ? selectAdminRequestRow(staffRows, selection.id) : null;
  const selectionRequested = query.kind !== undefined || query.id !== undefined;
  const allOpen = [...parentRows, ...staffRows, ...inspectorRows, ...affiliationRows, ...gardenRows].filter((row) => !["approved", "active", "rejected", "cancelled", "expired", "suspended"].includes(String(row.status ?? row.approval_flow_status)));

  return (
    <DashboardShell role="admin" title="בקשות משתמשים">
      <section className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Self-Service Requests</p>
          <h1>מרכז בקשות הרשמה ושיוך.</h1>
          <p>הורים, מועמדי צוות ומועמדי מפקחים נשארים מוגבלים עד אישור הגורם המתאים.</p>
        </div>
        <span className={allOpen.length ? "pill warn" : "pill good"}>{allOpen.length} פתוחות</span>
      </section>
      <section className="grid cols-4 dashboard-kpis">
        <RoleMetricCard label="בקשות הורים" value={parentRows.length} />
        <RoleMetricCard label="מועמדויות צוות" value={staffRows.length} />
        <RoleMetricCard label="בקשות מפקחים" value={inspectorRows.length} />
        <RoleMetricCard label="בקשות גנים" value={gardenRows.length} />
      </section>
      <section className="staff-action-grid">
        <ActionCard title="בקשות גנים" text="אישור מנהלות, פרופיל גן ומנוי" href="/dashboard/admin/kindergarten-applications" icon={Building2} />
        <ActionCard title="בקשות מפקחים" text="אישור, דחייה ושיוך גנים" href="/dashboard/admin/inspector-applications" icon={ClipboardCheck} />
        <ActionCard title="משתמשים" text="ניהול חשבונות קיימים" href="/dashboard/admin/users" icon={ShieldAlert} />
      </section>
      {selectionRequested ? <section className="card action-panel" aria-label="פרטי הבקשה שנבחרה">
        <div className="section-heading"><h2>{selection?.kind === "parent" ? "בקשת רישום הורה" : selection?.kind === "staff" ? "מועמדות צוות" : "בקשה לא זמינה"}</h2><Link href="/dashboard/admin/requests">חזרה לכל הבקשות</Link></div>
        {selectedRow && selection ? <div className="procedure-list compact">
          <div className="list-item"><strong>{selection.kind === "parent" ? selectedRow.permanent_child_files?.full_name ?? "ילד/ה" : selectedRow.staff_candidate_profiles?.full_name ?? "מועמד/ת"}</strong><span className={statusTone(selectedRow.status)}>{formatStatus(selectedRow.status)}</span></div>
          <div className="list-item"><strong>גן</strong><span>{selectedRow.gardens?.name ?? "לא צוין"}{selectedRow.gardens?.city ? ` · ${selectedRow.gardens.city}` : ""}</span></div>
          {selection.kind === "parent" ? <div className="list-item"><strong>הסדר תשלום</strong><span>{formatStatus(selectedRow.payment_status)}</span></div> : <div className="list-item"><strong>תפקיד מבוקש</strong><span>{selectedRow.requested_role ?? "לא צוין"}</span></div>}
          <div className="list-item"><strong>מועד הגשה</strong><span>{selectedRow.created_at ? new Date(selectedRow.created_at).toLocaleDateString("he-IL") : "לא צוין"}</span></div>
        </div> : <p className="empty-mini">הבקשה אינה זמינה ברשימת הבקשות המורשית. רעננו את הרשימה או חזרו אליה.</p>}
      </section> : null}
      <section className="grid cols-3">
        <article className="card action-panel">
          <h2><Baby size={18} /> בקשות הורים</h2>
          <div className="procedure-list compact">
            {parentRows.slice(0, 12).map((row) => <Link href={`/dashboard/admin/requests?kind=parent&id=${row.id}`} key={row.id}><span className={statusTone(row.status)}>{formatStatus(row.status)}</span><strong>{row.permanent_child_files?.full_name ?? "ילד/ה"}</strong><small>{row.gardens?.name ?? ""} · {row.payment_status}</small></Link>)}
          </div>
        </article>
        <article className="card action-panel">
          <h2><BriefcaseBusiness size={18} /> מועמדויות צוות</h2>
          <div className="procedure-list compact">
            {staffRows.slice(0, 12).map((row) => <Link href={`/dashboard/admin/requests?kind=staff&id=${row.id}`} key={row.id}><span className={statusTone(row.status)}>{formatStatus(row.status)}</span><strong>{row.staff_candidate_profiles?.full_name ?? "מועמד/ת"}</strong><small>{row.gardens?.name ?? ""}</small></Link>)}
          </div>
        </article>
        <article className="card action-panel">
          <h2><ClipboardCheck size={18} /> בקשות מפקחים</h2>
          <div className="procedure-list compact">
            {inspectorRows.slice(0, 12).map((row) => <Link href="/dashboard/admin/inspector-applications" key={row.id}><span className={statusTone(row.status)}>{formatStatus(row.status)}</span><strong>{row.full_name}</strong><small>{row.city ?? ""}</small></Link>)}
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}
