import { UserRoundPlus } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { GardenProvisioningPanel } from "@/components/provisioning-forms";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenOnboardingPage() {
  const { profile } = await requireRole(["manager"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [children, leads, staff] = await Promise.all([
    supabase.from("children").select("id, full_name, status, created_at").eq("garden_id", gardenId).eq("status", "pending_manager_approval").order("created_at", { ascending: false }),
    supabase.from("leads").select("id, parent_name, phone, email, child_name, child_age, status").eq("garden_id", gardenId).eq("lead_type", "parent").in("status", ["new", "new_parent_lead", "request_more_details"]).order("created_at", { ascending: false }),
    supabase.from("staff").select("id, full_name, role_title, background_check_status, police_clearance_status, approved_to_work").eq("garden_id", gardenId).eq("approved_to_work", false).order("created_at", { ascending: false })
  ]);

  return (
    <DashboardShell role="manager" title="קליטת משתמשים">
      <div className="dashboard-hero-card garden-hero-card">
        <div>
          <p className="eyebrow">קליטה לגן</p>
          <h1>הורים, ילדים וצוות נכנסים למערכת בתהליך ברור ומבוקר.</h1>
          <p>כל משתמש נוצר ב־Supabase Auth וב־profiles, וכל אישור נשמר בלוג ביקורת.</p>
        </div>
        <span className="pill good"><UserRoundPlus size={15} /> תהליך מאושר</span>
      </div>
      <GardenProvisioningPanel pendingChildren={(children.data ?? []) as any} parentLeads={(leads.data ?? []) as any} pendingStaff={(staff.data ?? []) as any} />
    </DashboardShell>
  );
}
