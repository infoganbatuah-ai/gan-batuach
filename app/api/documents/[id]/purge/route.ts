import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile?.active) return fail("נדרשת התחברות מחדש.", 401);
    const db = await createClient();
    const adminCheck = await db.rpc("is_admin");
    if (adminCheck.error || adminCheck.data !== true) return fail("אין הרשאה למחיקה סופית.", 403);
    if (!isAdminClientConfigured()) return fail("שירות האחסון אינו זמין.", 503);
    const { id } = await context.params;
    if (!uuid.test(id)) return fail("מזהה מסמך לא תקין.", 422);
    const admin = createAdminClient();
    const { data, error } = await admin.from("documents" as never)
      .select("id,garden_id,storage_bucket,storage_path,legal_hold,retention_until,deletion_requested_at,deleted_at")
      .eq("id", id).maybeSingle();
    const row = data as { garden_id: string; storage_bucket: string | null; storage_path: string | null;
      legal_hold: boolean; retention_until: string | null; deletion_requested_at: string | null; deleted_at: string | null } | null;
    if (error || !row || row.storage_bucket !== "documents" || !row.storage_path) return fail("המסמך אינו זמין למחיקה אוטומטית.", 404);
    if (row.legal_hold || !row.deletion_requested_at || !row.retention_until || row.retention_until > new Date().toISOString().slice(0, 10))
      return fail("שמירת המסמך עדיין נדרשת או אינה מוגדרת.", 409);
    if (!row.deleted_at) {
      const marked = await admin.from("documents" as never).update({ deleted_at: new Date().toISOString() } as never)
        .eq("id", id).is("deleted_at", null).eq("legal_hold", false)
        .not("deletion_requested_at", "is", null).lte("retention_until", new Date().toISOString().slice(0, 10))
        .select("id").maybeSingle();
      if (marked.error || !marked.data) return fail("תנאי שמירת המסמך השתנו; המחיקה נעצרה.", 409);
    }
    const removed = await admin.storage.from("documents").remove([row.storage_path]);
    if (removed.error) return fail("הגישה למסמך נחסמה; מחיקת הקובץ דורשת ניסיון חוזר.", 503);
    const audit = await admin.from("audit_logs").insert({ actor_id: session.profile.id, actor_role: session.profile.role,
      garden_id: row.garden_id, entity_type: "documents", entity_id: id, action: "document_storage_purged" });
    if (audit.error) return fail("הקובץ נמחק אך תיעוד המחיקה דורש תיקון.", 503);
    return ok({ id, status: "deleted" });
  } catch (error) { return handleSafeRouteError(error); }
}
