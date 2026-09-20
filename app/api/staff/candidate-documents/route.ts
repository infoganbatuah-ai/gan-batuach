import { randomUUID } from "node:crypto";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { managementContactVerification } from "@/lib/management/contact-verification";
import { documentMimeExtensions, supportedDocumentSignature } from "@/lib/management/document-policy";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const maxBytes = 12 * 1024 * 1024;

export async function GET() {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile) return fail("נדרשת התחברות מחדש.", 401);
    if (session.profile.role !== "staff") return fail("אין הרשאה למסמכי מועמדות.", 403);
    if (!managementContactVerification(session.user, session.profile).complete) return fail("יש לאמת דוא״ל לפני גישה למסמכי מועמדות.", 403);
    const db = await createClient();
    const rows = await db.from("staff_candidate_documents" as never)
      .select("id,category,mime_type,byte_size,status,uploaded_at" as never)
      .eq("profile_id", session.profile.id).is("deleted_at", null)
      .order("uploaded_at", { ascending: false }).limit(10);
    if (rows.error) return fail("רשימת מסמכי המועמדות אינה זמינה.", 503);
    return ok(rows.data ?? []);
  } catch (error) { return handleSafeRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile) return fail("נדרשת התחברות מחדש.", 401);
    if (session.profile.role !== "staff") return fail("אין הרשאה למסמכי מועמדות.", 403);
    if (!managementContactVerification(session.user, session.profile).complete) return fail("יש לאמת דוא״ל לפני העלאת מסמך.", 403);
    if (!isAdminClientConfigured()) return fail("אחסון המסמכים אינו זמין.", 503);
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > maxBytes + 65536) return fail("הקובץ גדול מדי.", 413);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1 || file.size > maxBytes || !(file.type in documentMimeExtensions))
      return fail("סוג הקובץ או גודלו אינם נתמכים.", 422);
    const db = await createClient();
    const candidate = await db.from("staff_candidate_profiles" as never).select("profile_id" as never)
      .eq("profile_id", session.profile.id).maybeSingle();
    if (candidate.error || !candidate.data) return fail("יש לשמור פרופיל מקצועי לפני העלאת מסמך.", 409);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!supportedDocumentSignature(file.type, bytes)) return fail("תוכן הקובץ אינו תואם לסוג שנבחר.", 422);
    const id = randomUUID();
    const ext = documentMimeExtensions[file.type as keyof typeof documentMimeExtensions];
    const path = `management/candidates/${session.profile.id}/${id}/${randomUUID()}.${ext}`;
    const storage = createAdminClient().storage.from("documents");
    const uploaded = await storage.upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploaded.error) return fail("העלאת המסמך נכשלה.", 503);
    const registered = await db.rpc("register_staff_candidate_document" as never, {
      p_id: id, p_storage_path: path, p_mime_type: file.type, p_byte_size: file.size
    } as never);
    if (registered.error) {
      await storage.remove([path]);
      return fail("שמירת המסמך נכשלה או שההרשאה השתנתה.", 409);
    }
    return ok({ id, category: "qualification", status: "uploaded", verified: false }, 201);
  } catch (error) { return handleSafeRouteError(error); }
}
