import { DashboardShell } from "@/components/dashboard-shell";
import { ModuleListPage } from "@/components/module-list-page";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenParentsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const { data } = await supabase.from("parents" as any).select("id, full_name, phone, email, status, created_at").eq("garden_id", profile.garden_id ?? "").order("created_at", { ascending: false });
  return <DashboardShell role="manager" title="הורים"><ModuleListPage title="ניהול הורים ואנשי קשר" eyebrow="Parents" description="רשימת הורים, סטטוס משתמש, פרטי קשר ושיוך לגן." rows={(data ?? []) as any[]} emptyTitle="אין הורים להצגה" emptyText="הוסיפו הורה דרך קליטה כדי לפתוח משתמש ולאפשר רישום ילד." primaryAction={{ href: "/dashboard/garden/onboarding", label: "הוספת הורה" }} /></DashboardShell>;
}
