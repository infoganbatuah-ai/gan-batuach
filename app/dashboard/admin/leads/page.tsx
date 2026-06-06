import { DashboardShell } from "@/components/dashboard-shell";
import { AdminLeadsManager } from "@/components/admin-leads-manager";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { AdminDataError } from "@/components/admin-data-state";
import { PremiumDashboardHero } from "@/components/premium-dashboard";

export default async function AdminLeadsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin leads", async () => {
    const supabase = await createClient();
    const [{ data, error }, gardensRes] = await Promise.all([
      supabase
      .from("leads" as any)
      .select("id, lead_type, parent_name, garden_name, owner_name, manager_name, city, address, phone, email, age_groups, capacity, children_count, staff_count, experience, certifications, notes, status")
      .order("created_at", { ascending: false })
      .limit(100),
      supabase
        .from("gardens" as any)
        .select("id, name, city, phone, email, manager_id, status, approval_flow_status, final_approval_status, admin_correction_note, profiles:manager_id(full_name, email)")
        .in("approval_flow_status", ["credentials_sent", "onboarding_in_progress", "onboarding_submitted", "pending_final_approval", "correction_required", "active", "suspended", "archived", "lead_approved_credentials_sent", "profile_incomplete", "pending_final_admin_approval"])
        .order("created_at", { ascending: false })
        .limit(200)
    ]);
    logSupabaseError("admin leads", error ?? gardensRes.error);
    return { rows: (data ?? []) as any[], gardens: (gardensRes.data ?? []) as any[], queryError: error || gardensRes.error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { rows: [] as any[], gardens: [] as any[], queryError: null as string | null });

  return (
    <DashboardShell role="admin" title="לידים והמרות">
      <PremiumDashboardHero eyebrow="קליטת גנים" title="בקשה, כניסה, פרופיל, אישור." subtitle="האדמין מאשר את הבקשה. המנהלת משלימה את פרופיל הגן." badge="זרימה חדשה" badgeTone="good" />
      <AdminDataError message={result.error ?? result.data.queryError} /><AdminLeadsManager leads={result.data.rows} gardens={result.data.gardens} />
    </DashboardShell>
  );
}
