import { DashboardShell } from "@/components/dashboard-shell";
import { ModuleListPage } from "@/components/module-list-page";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenChildrenPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const { data } = await supabase.from("children" as any).select("id, full_name, birth_date, status, allergies, hmo, created_at").eq("garden_id", profile.garden_id ?? "").order("created_at", { ascending: false });
  const rows = (data ?? []).map((child: any) => ({ ...child, title: child.full_name, description: `${child.status} · ${child.hmo ?? "קופה חסרה"} · ${child.allergies ? "אלרגיות: " + child.allergies : "אין אלרגיות מתועדות"}` }));
  return <DashboardShell role="manager" title="ילדים"><ModuleListPage title="ילדים, כרטיסים ואישורי רישום" eyebrow="Children" description="רשימת תלמידים, סטטוס אישור, בריאות, אלרגיות וכרטיס ילד." rows={rows} emptyTitle="אין ילדים להצגה" emptyText="לאחר שהורה ישלים כרטיס ילד והמנהלת תאשר, הילדים יופיעו כאן." primaryAction={{ href: "/dashboard/garden/onboarding", label: "קליטת ילד/הורה" }} /></DashboardShell>;
}
