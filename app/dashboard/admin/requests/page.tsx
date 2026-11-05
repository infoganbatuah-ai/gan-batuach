import Link from "next/link";
import { Baby, BriefcaseBusiness, Building2, ClipboardCheck, ShieldAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, RoleMetricCard } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

async function settleRequestQuery(query: () => PromiseLike<{ data: unknown[] | null; error: unknown }>, index: number) {
  const label = `admin requests overview ${index}`;
  const result = await safeAdminData(label, async () => {
    const { data, error } = await query();
    logSupabaseError(label, error);
    return { data: error ? null : data, available: !error };
  }, { data: null, available: false });
  return result.data;
}

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

export default async function AdminRequestsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin requests overview", async () => {
    const supabase = await createClient();
    return Promise.all([
      () => supabase.from("kindergarten_enrollment_requests" as any).select("id,status,payment_status,created_at,gardens(name,city),permanent_child_files:child_profile_id(full_name),profiles:parent_id(full_name)").order("created_at", { ascending: false }).limit(80),
      () => supabase.from("staff_job_applications" as any).select("id,status,created_at,gardens(name,city),staff_candidate_profiles:staff_candidate_id(full_name)").order("created_at", { ascending: false }).limit(80),
      () => supabase.from("inspector_applications" as any).select("id,status,created_at,full_name,city,duplicate_flags").order("created_at", { ascending: false }).limit(80),
      () => supabase.from("user_affiliation_requests" as any).select("id,status,request_type,target_type,created_at").order("created_at", { ascending: false }).limit(80),
      () => supabase.from("gardens" as any).select("id,name,city,approval_flow_status,created_at").in("approval_flow_status", ["activation_in_progress", "onboarding_submitted", "pending_final_approval", "correction_required", "payment_pending"]).order("created_at", { ascending: false }).limit(80)
    ].map(settleRequestQuery));
  }, Array.from({ length: 5 }, () => ({ data: null, available: false })));
  const [enrollments, staffApps, inspectorApps, affiliations, gardenApps] = result.data;
  const allAvailable = result.data.every((query) => query.available);
  const parentRows = (enrollments.data ?? []) as any[];
  const staffRows = (staffApps.data ?? []) as any[];
  const inspectorRows = (inspectorApps.data ?? []) as any[];
  const affiliationRows = (affiliations.data ?? []) as any[];
  const gardenRows = (gardenApps.data ?? []) as any[];
  const allOpen = [...parentRows, ...staffRows, ...inspectorRows, ...affiliationRows, ...gardenRows].filter((row) => !["approved", "active", "rejected", "cancelled", "expired", "suspended"].includes(String(row.status ?? row.approval_flow_status)));

  return (
    <DashboardShell role="admin" title="בקשות משתמשים">
      <section className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Self-Service Requests</p>
          <h1>מרכז בקשות הרשמה ושיוך.</h1>
          <p>הורים, מועמדי צוות ומועמדי מפקחים נשארים מוגבלים עד אישור הגורם המתאים.</p>
        </div>
        {allAvailable ? <span className={allOpen.length ? "pill warn" : "pill good"}>{allOpen.length} פתוחות</span> : <span className="pill" role="status">סיכום הבקשות אינו זמין</span>}
      </section>
      {!allAvailable ? <div className="card" role="status">לא ניתן לטעון חלק מנתוני הבקשות כרגע. הסיכום הכולל אינו זמין.</div> : null}
      <section className="grid cols-4 dashboard-kpis">
        <RoleMetricCard label="בקשות הורים" value={enrollments.available ? parentRows.length : "לא זמין"} />
        <RoleMetricCard label="מועמדויות צוות" value={staffApps.available ? staffRows.length : "לא זמין"} />
        <RoleMetricCard label="בקשות מפקחים" value={inspectorApps.available ? inspectorRows.length : "לא זמין"} />
        <RoleMetricCard label="בקשות גנים" value={gardenApps.available ? gardenRows.length : "לא זמין"} />
      </section>
      <section className="staff-action-grid">
        <ActionCard title="בקשות גנים" text="אישור מנהלות, פרופיל גן ומנוי" href="/dashboard/admin/kindergarten-applications" icon={Building2} />
        <ActionCard title="בקשות מפקחים" text="אישור, דחייה ושיוך גנים" href="/dashboard/admin/inspector-applications" icon={ClipboardCheck} />
        <ActionCard title="משתמשים" text="ניהול חשבונות קיימים" href="/dashboard/admin/users" icon={ShieldAlert} />
      </section>
      <section className="grid cols-3">
        <article className="card action-panel">
          <h2><Baby size={18} /> בקשות הורים</h2>
          <div className="procedure-list compact">
            {enrollments.available ? parentRows.slice(0, 12).map((row) => <Link href="/dashboard/garden/enrollment-requests" key={row.id}><span className={statusTone(row.status)}>{formatStatus(row.status)}</span><strong>{row.permanent_child_files?.full_name ?? "ילד/ה"}</strong><small>{row.gardens?.name ?? ""} · {row.payment_status}</small></Link>) : <p role="status">נתוני בקשות ההורים אינם זמינים</p>}
          </div>
        </article>
        <article className="card action-panel">
          <h2><BriefcaseBusiness size={18} /> מועמדויות צוות</h2>
          <div className="procedure-list compact">
            {staffApps.available ? staffRows.slice(0, 12).map((row) => <Link href="/dashboard/garden/staff-applications" key={row.id}><span className={statusTone(row.status)}>{formatStatus(row.status)}</span><strong>{row.staff_candidate_profiles?.full_name ?? "מועמד/ת"}</strong><small>{row.gardens?.name ?? ""}</small></Link>) : <p role="status">נתוני מועמדויות הצוות אינם זמינים</p>}
          </div>
        </article>
        <article className="card action-panel">
          <h2><ClipboardCheck size={18} /> בקשות מפקחים</h2>
          <div className="procedure-list compact">
            {inspectorApps.available ? inspectorRows.slice(0, 12).map((row) => <Link href="/dashboard/admin/inspector-applications" key={row.id}><span className={statusTone(row.status)}>{formatStatus(row.status)}</span><strong>{row.full_name}</strong><small>{row.city ?? ""}</small></Link>) : <p role="status">נתוני בקשות המפקחים אינם זמינים</p>}
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}
