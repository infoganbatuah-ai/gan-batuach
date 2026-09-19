import { z } from "zod";
import { fail, handleSafeRouteError } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ id: z.string().uuid(), messageId: z.string().uuid(), attachmentId: z.string().uuid() });

export async function GET(_: Request, context: { params: Promise<{ id: string; messageId: string; attachmentId: string }> }) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile?.active) return fail("נדרשת התחברות מחדש.", 401);
    const { id: threadId, messageId, attachmentId } = paramsSchema.parse(await context.params);
    const supabase = await createClient();
    const { data: attachmentData } = await supabase.from("management_message_attachments" as never)
      .select("id,garden_id,thread_id,message_id,storage_path")
      .eq("id", attachmentId).eq("thread_id", threadId).eq("message_id", messageId).maybeSingle();
    const attachment = attachmentData as { storage_path: string } | null;
    if (!attachment) return fail("הקובץ אינו זמין.", 404);
    if (!isAdminClientConfigured()) return fail("אחסון קבצים אינו זמין כעת.", 503);
    // RLS above proves current thread authority before the service role signs.
    const { data, error } = await createAdminClient().storage.from("management-message-attachments")
      .createSignedUrl(attachment.storage_path, 60);
    if (error || !data?.signedUrl) return fail("הקובץ אינו זמין.", 404);
    return new Response(null, { status: 302, headers: {
      Location: data.signedUrl, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer"
    } });
  } catch (error) { return handleSafeRouteError(error); }
}
