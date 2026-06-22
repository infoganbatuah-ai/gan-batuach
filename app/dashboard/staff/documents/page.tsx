import { FileCheck2 } from "lucide-react";
import { StaffDocumentUpload } from "@/components/staff-document-upload";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffPageHero, StaffSection } from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffDocumentsPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const staffRes = await supabase.from("staff" as any).select("id").eq("profile_id", profile.id).maybeSingle();
  const staffId = (staffRes.data as any)?.id ?? "";
  const { data } = await supabase.from("documents" as any).select("id, name, document_type, status, expires_at, created_at, file_url").eq("staff_id", staffId).order("created_at", { ascending: false });
  return (
    <StaffAppFrame active="profile">
      <StaffPageHero eyebrow="מסמכי עובד" title="מסמכי עובד ותעודות" text="העלאת תעודת יושר, בדיקת רקע, הכשרות, עזרה ראשונה ותוקף מסמכים." icon={FileCheck2} badge={<StatusChip tone="success">בדיקה ואישור</StatusChip>} />
      <StaffSection title="העלאה וניהול מסמכים">
        <StaffDocumentUpload gardenId={profile.garden_id} staffId={staffId} documents={(data ?? []) as any[]} />
      </StaffSection>
    </StaffAppFrame>
  );
}
