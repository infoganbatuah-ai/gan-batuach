import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { ServiceCharterEditor } from "@/components/service-charter-editor";
import { PremiumDashboardHero } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminServiceCharterPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_charters" as any)
    .select("*")
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <DashboardShell role="admin" title="אמנת השירות">
      <PremiumDashboardHero
        eyebrow="Service Charter"
        title="אמנת השירות של גן בטוח"
        subtitle="המסמך שמנהלת הגן מאשרת לפני שליחת הרישום והפעלת הגן."
        badge={data?.version ?? "טיוטה"}
        actions={<Link className="button secondary" href="/service-charter">צפייה ציבורית</Link>}
      />
      <ServiceCharterEditor charter={data as any} />
    </DashboardShell>
  );
}
