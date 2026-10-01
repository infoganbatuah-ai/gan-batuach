import { DashboardShell } from "@/components/dashboard-shell";
import { DocumentsPlatform, type DocumentsPlatformRow, type DocumentsUploadTarget } from "@/components/documents-platform";
import { TeacherAppFrame } from "@/components/teacher-app-ui";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { effectiveDocumentStatus } from "@/lib/management/document-policy";
import { createClient } from "@/lib/supabase/server";

const documentFields = "id,garden_id,owner_type,owner_profile_id,staff_id,child_id,inspection_id,uploaded_by,name,document_type,status,expires_at,created_at,reviewed_at,rejection_reason,mime_type,byte_size,replaces_document_id,replaced_by,file_url,reminder_days_before,deleted_at";
type NamedEntity = { id: string; full_name: string };
type GardenIdentity = { id: string; name: string };

export default async function GardenDocumentsPage() {
  const { profile } = await requireOperationalRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [documentsRes, childrenRes, staffRes, gardenRes, teacherAssignment] = await Promise.all([
    supabase.from("documents" as never).select(documentFields as never).eq("garden_id", gardenId).is("deleted_at", null).order("created_at", { ascending: false }).limit(120),
    supabase.from("children" as never).select("id,full_name" as never).eq("garden_id", gardenId).limit(80),
    supabase.from("staff" as never).select("id,full_name" as never).eq("garden_id", gardenId).limit(80),
    supabase.from("gardens" as never).select("id,name" as never).eq("id", gardenId).maybeSingle(),
    profile.role === "owner" ? supabase.from("garden_teaching_assignments" as never).select("id" as never).eq("garden_id", gardenId).eq("profile_id", profile.id).eq("status", "active").maybeSingle() : Promise.resolve({ data: null })
  ]);
  const children = (childrenRes.data ?? []) as unknown as NamedEntity[];
  const staff = (staffRes.data ?? []) as unknown as NamedEntity[];
  const childNames = new Map(children.map((item) => [item.id, item.full_name]));
  const staffNames = new Map(staff.map((item) => [item.id, item.full_name]));
  const gardenName = (gardenRes.data as unknown as GardenIdentity | null)?.name ?? "הגן הפעיל";
  const rows: DocumentsPlatformRow[] = ((documentsRes.data ?? []) as unknown as DocumentsPlatformRow[]).map((row) => ({
    ...row,
    effective_status: effectiveDocumentStatus(row),
    file_url: row.file_url === `/api/documents/${row.id}/file` ? row.file_url : null,
    garden_name: gardenName,
    context_name: row.child_id ? childNames.get(row.child_id) : row.staff_id ? staffNames.get(row.staff_id) : row.owner_type === "guardian" ? "הורה / אפוטרופוס" : gardenName,
    can_review: row.uploaded_by !== profile.id
  }));
  const uploadTargets: DocumentsUploadTarget[] = [
    { id: `garden-${gardenId}`, label: gardenName, gardenId, documentTypes: ["garden_document", "safety_certificate", "health_certificate", "insurance", "camera_approval", "regulatory"] },
    ...children.map((child) => ({ id: `child-${child.id}`, label: `מסמכי הילד/ה · ${child.full_name}`, gardenId, ownerId: child.id, documentTypes: ["child_document", "medical_approval"] })),
    ...staff.map((member) => ({ id: `staff-${member.id}`, label: `מסמכי צוות · ${member.full_name}`, gardenId, ownerId: member.id, documentTypes: ["staff_document", "qualification", "training", "first_aid", "police_clearance", "background_check"] })),
    ...(teacherAssignment.data ? [{ id: `teacher-${profile.id}`, label: "תעודת ההוראה שלי", gardenId, ownerId: profile.id, documentTypes: ["teacher_certificate"] }] : [])
  ];

  return (
    <DashboardShell role="manager" title="מסמכים" appHome>
      <TeacherAppFrame title="מרכז המסמכים" subtitle="מסמכי גן, ילדים וצוות" avatarUrl={profile.profile_image_url ?? null} active="more">
        <DocumentsPlatform title="מסמכים ואישורים" subtitle="תיק מסמכים אחד לגן הפעיל, עם תוקף, בדיקה, החלפה וגישה מאובטחת." rows={rows} uploadTargets={uploadTargets} canReview roleLabel="ניהול הגן" />
      </TeacherAppFrame>
    </DashboardShell>
  );
}
