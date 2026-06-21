import { Baby, Send, UserRoundPlus, UsersRound } from "lucide-react";
import { GardenProvisioningPanel } from "@/components/provisioning-forms";
import {
  TeacherAppFrame,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherActionTile,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenOnboardingPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [children, leads, staff] = await Promise.all([
    supabase.from("children").select("id, full_name, status, created_at").eq("garden_id", gardenId).eq("status", "pending_manager_approval").order("created_at", { ascending: false }),
    supabase.from("leads").select("id, parent_name, phone, email, child_name, child_age, status").eq("garden_id", gardenId).eq("lead_type", "parent").in("status", ["new", "new_parent_lead", "request_more_details"]).order("created_at", { ascending: false }),
    supabase.from("staff").select("id, full_name, role_title, background_check_status, police_clearance_status, approved_to_work").eq("garden_id", gardenId).eq("approved_to_work", false).order("created_at", { ascending: false })
  ]);
  const pendingChildren = (children.data ?? []) as any[];
  const parentLeads = (leads.data ?? []) as any[];
  const pendingStaff = (staff.data ?? []) as any[];

  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "רונית"}`} subtitle="קליטת משתמשים לגן" avatarUrl={(profile as any).avatar_url ?? null} active="children">
      <TeacherPageTitle icon={UserRoundPlus} title="קליטת משתמשים" subtitle="הורים, ילדים וצוות נכנסים בתהליך ברור ומבוקר" />
      <TeacherStatsGrid>
        <TeacherStatCard title="ילדים ממתינים" value={pendingChildren.length} hint="לאישור מנהלת" icon={Baby} tone="purple" />
        <TeacherStatCard title="לידים הורים" value={parentLeads.length} hint="דורשים טיפול" icon={Send} tone="blue" />
        <TeacherStatCard title="צוות ממתין" value={pendingStaff.length} hint="השלמה/אישור" icon={UsersRound} tone="orange" />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות קליטה">
        <TeacherActionTile title="בקשות הורים" href="/dashboard/garden/leads" icon={Send} tone="purple" />
        <TeacherActionTile title="הוספת ילד" href="/dashboard/garden/children?new=1#new-child" icon={Baby} tone="blue" />
        <TeacherActionTile title="צוות" href="/dashboard/garden/staff-applications" icon={UsersRound} tone="orange" />
      </TeacherQuickActions>
      <TeacherSection title="מרכז קליטה" subtitle="הפאנל הקיים נשמר, רק בתוך חוויית הגננת החדשה">
        <div className="teacher-embedded-module">
          <GardenProvisioningPanel pendingChildren={pendingChildren as any} parentLeads={parentLeads as any} pendingStaff={pendingStaff as any} />
        </div>
      </TeacherSection>
    </TeacherAppFrame>
  );
}
