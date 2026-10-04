import { DashboardShell } from "@/components/dashboard-shell";
import { ReportsCenter } from "@/components/reports-center";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";

export default async function ParentReportsPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase, profile);
  const children = Array.from(new Map([
    ...family.children.map((child: { id: string; full_name?: string | null }) => [child.id, { id: child.id, label: child.full_name ?? "ילד/ה" }] as const),
    ...family.enrollments.filter((enrollment: { child_id?: string | null }) => enrollment.child_id).map((enrollment: { child_id: string; full_name?: string | null }) => [enrollment.child_id, { id: enrollment.child_id, label: enrollment.full_name ?? "ילד/ה" }] as const)
  ]).values());
  const gardens = family.gardens.map((garden: { id: string; name?: string | null }) => ({ id: garden.id, label: garden.name ?? "גן" }));
  return (
    <DashboardShell role="parent" title="הדוחות שלי" appHome>
      <div className="page-header">
        <div><h1>הדוחות שלי</h1><p>סיכומים רק עבור הילדים שהקשר ההורי אליהם פעיל ומורשה.</p></div>
      </div>
      <ReportsCenter role="parent" gardenId={profile.garden_id ?? family.gardenIds[0] ?? null} gardens={gardens} childOptions={children} />
    </DashboardShell>
  );
}
