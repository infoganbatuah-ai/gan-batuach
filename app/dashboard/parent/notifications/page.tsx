import { DashboardShell } from "@/components/dashboard-shell";
import { NotificationCenter } from "@/components/notification-center";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ParentNotificationsPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const { data } = await supabase.from("notifications" as any).select("*").or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id}`).order("created_at", { ascending: false }).limit(80);
  return (
    <DashboardShell role="parent" title="התראות">
      <div className="dashboard-hero-card parent-hero-card"><div><p className="eyebrow">Notifications</p><h1>כל העדכונים החשובים במקום אחד.</h1><p>יומן יומי, הודעות, איסוף, מסמכים, פיקוח והתראות בטיחות.</p></div><span className="pill good">מרכז הורים</span></div>
      <NotificationCenter notifications={(data ?? []) as any[]} />
    </DashboardShell>
  );
}
