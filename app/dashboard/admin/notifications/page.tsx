import { BellRing } from "lucide-react";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { NotificationCenter } from "@/components/notification-center";
import { PremiumCard, SectionHeader, StatusChip } from "@/components/gan-batuach-design-system";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function AdminNotificationsPage() {
  const { profile } = await requireRole(["admin"]);
  const result = await safeAdminData("התראות", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("notifications" as any).select("*").order("created_at", { ascending: false }).limit(150);
    logSupabaseError("התראות", error);
    return { rows: (data ?? []) as any[] };
  }, { rows: [] as any[] });
  return (
    <AdminAppFrame profile={profile} activeHref="/dashboard/admin/notifications" title="מרכז התראות" subtitle="פיקוח, מסמכים, מצלמות, AI, הודעות, משימות ואישורי רישום." badge="התראות">
      <PremiumCard size="lg" className="admin-section-card">
        <SectionHeader eyebrow="Notification Center" title="כל התראות המערכת במקום אחד" subtitle="כל התראה צריכה מקור, הקשר, חומרה ופעולת המשך ברורה." icon={BellRing} />
        <StatusChip tone="warning">Control Center</StatusChip>
      </PremiumCard>
      <NotificationCenter notifications={result.data.rows} />
    </AdminAppFrame>
  );
}
