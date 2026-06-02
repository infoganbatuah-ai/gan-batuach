import { DashboardShell } from "@/components/dashboard-shell";
import { NotificationCenter } from "@/components/notification-center";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffNotificationsPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications" as any)
    .select("*")
    .or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id}`)
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <DashboardShell role="staff" title="התראות צוות">
      <div className="dashboard-hero-card staff-hero-card"><div><p className="eyebrow">עדכוני צוות</p><h1>מה חדש במשמרת?</h1><p>משימות, הודעות מנהלת, ילדים שדורשים עדכון, מסמכים חסרים ואירועים שהוקצו.</p></div><span className="pill good">צוות</span></div>
      <NotificationCenter notifications={(data ?? []) as any[]} />
    </DashboardShell>
  );
}
