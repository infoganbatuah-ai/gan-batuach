import { DashboardShell } from "@/components/dashboard-shell";
import { DocumentsPlatform, type DocumentsPlatformRow } from "@/components/documents-platform";
import { requireRole } from "@/lib/auth";
import { effectiveDocumentStatus } from "@/lib/management/document-policy";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

const documentFields = "id,garden_id,owner_type,owner_profile_id,staff_id,child_id,inspection_id,uploaded_by,name,document_type,status,expires_at,created_at,reviewed_at,rejection_reason,mime_type,byte_size,replaces_document_id,replaced_by,file_url,reminder_days_before,deleted_at";

type DocumentSnapshot = {
  rows: DocumentsPlatformRow[];
  primaryAvailable: boolean;
  lookupState: "not_requested" | "not_needed" | "available" | "unavailable";
  queryError: string | null;
};

export default async function AdminDocumentsPage() {
  const { profile } = await requireRole(["admin"]);
  const result = await safeAdminData<DocumentSnapshot>("admin documents", async () => {
    const supabase = await createClient();
    async function query<T>(label: string, run: () => PromiseLike<{ data: T[] | null; error: unknown }>) {
      try {
        const response = await run();
        logSupabaseError(label, response.error);
        return { data: response.error ? [] as T[] : response.data ?? [], available: !response.error };
      } catch (error) {
        logSupabaseError(label, error);
        return { data: [] as T[], available: false };
      }
    }
    const documentsRes = await query("admin documents primary", () => supabase.from("documents" as never).select(documentFields as never).is("deleted_at", null).order("created_at", { ascending: false }).limit(120));
    if (!documentsRes.available) return { rows: [], primaryAvailable: false, lookupState: "not_requested", queryError: "רשימת המסמכים אינה זמינה; אין להסיק מכך שאין מסמכים." };
    const documentRows = (documentsRes.data ?? []) as unknown as DocumentsPlatformRow[];
    const gardenIds = Array.from(new Set(documentRows.map((row) => row.garden_id).filter(Boolean)));
    const gardensRes = gardenIds.length ? await query("admin documents gardens", () => supabase.from("gardens" as never).select("id,name" as never).in("id", gardenIds)) : { data: [], available: true };
    const gardenNames = new Map(((gardensRes.data ?? []) as unknown as Array<{ id: string; name: string }>).map((garden) => [garden.id, garden.name]));
    const rows: DocumentsPlatformRow[] = documentRows.map((row) => ({
      ...row,
      effective_status: effectiveDocumentStatus(row),
      file_url: row.file_url === `/api/documents/${row.id}/file` ? row.file_url : null,
      garden_name: !gardensRes.available ? "שם הגן לא זמין" : gardenNames.get(row.garden_id) ?? "גן מורשה",
      context_name: !gardensRes.available ? row.owner_type === "inspection" ? "ביקורת · שם הגן לא זמין" : "שם הגן לא זמין" : row.owner_type === "inspection" ? `ביקורת · ${gardenNames.get(row.garden_id) ?? "גן"}` : gardenNames.get(row.garden_id) ?? "מסמך ארגוני",
      can_review: row.uploaded_by !== profile.id && ["garden", "owner", "teacher", "inspection"].includes(String(row.owner_type))
    }));
    return { rows, primaryAvailable: true, lookupState: gardenIds.length ? gardensRes.available ? "available" : "unavailable" : "not_needed", queryError: gardensRes.available ? null : "רשומות המסמכים נטענו, אך שמות הגנים אינם זמינים. התוויות החלקיות מסומנות בנפרד." };
  }, { rows: [], primaryAvailable: false, lookupState: "not_requested", queryError: null });

  return (
    <DashboardShell role="admin" title="מרכז מסמכים">
      {(result.error ?? result.data.queryError) ? <p className="data-notice" role="status">{result.error ?? result.data.queryError}</p> : null}
      {!result.data.primaryAvailable ? <section className="card" role="status" aria-label="נתוני מסמכים לא זמינים"><h2>רשימת המסמכים אינה זמינה</h2><p>לא ניתן לקבוע אם קיימים מסמכים; פעולות מסמכים אינן מוצגות ללא נתונים תקינים.</p></section> : <DocumentsPlatform
        title="בקרת מסמכים"
        subtitle="תור אימות מורשה למסמכי גן, בעלים, הוראה וביקורת. מסמכי משפחה וצוות נשארים מחוץ לטווח האדמין."
        rows={result.data.rows}
        canReview
        roleLabel="אדמין"
        limitedMessage="הגישה כאן משתמשת בהרשאות המשתמש וב־RLS. ראיות ביקורת, קבצי הודעות ומסמכים משפחתיים אינם נכללים במרכז הזה."
      />}
    </DashboardShell>
  );
}
