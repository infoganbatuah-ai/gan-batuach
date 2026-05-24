import { DashboardShell } from "@/components/dashboard-shell";
import { ModuleListPage } from "@/components/module-list-page";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenStaffPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const { data } = await supabase.from("staff" as any).select("id, full_name, role_title, phone, email, approved_to_work, background_check_status, police_clearance_status, created_at").eq("garden_id", profile.garden_id ?? "").order("created_at", { ascending: false });
  const rows = (data ?? []).map((row: any) => ({ ...row, status: row.approved_to_work ? "מאושר" : "ממתין", title: row.full_name, description: `${row.role_title ?? "צוות"} · רקע ${row.background_check_status ?? "missing"} · יושר ${row.police_clearance_status ?? "missing"}` }));
  return <DashboardShell role="manager" title="צוות"><ModuleListPage title="ניהול צוות ואישורי עבודה" eyebrow="Staff" description="אנשי צוות, תפקיד, תעודת יושר, בדיקת רקע, תוקף ואישור מנהלת/פקח." rows={rows} emptyTitle="אין אנשי צוות להצגה" emptyText="הוסיפו איש צוות דרך קליטה. עובד לא אמור להיות פעיל בלי מסמכי חובה." primaryAction={{ href: "/dashboard/garden/onboarding", label: "הוספת צוות" }} /></DashboardShell>;
}
