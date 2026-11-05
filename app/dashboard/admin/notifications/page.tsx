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
    return { rows: (error ? [] : data ?? []) as any[], available: !error };
  }, { rows: [] as any[], available: false });
  return (
    <AdminAppFrame profile={profile} activeHref="/dashboard/admin/notifications" title="מרכז התראות" subtitle="פיקוח, מסמכים, מצלמות, AI, הודעות, משימות ואישורי רישום." badge="התראות">
      <PremiumCard size="lg" className="admin-section-card">
        <SectionHeader eyebrow="Notification Center" title="עד 150 ההתראות האחרונות, לפי הרשומות שנטענו" subtitle="כל התראה צריכה מקור, הקשר, חומרה ופעולת המשך ברורה." icon={BellRing} />
        <StatusChip tone="warning">Control Center</StatusChip>
      </PremiumCard>
      {result.data.available ? (
        <NotificationCenter notifications={result.data.rows} />
      ) : (
        <div className="card" role="status" aria-label="נתוני התראות לא זמינים">
          <h2>נתוני ההתראות אינם זמינים</h2>
          <p>{result.error ?? "לא ניתן לטעון את הנתונים כרגע"}</p>
          <p>לא ניתן לקבוע אילו התראות ממתינות לקריאה.</p>
        </div>
      )}
    </AdminAppFrame>
  );
}
