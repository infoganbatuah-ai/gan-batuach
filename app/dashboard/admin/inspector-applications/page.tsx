import { ClipboardCheck, MapPin, ShieldCheck } from "lucide-react";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { AdminDataError } from "@/components/admin-data-state";
import { RoleMetricCard } from "@/components/premium-dashboard";
import { ApplicationDecisionForm } from "@/components/self-service-forms";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

function formatStatus(status?: string | null) {
  const map: Record<string, string> = {
    submitted: "הוגש",
    under_review: "נבדק",
    approve_pending_assignment: "ממתין לשיוך",
    approved_pending_assignment: "ממתין לשיוך",
    request_more_information: "נדרשת השלמה",
    approved: "מאושר",
    rejected: "נדחה",
    suspended: "מושהה"
  };
  return map[status ?? ""] ?? status ?? "-";
}

const actions = [
  { value: "under_review", label: "סימון בבדיקה" },
  { value: "request_more_information", label: "בקשת מידע נוסף" },
  { value: "approve", label: "אישור והפעלת מפקח" },
  { value: "reject", label: "דחייה" },
  { value: "suspend", label: "השעיה" }
];

export default async function AdminInspectorApplicationsPage() {
  const { profile } = await requireRole(["admin"]);
  const result = await safeAdminData("admin inspector applications overview", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("inspector_applications" as any).select("*, profiles(full_name,phone,email,active)").order("created_at", { ascending: false }).limit(150);
    logSupabaseError("admin inspector applications overview", error);
    return { rows: error ? [] : data ?? [], available: !error };
  }, { rows: [], available: false });
  const rows = result.data.rows as any[];
  const available = result.data.available;

  return (
    <AdminAppFrame profile={profile} activeHref="/dashboard/admin/kindergarten-applications" title="אישורי מפקחים" subtitle="אישור מועמדות והמשך לשיוך נפרד ומפורש." badge={available ? `${rows.length} בקשות` : "נתונים לא זמינים"}>
      <AdminDataError message={result.error ?? (!available ? "לא ניתן לטעון את הנתונים כרגע" : null)} />
      <section className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">בקשות מפקחים</p>
          <h1>אישור מועמדים למערך המפקחים.</h1>
          <p>מועמד מפקח לא רואה גנים עד אישור אדמין ושיוך מפורש. אישור מועמדות אינו שיוך לגן.</p>
        </div>
        {available ? <span className={rows.some((row) => row.status !== "approved") ? "pill warn" : "pill good"}>{rows.length} בקשות</span> : <span className="pill" role="status">נתוני הבקשות אינם זמינים</span>}
      </section>
      <section className="grid cols-4 dashboard-kpis">
        <RoleMetricCard label="בקשות" value={available ? rows.length : "לא זמין"} />
        <RoleMetricCard label="בבדיקה" value={available ? rows.filter((row) => ["submitted", "under_review"].includes(row.status)).length : "לא זמין"} tone={available ? "warn" : "default"} />
        <RoleMetricCard label="ממתין לשיוך" value={available ? rows.filter((row) => row.status === "approved_pending_assignment").length : "לא זמין"} tone={available ? "warn" : "default"} />
        <RoleMetricCard label="אושרו" value={available ? rows.filter((row) => row.status === "approved").length : "לא זמין"} tone={available ? "good" : "default"} />
      </section>
      {available ? <section className="procedure-list">
        {rows.map((row) => (
          <article className="card procedure-card" key={row.id}>
            <div>
              <span className={row.status === "approved" ? "pill good" : row.status === "rejected" ? "pill bad" : "pill warn"}>{formatStatus(row.status)}</span>
              <h3>{row.full_name}</h3>
              <p>{row.phone ?? ""} · {row.email ?? ""} · {row.city ?? ""}</p>
              <small><MapPin size={13} /> {(row.preferred_regions ?? []).join(", ") || "לא נבחרו אזורים"}</small>
              <p>{row.experience_summary ?? "לא נוסף ניסיון מקצועי."}</p>
              {Array.isArray(row.duplicate_flags) && row.duplicate_flags.length ? <span className="pill warn">כפילות אפשרית לבדיקה</span> : null}
            </div>
            <div className="procedure-meta">
              <ShieldCheck />
              <ApplicationDecisionForm endpoint={`/api/admin/inspector-applications/${row.id}`} actions={actions} />
            </div>
          </article>
        ))}
        {rows.length === 0 ? <div className="empty-state"><ClipboardCheck /><strong>אין בקשות מפקחים</strong><span>כאשר מועמד יגיש בקשה, היא תופיע כאן.</span></div> : null}
      </section> : <section className="card" role="status" aria-label="נתוני בקשות מפקחים לא זמינים">נתוני בקשות המפקחים אינם זמינים</section>}
    </AdminAppFrame>
  );
}
