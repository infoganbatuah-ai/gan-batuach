import { DashboardShell } from "@/components/dashboard-shell";
import { NotificationCenter } from "@/components/notification-center";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenNotificationsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications" as any)
    .select("*")
    .or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id},garden_id.eq.${profile.garden_id},kindergarten_id.eq.${profile.garden_id}`)
    .order("created_at", { ascending: false })
    .limit(120);
  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="התראות גן">
      <div className="dashboard-hero-card garden-hero-card"><div><p className="eyebrow">מה דורש טיפול?</p><h1>מרכז ההתראות של הגן.</h1><p>לידים, אישורי ילדים, פניות הורים, תשלומים, מסמכים, פיקוח, מצלמות ואירועים.</p></div><span className="pill warn">גן</span></div>
      <NotificationCenter notifications={(data ?? []) as any[]} />
    </DashboardShell>
  );
}
