import { DashboardShell } from "@/components/dashboard-shell";
import { AdminLeadsManager } from "@/components/admin-leads-manager";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminJoinRequestsPage() {
  await requireRole(["admin"]);
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("leads")
    .select("id, lead_type, parent_name, garden_name, owner_name, manager_name, city, address, phone, email, age_groups, capacity, children_count, staff_count, experience, certifications, notes, status")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <DashboardShell role="admin" title="בקשות הצטרפות">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">מאגר לקוחות</p>
          <h1>לידים מגנים, מפקחים והורים עם המרה למשתמש פעיל.</h1>
          <p>גן או מפקח שאושרו יכולים להפוך מכאן לרשומת מערכת פעילה עם משתמש Supabase Auth, פרופיל והרשאות.</p>
        </div>
        <span className="pill good">new / contacted / approved / rejected</span>
      </div>
      <AdminLeadsManager leads={(data ?? []) as any[]} />
    </DashboardShell>
  );
}
