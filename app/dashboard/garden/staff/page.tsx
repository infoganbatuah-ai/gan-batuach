import { DashboardShell } from "@/components/dashboard-shell";
import { StaffProfileCards } from "@/components/people-profile-cards";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenStaffPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const today = new Date().toISOString().slice(0, 10);
  const [staffRes, docsRes, tasksRes, shiftsRes, certsRes] = await Promise.all([
    supabase.from("staff" as any).select("id, profile_id, full_name, role_title, phone, email, approved_to_work, background_check_status, police_clearance_status, class_group, profile_photo_url, manager_approved_at, inspector_verified_at, created_at").eq("garden_id", gardenId).order("full_name"),
    supabase.from("documents" as any).select("staff_id, id, status").eq("garden_id", gardenId),
    supabase.from("tasks" as any).select("assigned_to, id, status").eq("garden_id", gardenId).neq("status", "done"),
    supabase.from("staff_shifts" as any).select("staff_id, clock_in_at, clock_out_at, shift_date").eq("garden_id", gardenId).eq("shift_date", today),
    supabase.from("staff_certificates" as any).select("staff_id, id").eq("garden_id", gardenId)
  ]);
  const countBy = (rows: any[], key: string, predicate = (_row: any) => true) => rows.reduce((map, row) => predicate(row) ? map.set(row[key], (map.get(row[key]) ?? 0) + 1) : map, new Map<string, number>());
  const missingDocs = countBy((docsRes.data ?? []) as any[], "staff_id", (row) => ["missing", "expired", "rejected"].includes(row.status));
  const certs = countBy((certsRes.data ?? []) as any[], "staff_id");
  const tasks = countBy((tasksRes.data ?? []) as any[], "assigned_to");
  const shifts = new Map(((shiftsRes.data ?? []) as any[]).map((row) => [row.staff_id, row]));
  const rows = ((staffRes.data ?? []) as any[]).map((member) => {
    const missing = missingDocs.get(member.id) ?? 0;
    const compliance = Math.max(0, 100 - missing * 25 - (member.approved_to_work ? 0 : 35) - (member.background_check_status === "valid" ? 0 : 20) - (member.police_clearance_status === "valid" ? 0 : 20));
    const shift = shifts.get(member.id) as any;
    return { ...member, approval_status: member.approved_to_work ? "active" : "pending", missing_documents: missing, certificate_count: certs.get(member.id) ?? 0, task_count: tasks.get(member.profile_id) ?? 0, compliance_score: compliance, shift_today: shift?.clock_in_at ? `נכנס/ה ${new Date(shift.clock_in_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` : null };
  });

  return (
    <DashboardShell role="manager" title="צוות">
      <div className="dashboard-hero-card garden-hero-card"><div><p className="eyebrow">Staff Compliance</p><h1>ניהול צוות ברמת פרופיל.</h1><p>תפקיד, תעודות, משמרת, מסמכים, בדיקות רקע, משימות ואישור עבודה בכרטיס אחד.</p></div><span className="pill good">{rows.length} אנשי צוות</span></div>
      <div className="grid cols-4 dashboard-kpis"><StatCard label="מאושרים לעבודה" value={rows.filter((row) => row.approved_to_work).length} tone="good" /><StatCard label="ממתינים לאישור" value={rows.filter((row) => !row.approved_to_work).length} tone="warn" /><StatCard label="מסמכים חסרים" value={rows.reduce((sum, row) => sum + Number(row.missing_documents), 0)} tone="bad" /><StatCard label="ממוצע ציות" value={`${Math.round(rows.reduce((sum, row) => sum + Number(row.compliance_score), 0) / Math.max(rows.length, 1))}%`} tone="good" /></div>
      <StaffProfileCards staff={rows} />
    </DashboardShell>
  );
}
