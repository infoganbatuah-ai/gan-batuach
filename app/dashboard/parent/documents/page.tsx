import { DashboardShell } from "@/components/dashboard-shell";
import { DocumentsPlatform, type DocumentsPlatformRow, type DocumentsUploadTarget } from "@/components/documents-platform";
import { ParentAppFrame } from "@/components/parent-app-ui";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { effectiveDocumentStatus } from "@/lib/management/document-policy";
import { createClient } from "@/lib/supabase/server";

const documentFields = "id,garden_id,owner_type,owner_profile_id,staff_id,child_id,inspection_id,uploaded_by,name,document_type,status,expires_at,created_at,reviewed_at,rejection_reason,mime_type,byte_size,replaces_document_id,replaced_by,file_url,reminder_days_before,deleted_at";
type FamilyChild = { id: string; full_name: string; garden_id?: string | null };
type FamilyGarden = { id: string; name: string };

export default async function ParentDocumentsPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase, profile);
  const documentsRes = await supabase.from("documents" as never).select(documentFields as never).is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
  const children = family.children as FamilyChild[];
  const childNames = new Map(children.map((item) => [item.id, item.full_name]));
  const gardenNames = new Map((family.gardens as FamilyGarden[]).map((item) => [item.id, item.name]));
  const rows: DocumentsPlatformRow[] = ((documentsRes.data ?? []) as unknown as DocumentsPlatformRow[]).map((row) => ({
    ...row,
    effective_status: effectiveDocumentStatus(row),
    file_url: row.file_url === `/api/documents/${row.id}/file` ? row.file_url : null,
    garden_name: gardenNames.get(row.garden_id) ?? "הגן המשויך",
    context_name: row.child_id ? childNames.get(row.child_id) ?? "ילד/ה מקושר/ת" : row.owner_type === "guardian" ? profile.full_name : gardenNames.get(row.garden_id) ?? "הגן המשויך",
    can_review: false
  }));
  const childTargets: DocumentsUploadTarget[] = children.flatMap((child) => child.garden_id ? [{ id: `child-${child.id}`, label: `מסמכי ${child.full_name}`, gardenId: child.garden_id, ownerId: child.id, documentTypes: ["child_document", "medical_approval"] }] : []);
  const guardianTargets: DocumentsUploadTarget[] = Array.from(new Set(family.gardenIds as string[])).map((gardenId) => ({ id: `guardian-${gardenId}`, label: `מסמכי הורה · ${gardenNames.get(gardenId) ?? "גן משויך"}`, gardenId, ownerId: profile.id, documentTypes: ["guardian_document"] }));

  return (
    <DashboardShell role="parent" title="מסמכים" appHome>
      <ParentAppFrame active="more" profileName={profile.full_name} avatarUrl={profile.profile_image_url ?? null}>
        <DocumentsPlatform title="המסמכים של המשפחה" subtitle="מסמכי הילדים וההורה לפי הגן המשויך, עם סטטוס ברור ופעולה בטוחה." rows={rows} uploadTargets={[...childTargets, ...guardianTargets]} roleLabel="משפחה" />
      </ParentAppFrame>
    </DashboardShell>
  );
}
