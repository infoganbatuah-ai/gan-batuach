import Link from "next/link";
import { Baby, BriefcaseBusiness, Building2, ClipboardCheck, ShieldAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, RoleMetricCard } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function statusTone(status?: string | null) {
  if (status === "approved" || status === "active") return "pill good";
  if (status === "rejected" || status === "suspended") return "pill bad";
  return "pill warn";
}

export default async function AdminRequestsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const [enrollments, staffApps, inspectorApps, affiliations, gardenApps] = await Promise.all([
    supabase.from("kindergarten_enrollment_requests" as any).select("id,status,payment_status,created_at,gardens(name,city),permanent_child_files:child_profile_id(full_name),profiles:parent_id(full_name)").order("created_at", { ascending: false }).limit(80),
    supabase.from("staff_job_applications" as any).select("id,status,created_at,gardens(name,city),staff_candidate_profiles:staff_candidate_id(full_name)").order("created_at", { ascending: false }).limit(80),
    supabase.from("inspector_applications" as any).select("id,status,created_at,full_name,city,duplicate_flags").order("created_at", { ascending: false }).limit(80),
    supabase.from("user_affiliation_requests" as any).select("id,status,request_type,target_type,created_at").order("created_at", { ascending: false }).limit(80),
    supabase.from("gardens" as any).select("id,name,city,approval_flow_status,created_at").in("approval_flow_status", ["activation_in_progress", "onboarding_submitted", "pending_final_approval", "correction_required", "payment_pending"]).order("created_at", { ascending: false }).limit(80)
  ]);
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
      <section className="grid cols-3">
        <article className="card action-panel">
          <h2><Baby size={18} /> בקשות הורים</h2>
          <div className="procedure-list compact">
            {parentRows.slice(0, 12).map((row) => <Link href="/dashboard/garden/enrollment-requests" key={row.id}><span className={statusTone(row.status)}>{row.status}</span><strong>{row.permanent_child_files?.full_name ?? "ילד/ה"}</strong><small>{row.gardens?.name ?? ""} · {row.payment_status}</small></Link>)}
          </div>
        </article>
        <article className="card action-panel">
          <h2><BriefcaseBusiness size={18} /> מועמדויות צוות</h2>
          <div className="procedure-list compact">
            {staffRows.slice(0, 12).map((row) => <Link href="/dashboard/garden/staff-applications" key={row.id}><span className={statusTone(row.status)}>{row.status}</span><strong>{row.staff_candidate_profiles?.full_name ?? "מועמד/ת"}</strong><small>{row.gardens?.name ?? ""}</small></Link>)}
          </div>
        </article>
        <article className="card action-panel">
          <h2><ClipboardCheck size={18} /> בקשות מפקחים</h2>
          <div className="procedure-list compact">
            {inspectorRows.slice(0, 12).map((row) => <Link href="/dashboard/admin/inspector-applications" key={row.id}><span className={statusTone(row.status)}>{row.status}</span><strong>{row.full_name}</strong><small>{row.city ?? ""}</small></Link>)}
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}
