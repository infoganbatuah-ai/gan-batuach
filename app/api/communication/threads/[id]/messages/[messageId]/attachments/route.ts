import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ id: z.string().uuid(), messageId: z.string().uuid() });
const bucket = "management-message-attachments";
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const maxBytes = 5 * 1024 * 1024;

export async function POST(request: Request, context: { params: Promise<{ id: string; messageId: string }> }) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile?.active) return fail("נדרשת התחברות מחדש.", 401);
    const { id: threadId, messageId } = paramsSchema.parse(await context.params);
    if (!isAdminClientConfigured()) return fail("אחסון קבצים אינו זמין כעת.", 503);
    const supabase = await createClient();
    const { data: threadData } = await supabase.from("communication_threads" as never)
      .select("id,garden_id,status").eq("id", threadId).maybeSingle();
    const thread = threadData as { garden_id: string; status: string } | null;
    if (!thread?.garden_id) return fail("השיחה אינה זמינה.", 404);
    if (["closed", "archived"].includes(thread.status)) return fail("השיחה סגורה לשליחה.", 409);
    const { data: messageData } = await supabase.from("messages" as never)
      .select("id,thread_id,garden_id,sender_id").eq("id", messageId)
      .eq("thread_id", threadId).is("deleted_at", null).maybeSingle();
    const message = messageData as { garden_id: string; sender_id: string } | null;
    if (!message || message.garden_id !== thread.garden_id || message.sender_id !== session.profile.id) {
      return fail("אין הרשאה לצרף קובץ להודעה זו.", 403);
    }
    const { data: existing } = await supabase.from("management_message_attachments" as never)
      .select("id").eq("message_id", messageId).maybeSingle();
    if (existing) return fail("כבר קיים קובץ מצורף להודעה זו.", 409);
    const contentLength = Number(request.headers.get("content-length"));
    if (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > maxBytes + 16 * 1024) {
      return fail("בקשת הקובץ גדולה מדי או חסרה מגבלת גודל.", 413);
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size < 1 || file.size > maxBytes) {
      return fail("קובץ לא תקין או גדול מדי.", 422);
    }
    const attachmentId = randomUUID();
    const path = `${thread.garden_id}/${threadId}/${messageId}/${attachmentId}`;
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage.from(bucket).upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type, upsert: false
    });
    if (uploadError) return fail("שמירת הקובץ נכשלה.", 503);
    const safeName = file.name.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 120) || "attachment";
    const { error: insertError } = await admin.from("management_message_attachments").insert({
      id: attachmentId, garden_id: thread.garden_id, thread_id: threadId, message_id: messageId,
      uploaded_by: session.profile.id, storage_path: path, file_name: safeName,
      content_type: file.type, size_bytes: file.size
    });
    if (insertError) {
      await admin.storage.from(bucket).remove([path]);
      return fail("קישור הקובץ להודעה נכשל.", 503);
    }
    return ok({ id: attachmentId, message_id: messageId, file_name: safeName,
      content_type: file.type, size_bytes: file.size,
      download_path: `/api/communication/threads/${threadId}/messages/${messageId}/attachments/${attachmentId}` }, 201);
  } catch (error) { return handleSafeRouteError(error); }
}
