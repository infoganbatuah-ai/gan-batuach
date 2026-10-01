import { DocumentsPlatform, type DocumentsPlatformRow, type DocumentsUploadTarget } from "@/components/documents-platform";
import { InspectorAppFrame } from "@/components/inspector-app-ui";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { effectiveDocumentStatus } from "@/lib/management/document-policy";
import { createClient } from "@/lib/supabase/server";

const documentFields = "id,garden_id,owner_type,owner_profile_id,staff_id,child_id,inspection_id,uploaded_by,name,document_type,status,expires_at,created_at,reviewed_at,rejection_reason,mime_type,byte_size,replaces_document_id,replaced_by,file_url,reminder_days_before,deleted_at";

export default async function InspectorDocumentsPage() {
  const { profile } = await requireOperationalRole(["inspector"]);
  const supabase = await createClient();
  const [documentsRes, inspectionsRes, inspectorRes] = await Promise.all([
    supabase.from("documents" as never).select(documentFields as never).is("deleted_at", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("inspections" as never).select("id,garden_id,status,gardens(name)" as never).in("status", ["open", "in_progress"]).order("created_at", { ascending: false }).limit(50),
    supabase.from("inspectors" as never).select("profile_photo_url" as never).eq("id", profile.id).maybeSingle()
  ]);
  const inspections = (inspectionsRes.data ?? []) as unknown as Array<{ id: string; garden_id: string; gardens?: { name?: string | null } | null }>;
  const inspectionNames = new Map(inspections.map((inspection) => [inspection.id, inspection.gardens?.name ?? "ביקורת פעילה"]));
  const rows: DocumentsPlatformRow[] = ((documentsRes.data ?? []) as unknown as DocumentsPlatformRow[]).map((row) => ({
    ...row,
    effective_status: effectiveDocumentStatus(row),
    file_url: row.file_url === `/api/documents/${row.id}/file` ? row.file_url : null,
    garden_name: inspectionNames.get(row.inspection_id ?? "") ?? "גן משויך",
    context_name: row.owner_type === "inspection" ? `ראיית מסמך · ${inspectionNames.get(row.inspection_id ?? "") ?? "ביקורת"}` : "מסמך ציות מורשה",
    can_review: false
  }));
  const uploadTargets: DocumentsUploadTarget[] = inspections.map((inspection) => ({
    id: `inspection-${inspection.id}`,
    label: `ביקורת · ${inspection.gardens?.name ?? "גן משויך"}`,
    gardenId: inspection.garden_id,
    ownerId: inspection.id,
    documentTypes: ["inspection_document"]
  }));
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as unknown as { profile_photo_url?: string | null } | null)?.profile_photo_url ?? profile.profile_image_url };

  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/documents" title="מסמכי פיקוח" subtitle="גישה לתיעוד שנדרש לביקורות ולגנים המשויכים" badge="גישה מוגבלת">
      <DocumentsPlatform
        title="מסמכים לביקורת"
        subtitle="מסמכי ציות וגרסאות ביקורת בהתאם לשיוך הפעיל בלבד."
        rows={rows}
        uploadTargets={uploadTargets}
        roleLabel="פיקוח"
        limitedMessage="הפקח רואה רק מסמכים שהוגדרו לצורך ביקורת או ציות בגנים המשויכים. ראיות ממצאים נשארות במרחב הראיות הנפרד."
      />
    </InspectorAppFrame>
  );
}
