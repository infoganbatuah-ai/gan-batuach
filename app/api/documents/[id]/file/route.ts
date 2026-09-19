import { fail, handleSafeRouteError } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile?.active) return fail("נדרשת התחברות מחדש.", 401);
    const { id } = await context.params;
    if (!uuid.test(id)) return fail("מזהה מסמך לא תקין.", 422);
    const db = await createClient();
    // User-session RLS is the authority. Neither a known ID nor a client path
    // can cause the elevated storage client to sign an unrelated object.
    const { data, error } = await db.from("documents" as never)
      .select("id,garden_id,storage_bucket,storage_path,deleted_at")
      .eq("id", id).is("deleted_at", null).maybeSingle();
    const row = data as { garden_id: string; storage_bucket: string | null; storage_path: string | null } | null;
    if (error || !row || row.storage_bucket !== "documents" || !row.storage_path) return fail("המסמך אינו זמין.", 404);
    if (!isAdminClientConfigured()) return fail("אחסון המסמכים אינו זמין.", 503);
    const admin = createAdminClient();
    const audit = await admin.from("audit_logs").insert({ actor_id: session.profile.id, actor_role: session.profile.role,
      garden_id: row.garden_id, entity_type: "documents", entity_id: id, action: "document_private_read" });
    if (audit.error) return fail("לא ניתן לתעד גישה למסמך.", 503);
    const signed = await admin.storage.from("documents").createSignedUrl(row.storage_path, 60, { download: true });
    if (signed.error || !signed.data?.signedUrl) return fail("הקובץ אינו זמין.", 404);
    return new Response(null, { status: 302, headers: { Location: signed.data.signedUrl,
      "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return handleSafeRouteError(error); }
}
