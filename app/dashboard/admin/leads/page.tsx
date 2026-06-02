import { DashboardShell } from "@/components/dashboard-shell";
import { AdminLeadsManager } from "@/components/admin-leads-manager";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { AdminDataError } from "@/components/admin-data-state";

export default async function AdminLeadsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin leads", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("leads" as any)
      .select("id, lead_type, parent_name, garden_name, owner_name, manager_name, city, address, phone, email, age_groups, capacity, children_count, staff_count, experience, certifications, notes, status")
      .order("created_at", { ascending: false })
      .limit(100);
    logSupabaseError("admin leads", error);
    return { rows: (data ?? []) as any[], queryError: error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { rows: [] as any[], queryError: null as string | null });

  return (
    <DashboardShell role="admin" title="לידים והמרות">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">מאגר לקוחות</p>
          <h1>לידים מגנים, מפקחים והורים עם המרה למשתמש פעיל.</h1>
          <p>גן או מפקח שאושרו יכולים להפוך מכאן לרשומת מערכת פעילה עם משתמש Supabase Auth, פרופיל והרשאות.</p>
        </div>
        <span className="pill good">new / contacted / approved / rejected</span>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} /><AdminLeadsManager leads={result.data.rows} />
    </DashboardShell>
  );
}
