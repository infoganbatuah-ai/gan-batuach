import { ClipboardCheck, MapPin, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { RoleMetricCard } from "@/components/premium-dashboard";
import { ApplicationDecisionForm } from "@/components/self-service-forms";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const actions = [
  { value: "under_review", label: "סימון בבדיקה" },
  { value: "request_more_information", label: "בקשת מידע נוסף" },
  { value: "approve_pending_assignment", label: "אישור ממתין לשיוך" },
  { value: "approve", label: "אישור והפעלת מפקח" },
  { value: "reject", label: "דחייה" },
  { value: "suspend", label: "השעיה" }
];

export default async function AdminInspectorApplicationsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const rows = ((await supabase.from("inspector_applications" as any).select("*, profiles(full_name,phone,email,active)").order("created_at", { ascending: false }).limit(150)).data ?? []) as any[];

  return (
    <DashboardShell role="admin" title="בקשות מפקחים">
      <section className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Inspector Applications</p>
          <h1>אישור מועמדים למערך המפקחים.</h1>
          <p>מועמד מפקח לא רואה גנים עד אישור אדמין ושיוך מפורש.</p>
        </div>
        <span className={rows.some((row) => row.status !== "approved") ? "pill warn" : "pill good"}>{rows.length} בקשות</span>
      </section>
      <section className="grid cols-4 dashboard-kpis">
        <RoleMetricCard label="בקשות" value={rows.length} />
        <RoleMetricCard label="בבדיקה" value={rows.filter((row) => ["submitted", "under_review"].includes(row.status)).length} tone="warn" />
        <RoleMetricCard label="ממתין לשיוך" value={rows.filter((row) => row.status === "approved_pending_assignment").length} tone="warn" />
        <RoleMetricCard label="אושרו" value={rows.filter((row) => row.status === "approved").length} tone="good" />
      </section>
      <section className="procedure-list">
        {rows.map((row) => (
          <article className="card procedure-card" key={row.id}>
            <div>
              <span className={row.status === "approved" ? "pill good" : row.status === "rejected" ? "pill bad" : "pill warn"}>{row.status}</span>
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
      </section>
    </DashboardShell>
  );
}
