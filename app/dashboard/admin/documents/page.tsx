import { DashboardShell } from "@/components/dashboard-shell";
import { DocumentsPlatform, type DocumentsPlatformRow } from "@/components/documents-platform";
import { requireRole } from "@/lib/auth";
import { effectiveDocumentStatus } from "@/lib/management/document-policy";
import { createClient } from "@/lib/supabase/server";

const documentFields = "id,garden_id,owner_type,owner_profile_id,staff_id,child_id,inspection_id,uploaded_by,name,document_type,status,expires_at,created_at,reviewed_at,rejection_reason,mime_type,byte_size,replaces_document_id,replaced_by,file_url,reminder_days_before,deleted_at";

export default async function AdminDocumentsPage() {
  const { profile } = await requireRole(["admin"]);
  const supabase = await createClient();
  const documentsRes = await supabase.from("documents" as never).select(documentFields as never).is("deleted_at", null).order("created_at", { ascending: false }).limit(120);
  const documentRows = (documentsRes.data ?? []) as unknown as DocumentsPlatformRow[];
  const gardenIds = Array.from(new Set(documentRows.map((row) => row.garden_id).filter(Boolean)));
  const gardensRes = gardenIds.length ? await supabase.from("gardens" as never).select("id,name" as never).in("id", gardenIds) : { data: [] };
  const gardenNames = new Map(((gardensRes.data ?? []) as unknown as Array<{ id: string; name: string }>).map((garden) => [garden.id, garden.name]));
  const rows: DocumentsPlatformRow[] = documentRows.map((row) => ({
    ...row,
    effective_status: effectiveDocumentStatus(row),
    file_url: row.file_url === `/api/documents/${row.id}/file` ? row.file_url : null,
    garden_name: gardenNames.get(row.garden_id) ?? "גן מורשה",
    context_name: row.owner_type === "inspection" ? `ביקורת · ${gardenNames.get(row.garden_id) ?? "גן"}` : gardenNames.get(row.garden_id) ?? "מסמך ארגוני",
    can_review: row.uploaded_by !== profile.id && ["garden", "owner", "teacher", "inspection"].includes(String(row.owner_type))
  }));

  return (
    <DashboardShell role="admin" title="מרכז מסמכים">
      <DocumentsPlatform
        title="בקרת מסמכים"
        subtitle="תור אימות מורשה למסמכי גן, בעלים, הוראה וביקורת. מסמכי משפחה וצוות נשארים מחוץ לטווח האדמין."
        rows={rows}
        canReview
        roleLabel="אדמין"
        limitedMessage="הגישה כאן משתמשת בהרשאות המשתמש וב־RLS. ראיות ביקורת, קבצי הודעות ומסמכים משפחתיים אינם נכללים במרכז הזה."
      />
    </DashboardShell>
  );
}
