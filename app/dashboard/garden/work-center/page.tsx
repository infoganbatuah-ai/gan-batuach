import { DashboardShell } from "@/components/dashboard-shell";
import { TeacherAppFrame } from "@/components/teacher-app-ui";
import { WorkOperationsOverview } from "@/components/work-operations-overview";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";

type StatusRow = { status: string; due_at?: string | null };
type ProfileWithImage = { profile_image_url?: string | null };

export default async function GardenWorkCenterPage() {
  const { profile } = await requireOperationalRole(["manager", "owner"]);
  const supabase = await createClient();
  const [tasksRes, complaintsRes, correctiveRes] = await Promise.all([
    supabase.from("tasks" as never).select("id,status,due_at").eq("garden_id", profile.garden_id ?? "").limit(500),
    supabase.from("complaints" as never).select("id,status").eq("garden_id", profile.garden_id ?? "").limit(500),
    supabase.from("violations" as never).select("id,status").eq("garden_id", profile.garden_id ?? "").limit(500)
  ]);
  const tasks = (tasksRes.data ?? []) as unknown as StatusRow[];
  const complaints = (complaintsRes.data ?? []) as unknown as StatusRow[];
  const correctives = (correctiveRes.data ?? []) as unknown as StatusRow[];
  return <DashboardShell role="manager" title="מרכז עבודה" appHome>
    <TeacherAppFrame title="מרכז עבודה" subtitle="תמונה תפעולית" avatarUrl={(profile as ProfileWithImage).profile_image_url ?? null} active="more">
      <WorkOperationsOverview
        taskCounts={{ open: tasks.filter((row) => !["done", "completed", "cancelled"].includes(row.status)).length, overdue: tasks.filter((row) => row.status === "overdue").length, completed: tasks.filter((row) => ["done", "completed"].includes(row.status)).length }}
        complaintCounts={{ open: complaints.filter((row) => !["resolved", "closed"].includes(row.status)).length, escalated: complaints.filter((row) => row.status === "escalated").length, resolved: complaints.filter((row) => ["resolved", "closed"].includes(row.status)).length }}
        correctiveCounts={{ open: correctives.filter((row) => row.status !== "done").length, review: correctives.filter((row) => row.status === "waiting_approval").length, verified: correctives.filter((row) => row.status === "done").length }}
      />
    </TeacherAppFrame>
  </DashboardShell>;
}
