import { FileCheck2 } from "lucide-react";
import { StaffDocumentUpload } from "@/components/staff-document-upload";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffPageHero, StaffSection } from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { resolveStaffEmploymentContext } from "@/lib/management/staff-employment-context";
import { createClient } from "@/lib/supabase/server";

export default async function StaffDocumentsPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const context = await resolveStaffEmploymentContext(profile);
  const employment = context.available ? context.activeEmployment : null;
  const authority = employment ? await supabase.rpc("can_staff_access_garden", { target_garden_id: employment.garden_id }) : null;
  const staffId = authority?.data === true ? employment!.staff_id : null;
  const gardenId = authority?.data === true ? employment!.garden_id : null;
  if (!staffId || !gardenId) return (
    <StaffAppFrame mode="candidate" active="profile">
      <StaffPageHero eyebrow="מסמכי מועמדות" title="מסמכים ותעודות" text="מסמכי מועמדות מוגשים כחלק מתהליך הקליטה. מסמכי עבודה לפי גן נפתחים רק לאחר הפעלת העסקה." icon={FileCheck2} />
      <StaffSection title="תהליך הקליטה"><a className="button secondary" href="/onboarding/staff">המשך קליטה</a></StaffSection>
    </StaffAppFrame>
  );
  const { data } = await supabase.from("documents" as any).select("id, name, document_type, status, expires_at, created_at, file_url")
    .eq("staff_id", staffId).eq("garden_id", gardenId).order("created_at", { ascending: false });
  return (
    <StaffAppFrame active="profile">
      <StaffPageHero eyebrow="מסמכי עובד" title="מסמכי עובד ותעודות" text="העלאת תעודת יושר, בדיקת רקע, הכשרות, עזרה ראשונה ותוקף מסמכים." icon={FileCheck2} badge={<StatusChip tone="success">בדיקה ואישור</StatusChip>} />
      <StaffSection title="העלאה וניהול מסמכים">
        <StaffDocumentUpload gardenId={gardenId} staffId={staffId} documents={(data ?? []) as any[]} />
      </StaffSection>
    </StaffAppFrame>
  );
}
