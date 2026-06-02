import { randomUUID } from "node:crypto";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const allowedBuckets = new Set([
  "documents",
  "child-photos",
  "profile-photos",
  "pickup-person-photos",
  "kindergarten-logos",
  "incident-photos",
  "inspection-reports",
  "gallery"
]);

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const imageBuckets = new Set(["child-photos", "profile-photos", "pickup-person-photos", "kindergarten-logos", "incident-photos", "gallery"]);
const roleBucketAccess: Record<string, Set<string>> = {
  admin: allowedBuckets,
  manager: new Set(["documents", "child-photos", "profile-photos", "pickup-person-photos", "kindergarten-logos", "incident-photos", "gallery"]),
  owner: new Set(["documents", "child-photos", "profile-photos", "pickup-person-photos", "kindergarten-logos", "incident-photos", "gallery"]),
  staff: new Set(["documents", "child-photos", "profile-photos", "incident-photos", "gallery"]),
  inspector: new Set(["documents", "profile-photos", "inspection-reports", "incident-photos"]),
  parent: new Set(["documents", "child-photos", "profile-photos", "pickup-person-photos"])
};

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
}

function safePrefix(prefix: string) {
  return prefix
    .split("/")
    .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, "-"))
    .filter(Boolean)
    .slice(0, 4)
    .join("/") || "general";
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireUser();
    if (!isAdminClientConfigured()) return fail("חיבור Storage דורש SUPABASE_SERVICE_ROLE_KEY בצד שרת.", 503);
    const formData = await request.formData();
    const file = formData.get("file");
    const bucket = String(formData.get("bucket") ?? "documents");
    const prefix = String(formData.get("prefix") ?? "general");
    if (!allowedBuckets.has(bucket)) return fail("סוג אחסון לא נתמך.", 422);
    if (!(file instanceof File)) return fail("לא התקבל קובץ להעלאה.", 422);
    if (file.size > 12 * 1024 * 1024) return fail("הקובץ גדול מדי. המגבלה היא 12MB.", 413);
    const roleBuckets = roleBucketAccess[String(profile.role)] ?? new Set<string>();
    if (!roleBuckets.has(bucket)) return fail("אין הרשאה להעלות קובץ לסוג האחסון הזה.", 403);
    const contentType = file.type || "application/octet-stream";
    if (!allowedMimeTypes.has(contentType)) return fail("סוג הקובץ לא נתמך. ניתן להעלות תמונה, PDF או מסמך Word בלבד.", 422);
    if (imageBuckets.has(bucket) && !contentType.startsWith("image/")) return fail("לאחסון תמונות ניתן להעלות תמונה בלבד.", 422);
    const supabase = createAdminClient();
    const path = `${safePrefix(prefix)}/${profile.garden_id ?? "system"}/${profile.id}/${Date.now()}-${randomUUID()}-${safeName(file.name)}`;
    const { error } = await supabase.storage.from(bucket).upload(path, Buffer.from(await file.arrayBuffer()), { contentType, upsert: false });
    if (error) {
      console.error("Supabase storage upload failed", { bucket, path, message: error.message });
      return fail("לא ניתן להעלות את הקובץ כרגע. נסו שוב או בדקו את הגדרת Storage.", 400);
    }
    const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 30);
    await supabase.from("audit_logs").insert({ actor_id: profile.id, actor_role: profile.role, garden_id: profile.garden_id, entity_type: "storage.objects", action: "upload_file", after_data: { bucket, path, size: file.size, type: contentType } });
    return ok({ bucket, path, url: signed.data?.signedUrl ?? null, file_name: file.name, content_type: contentType, size: file.size });
  } catch (error) {
    return handleRouteError(error);
  }
}
