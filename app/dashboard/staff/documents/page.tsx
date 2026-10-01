import { DocumentsPlatform, type DocumentsPlatformRow } from "@/components/documents-platform";
import { StaffCandidateDocumentUpload } from "@/components/staff-candidate-document-upload";
import { RecruitmentHero, RecruitmentTabs } from "@/components/recruitment-ui";
import { StaffAppFrame } from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { effectiveDocumentStatus } from "@/lib/management/document-policy";
import { resolveStaffEmploymentContext } from "@/lib/management/staff-employment-context";
import { createClient } from "@/lib/supabase/server";

const documentFields = "id,garden_id,owner_type,owner_profile_id,staff_id,child_id,inspection_id,uploaded_by,name,document_type,status,expires_at,created_at,reviewed_at,rejection_reason,mime_type,byte_size,replaces_document_id,replaced_by,file_url,reminder_days_before,deleted_at";

export default async function StaffDocumentsPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const context = await resolveStaffEmploymentContext(profile);
  const employment = context.available ? context.activeEmployment : null;
  const authority = employment ? await supabase.rpc("can_staff_access_garden", { target_garden_id: employment.garden_id }) : null;
  const staffId = authority?.data === true ? employment!.staff_id : null;
  const gardenId = authority?.data === true ? employment!.garden_id : null;
  if (!staffId || !gardenId) return (
    <StaffAppFrame mode="candidate" active="documents" profileName={profile.full_name} avatarUrl={profile.profile_image_url}>
      <RecruitmentTabs active="documents" />
      <RecruitmentHero compact eyebrow="מסמכי מועמדות" title="מסמכים ותעודות" text="מסמכי מועמדות נשארים בתהליך הגיוס. מרכז מסמכי העבודה נפתח רק אחרי הפעלה קנונית של העסקה." />
      <StaffCandidateDocumentUpload />
    </StaffAppFrame>
  );

  const [documentsRes, gardenRes, staffRes] = await Promise.all([
    supabase.from("documents" as never).select(documentFields as never).eq("staff_id", staffId).eq("garden_id", gardenId).is("deleted_at", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("gardens" as never).select("id,name" as never).eq("id", gardenId).maybeSingle(),
    supabase.from("staff" as never).select("id,full_name" as never).eq("id", staffId).maybeSingle()
  ]);
  const gardenName = (gardenRes.data as unknown as { name?: string } | null)?.name ?? "הגן הפעיל";
  const staffName = (staffRes.data as unknown as { full_name?: string } | null)?.full_name ?? profile.full_name;
  const rows: DocumentsPlatformRow[] = ((documentsRes.data ?? []) as unknown as DocumentsPlatformRow[]).map((row) => ({
    ...row,
    effective_status: effectiveDocumentStatus(row),
    file_url: row.file_url === `/api/documents/${row.id}/file` ? row.file_url : null,
    garden_name: gardenName,
    context_name: staffName,
    can_review: false
  }));

  return (
    <StaffAppFrame active="documents" profileName={profile.full_name} avatarUrl={profile.profile_image_url}>
      <DocumentsPlatform
        title="המסמכים המקצועיים שלי"
        subtitle={`תעודות, הכשרות ומסמכי העסקה ב${gardenName}, עם תוקף וסטטוס אימות.`}
        rows={rows}
        uploadTargets={[{ id: `staff-${staffId}`, label: staffName, gardenId, ownerId: staffId, documentTypes: ["staff_document", "qualification", "training", "first_aid", "police_clearance", "background_check"] }]}
        roleLabel="צוות"
      />
    </StaffAppFrame>
  );
}
