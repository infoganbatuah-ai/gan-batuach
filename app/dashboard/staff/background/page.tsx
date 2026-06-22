import { ShieldCheck, ShieldAlert, FileCheck2 } from "lucide-react";
import { ListRowCard, StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffEmpty, StaffMetricCard, StaffPageHero, StaffSection, StaffStats } from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const staffRes = await supabase.from("staff" as any).select("id, full_name, approved_to_work, police_clearance_status, background_check_status, role, created_at").eq("profile_id", profile.id).maybeSingle();
  const staff = staffRes.data as any;
  const docsRes = staff?.id ? await supabase.from("documents" as any).select("id, name, document_type, status, expires_at, file_url").eq("staff_id", staff.id).in("document_type", ["sexual_offense_clearance", "criminal_clearance", "police_clearance", "background_check"]).limit(20) : { data: [] };
  const docs = (docsRes.data ?? []) as any[];
  return (
    <StaffAppFrame active="profile">
      <StaffPageHero
        eyebrow="אישור עבודה"
        title="תעודת יושר ובדיקות רקע"
        text="העובד מאושר כפעיל רק לאחר העלאת מסמכי חובה ובדיקת מנהלת."
        icon={ShieldCheck}
        badge={<StatusChip tone={staff?.approved_to_work ? "success" : "warning"}>{staff?.approved_to_work ? "מאושר/ת" : "ממתין לאישור"}</StatusChip>}
      />
      <StaffStats>
        <StaffMetricCard title="היעדר עבירות" value={staff?.police_clearance_status ?? "חסר"} icon={ShieldAlert} tone={staff?.police_clearance_status === "approved" ? "green" : "orange"} />
        <StaffMetricCard title="בדיקת רקע" value={staff?.background_check_status ?? "חסר"} icon={FileCheck2} tone={staff?.background_check_status === "approved" ? "green" : "orange"} />
        <StaffMetricCard title="אישור מנהלת" value={staff?.approved_to_work ? "פעיל" : "ממתין"} icon={ShieldCheck} tone={staff?.approved_to_work ? "green" : "orange"} />
      </StaffStats>
      <StaffSection title="מסמכי רקע">
        {docs.length === 0 ? (
          <StaffEmpty title="לא נמצאו מסמכי רקע" text="כאשר יועלו תעודות ובדיקות רקע, הסטטוס והקבצים יוצגו כאן." icon={FileCheck2} />
        ) : (
          <div className="staff-task-list-ref">
            {docs.map((doc) => (
              <ListRowCard
                key={doc.id}
                title={doc.name}
                subtitle={doc.document_type}
                meta={doc.expires_at ? `תוקף: ${new Date(doc.expires_at).toLocaleDateString("he-IL")}` : "ללא תאריך תפוגה"}
                status={<StatusChip tone={doc.status === "approved" ? "success" : "warning"}>{doc.status}</StatusChip>}
                href={doc.file_url ?? undefined}
              />
            ))}
          </div>
        )}
      </StaffSection>
    </StaffAppFrame>
  );
}
