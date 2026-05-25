import { randomUUID } from "node:crypto";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const allowedBuckets = new Set(["documents", "child-photos", "incident-photos", "inspection-reports", "gallery"]);

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
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
    const supabase = createAdminClient();
    const path = `${prefix}/${profile.garden_id ?? "system"}/${profile.id}/${Date.now()}-${randomUUID()}-${safeName(file.name)}`;
    const { error } = await supabase.storage.from(bucket).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "application/octet-stream", upsert: false });
    if (error) {
      console.error("Supabase storage upload failed", { bucket, path, message: error.message });
      return fail("לא ניתן להעלות את הקובץ כרגע. נסו שוב או בדקו את הגדרת Storage.", 400);
    }
    const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 30);
    await supabase.from("audit_logs").insert({ actor_id: profile.id, actor_role: profile.role, garden_id: profile.garden_id, entity_type: "storage.objects", action: "upload_file", after_data: { bucket, path, size: file.size, type: file.type } });
    return ok({ bucket, path, url: signed.data?.signedUrl ?? null, file_name: file.name, content_type: file.type, size: file.size });
  } catch (error) {
    return handleRouteError(error);
  }
}
