import { BadgeCheck, FileCheck2 } from "lucide-react";
import { ListRowCard, StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffEmpty, StaffMetricCard, StaffPageHero, StaffSection, StaffStats } from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const staffRes = await supabase.from("staff" as any).select("id, full_name").eq("profile_id", profile.id).maybeSingle();
  const staff = staffRes.data as any;
  const certsRes = staff?.id ? await supabase.from("staff_certificates" as any).select("id, certificate_type, file_url, issued_at, expires_at, status, created_at").eq("staff_id", staff.id).order("expires_at", { ascending: true }).limit(50) : { data: [] };
  const rows = (certsRes.data ?? []) as any[];
  const expiring = rows.filter((row) => row.expires_at && new Date(row.expires_at).getTime() < Date.now() + 30 * 86400000).length;
  return (
    <StaffAppFrame active="profile">
      <StaffPageHero
        eyebrow="מסמכי עובד"
        title="תעודות, הכשרות ותוקף מסמכים"
        text="כאן מופיעות תעודות חובה, הכשרות ותאריכי תפוגה. מסמך חסר או שפג תוקפו דורש טיפול."
        icon={BadgeCheck}
        badge={<StatusChip tone={expiring ? "warning" : "success"}>{expiring ? `${expiring} עומדים לפוג` : "תקין"}</StatusChip>}
      />
      <StaffStats>
        <StaffMetricCard title="תעודות" value={rows.length} icon={FileCheck2} tone="purple" />
        <StaffMetricCard title="בתוקף" value={rows.filter((row) => row.status === "valid" || row.status === "approved").length} icon={BadgeCheck} tone="green" />
        <StaffMetricCard title="דורש טיפול" value={expiring} icon={BadgeCheck} tone={expiring ? "orange" : "green"} />
      </StaffStats>
      <StaffSection title="רשימת תעודות">
        {rows.length === 0 ? (
          <StaffEmpty title="אין תעודות במערכת" text="לאחר אישור התעודות הן יוצגו כאן." icon={FileCheck2} />
        ) : (
          <div className="staff-task-list-ref">
            {rows.map((row) => (
              <ListRowCard
                key={row.id}
                title={row.certificate_type}
                subtitle={row.issued_at ? `הונפק: ${new Date(row.issued_at).toLocaleDateString("he-IL")}` : "תאריך הנפקה לא צוין"}
                meta={row.expires_at ? `תוקף: ${new Date(row.expires_at).toLocaleDateString("he-IL")}` : "ללא תוקף"}
                status={<StatusChip tone={row.status === "valid" || row.status === "approved" ? "success" : row.status === "rejected" ? "danger" : "warning"}>{row.status}</StatusChip>}
                actions={<small className="gateway-setup-state">קובץ מאובטח</small>}
              />
            ))}
          </div>
        )}
      </StaffSection>
    </StaffAppFrame>
  );
}
