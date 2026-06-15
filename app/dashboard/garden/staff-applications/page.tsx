import { BriefcaseBusiness, FileCheck2, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { RoleMetricCard } from "@/components/premium-dashboard";
import { ApplicationDecisionForm, StaffOpeningForm } from "@/components/self-service-forms";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const actions = [
  { value: "under_review", label: "סימון בבדיקה" },
  { value: "request_more_information", label: "בקשת מידע נוסף" },
  { value: "approve", label: "אישור והפעלת צוות" },
  { value: "reject", label: "דחייה" }
];

export default async function GardenStaffApplicationsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const rows = ((await supabase.from("staff_job_applications" as any)
    .select("*, kindergarten_staff_openings(role_needed,age_group,employment_type), staff_candidate_profiles:staff_candidate_id(full_name,phone,email,work_experience,document_status,duplicate_flags)")
    .eq("garden_id", profile.garden_id ?? "")
    .order("created_at", { ascending: false })
    .limit(100)).data ?? []) as any[];

  return (
    <DashboardShell role="manager" title="מועמדויות צוות">
      <section className="dashboard-hero-card manager-hero-card">
        <div>
          <p className="eyebrow">Staff Applications</p>
          <h1>מועמדי צוות שמבקשים להצטרף לגן.</h1>
          <p>מועמד לא רואה ילדים, הורים, מסמכים פנימיים או נתוני גן עד אישור מפורש שלך.</p>
        </div>
        <span className={rows.some((row) => row.status !== "approved") ? "pill warn" : "pill good"}>{rows.length} מועמדויות</span>
      </section>
      <section className="grid cols-4 dashboard-kpis">
        <RoleMetricCard label="כל המועמדויות" value={rows.length} />
        <RoleMetricCard label="בבדיקה" value={rows.filter((row) => ["submitted", "under_review"].includes(row.status)).length} tone="warn" />
        <RoleMetricCard label="אושרו" value={rows.filter((row) => row.status === "approved").length} tone="good" />
        <RoleMetricCard label="כפילות אפשרית" value={rows.filter((row) => Array.isArray(row.duplicate_flags) && row.duplicate_flags.length).length} tone="warn" />
      </section>
      <StaffOpeningForm />
      <section className="procedure-list">
        {rows.map((row) => (
          <article className="card procedure-card" key={row.id}>
            <div>
              <span className={row.status === "approved" ? "pill good" : row.status === "rejected" ? "pill bad" : "pill warn"}>{row.status}</span>
              <h3>{row.staff_candidate_profiles?.full_name ?? "מועמד/ת"}</h3>
              <p>{row.staff_candidate_profiles?.phone ?? ""} · {row.requested_role ?? row.kindergarten_staff_openings?.role_needed ?? "צוות"}</p>
              <small>{row.staff_candidate_profiles?.work_experience ?? "לא נוסף ניסיון"} · מסמכים: {Object.keys(row.staff_candidate_profiles?.document_status ?? {}).length}</small>
              {Array.isArray(row.duplicate_flags) && row.duplicate_flags.length ? <span className="pill warn">כפילות אפשרית לבדיקה</span> : null}
            </div>
            <div className="procedure-meta">
              <FileCheck2 />
              <ApplicationDecisionForm endpoint={`/api/garden/staff-applications/${row.id}`} actions={actions} />
            </div>
          </article>
        ))}
        {rows.length === 0 ? <div className="empty-state"><UsersRound /><strong>אין מועמדויות צוות</strong><span>פתחו משרה ציבורית כדי שמועמדים יוכלו להגיש בקשה.</span></div> : null}
      </section>
      <section className="manager-report-row"><span><BriefcaseBusiness /> מועמדות עצמאית אינה פותחת גישה עד אישור מנהלת.</span></section>
    </DashboardShell>
  );
}
