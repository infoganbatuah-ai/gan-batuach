import { randomUUID } from "node:crypto";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { documentMimeExtensions, documentOwnerFor, effectiveDocumentStatus, managementDocumentId, supportedDocumentSignature } from "@/lib/management/document-policy";

const maxBytes = 12 * 1024 * 1024;
const uuid = managementDocumentId;
const date = /^\d{4}-\d{2}-\d{2}$/;

async function uploadAllowed(db: Awaited<ReturnType<typeof createClient>>, profileId: string, profileRole: string, gardenId: string, ownerType: string, ownerId: string | null) {
  if (profileRole === "admin" && ["child", "staff", "owner", "teacher", "guardian"].includes(ownerType)) return false;
  const manage = await db.rpc("can_manage_garden", { target_garden_id: gardenId });
  if (manage.error) return false;
  if (ownerType === "garden") return manage.data === true;
  if (!ownerId || !uuid.test(ownerId)) return false;
  if (ownerType === "child") {
    const { data: child } = await db.from("children").select("id,garden_id").eq("id", ownerId).maybeSingle();
    if (!child || child.garden_id !== gardenId) return false;
    const parent = await db.rpc("can_parent_access_child", { target_child_id: ownerId });
    return manage.data === true || (!parent.error && parent.data === true);
  }
  if (ownerType === "staff") {
    const { data: staff } = await db.from("staff").select("id,garden_id,profile_id").eq("id", ownerId).maybeSingle();
    if (!staff || staff.garden_id !== gardenId) return false;
    const employment = await db.rpc("can_staff_access_garden", { target_garden_id: gardenId });
    return manage.data === true || (staff.profile_id === profileId && !employment.error && employment.data === true);
  }
  if (["owner", "teacher", "guardian"].includes(ownerType)) {
    if (ownerId !== profileId) return false;
    if (ownerType === "owner") return profileRole === "owner" && manage.data === true;
    if (ownerType === "teacher") {
      const assignment = await db.from("garden_teaching_assignments" as never).select("id")
        .eq("garden_id", gardenId).eq("profile_id", profileId).eq("status", "active").maybeSingle();
      return !assignment.error && Boolean(assignment.data);
    }
    if (ownerType !== "guardian") return false;
    const { data: parent } = await db.from("parents").select("id").eq("profile_id", profileId).eq("garden_id", gardenId).maybeSingle();
    return Boolean(parent);
  }
  if (ownerType === "inspection") {
    const { data: inspection } = await db.from("inspections").select("id,garden_id,status").eq("id", ownerId).maybeSingle();
    if (!inspection || inspection.garden_id !== gardenId || !["open", "in_progress"].includes(inspection.status)) return false;
    const assignment = await db.rpc("can_inspector_access_garden", { target_garden_id: gardenId });
    return !assignment.error && assignment.data === true;
  }
  return false;
}

export async function GET(request: Request) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile?.active) return fail("נדרשת התחברות מחדש.", 401);
    const db = await createClient();
    const search = new URL(request.url).searchParams;
    const gardenId = search.get("garden_id");
    if (gardenId && !uuid.test(gardenId)) return fail("מזהה גן לא תקין.", 422);
    let query = db.from("documents" as never)
      .select("id,garden_id,staff_id,child_id,owner_profile_id,inspection_id,name,document_type,owner_type,file_url,status,expires_at,reminder_days_before,created_at,replaced_by,deleted_at")
      .is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
    if (gardenId) query = query.eq("garden_id", gardenId);
    const { data, error } = await query;
    if (error) return fail("רשימת המסמכים אינה זמינה.", 503);
    const rows = (data ?? []) as unknown as Array<{ id: string; file_url: string | null; status: string;
      expires_at: string | null; reminder_days_before: number | null; replaced_by: string | null; deleted_at: string | null }>;
    return ok(rows.map((row) => ({ ...row,
      file_url: typeof row.file_url === "string" && row.file_url === `/api/documents/${row.id}/file` ? row.file_url : null,
      effective_status: effectiveDocumentStatus(row) })));
  } catch (error) { return handleSafeRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile?.active) return fail("נדרשת התחברות מחדש.", 401);
    if (!isAdminClientConfigured()) return fail("אחסון המסמכים אינו זמין.", 503);
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > maxBytes + 65536) return fail("הקובץ גדול מדי.", 413);
    const form = await request.formData();
    const file = form.get("file");
    const gardenId = String(form.get("garden_id") ?? "");
    const category = String(form.get("document_type") ?? "");
    const ownerType = documentOwnerFor(category);
    const ownerId = String(form.get("owner_id") ?? "") || null;
    const name = String(form.get("name") ?? "").trim();
    const expiresAt = String(form.get("expires_at") ?? "") || null;
    const replacesId = String(form.get("replaces_document_id") ?? "") || null;
    if (!uuid.test(gardenId) || !ownerType || (ownerType !== "garden" && (!ownerId || !uuid.test(ownerId)))
      || (ownerType === "garden" && ownerId) || name.length < 2 || name.length > 160
      || (expiresAt && (!date.test(expiresAt) || Number.isNaN(Date.parse(expiresAt))))
      || (replacesId && !uuid.test(replacesId))) return fail("פרטי המסמך אינם תקינים.", 422);
    if (!(file instanceof File) || file.size < 1 || file.size > maxBytes || !(file.type in documentMimeExtensions))
      return fail("סוג הקובץ או גודלו אינם נתמכים.", 422);
    const db = await createClient();
    if (!await uploadAllowed(db, session.profile.id, session.profile.role, gardenId, ownerType, ownerId)) return fail("אין הרשאה להעלות מסמך לישות זו.", 403);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!supportedDocumentSignature(file.type, bytes)) return fail("תוכן הקובץ אינו תואם לסוג שנבחר.", 422);
    const id = randomUUID();
    const extension = documentMimeExtensions[file.type as keyof typeof documentMimeExtensions];
    const path = `management/${gardenId}/${id}/${randomUUID()}.${extension}`;
    const storage = createAdminClient().storage.from("documents");
    const uploaded = await storage.upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploaded.error) return fail("העלאת המסמך נכשלה.", 503);
    const registered = await db.rpc("register_management_document" as never, {
      p_id: id, p_garden_id: gardenId, p_owner_type: ownerType,
      p_owner_profile_id: ["owner", "teacher", "guardian"].includes(ownerType) ? ownerId : null,
      p_staff_id: ownerType === "staff" ? ownerId : null,
      p_child_id: ownerType === "child" ? ownerId : null,
      p_inspection_id: ownerType === "inspection" ? ownerId : null,
      p_document_type: category, p_name: name, p_storage_path: path,
      p_mime_type: file.type, p_byte_size: file.size, p_expires_at: expiresAt,
      p_replaces_document_id: replacesId
    } as never);
    if (registered.error) {
      await storage.remove([path]);
      return fail("שמירת המסמך נכשלה או שההרשאה השתנתה.", 409);
    }
    const row = registered.data as { id: string; garden_id: string; name: string; document_type: string; status: string; file_url: string };
    return ok({ id: row.id, garden_id: row.garden_id, name: row.name, document_type: row.document_type,
      status: row.status, file_url: row.file_url, effective_status: row.status }, 201);
  } catch (error) { return handleSafeRouteError(error); }
}
