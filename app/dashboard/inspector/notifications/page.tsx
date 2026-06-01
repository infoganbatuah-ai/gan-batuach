import { DashboardShell } from "@/components/dashboard-shell";
import { NotificationCenter } from "@/components/notification-center";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function InspectorNotificationsPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications" as any)
    .select("*")
    .or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id}`)
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <DashboardShell role="inspector" title="התראות מפקח">
      <div className="dashboard-hero-card inspector-hero-card"><div><p className="eyebrow">Inspection Alerts</p><h1>פיקוחים, ליקויים ואירועים שדורשים פעולה.</h1><p>התראות לפי גנים משויכים בלבד: פיקוח קרוב, איחורים, ליקויים, מצלמות ואירועי גן.</p></div><span className="pill warn">פיקוח</span></div>
      <NotificationCenter notifications={(data ?? []) as any[]} />
    </DashboardShell>
  );
}
