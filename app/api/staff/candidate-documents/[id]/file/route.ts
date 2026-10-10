import { fail, handleSafeRouteError } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { managementContactVerification } from "@/lib/management/contact-verification";
import { managementDocumentId } from "@/lib/management/document-policy";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile) return fail("נדרשת התחברות מחדש.", 401);
    if (session.profile.role !== "staff") return fail("אין הרשאה למסמך.", 403);
    if (!managementContactVerification(session.user, session.profile).complete) return fail("יש לאמת דוא״ל לפני גישה למסמך.", 403);
    if (!isAdminClientConfigured()) return fail("אחסון המסמכים אינו זמין.", 503);
    const { id } = await context.params;
    if (!managementDocumentId.test(id)) return fail("מסמך לא נמצא.", 404);
    const db = await createClient();
    const record = await db.from("staff_candidate_documents" as never)
      .select("id,profile_id,storage_path,storage_bucket" as never).eq("id", id)
      .eq("profile_id", session.profile.id).is("deleted_at", null).maybeSingle();
    if (record.error || !record.data) return fail("מסמך לא נמצא.", 404);
    const row = record.data as unknown as { storage_path: string; storage_bucket: string };
    const signed = await createAdminClient().storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 60);
    if (signed.error || !signed.data?.signedUrl) return fail("לא ניתן לאחזר את המסמך.", 503);
    return Response.redirect(signed.data.signedUrl, 302);
  } catch (error) { return handleSafeRouteError(error); }
}
