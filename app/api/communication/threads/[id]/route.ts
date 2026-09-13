import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ id: z.string().uuid() });
const sendSchema = z.object({ body: z.string().trim().min(1).max(8000) }).strict();

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile?.active) return fail("נדרשת התחברות מחדש.", 401);
    const { id } = paramsSchema.parse(await context.params);
    const supabase = await createClient();
    const { data: thread, error: threadError } = await supabase.from("communication_threads" as never)
      .select("id,garden_id,child_id,classroom_id,thread_type,subject,status,last_message_at,created_at,communication_thread_participants(profile_id,role,participant_label,last_read_at)")
      .eq("id", id).maybeSingle();
    if (threadError || !thread) return fail("השיחה אינה זמינה.", 404);
    const { data: messages, error: messagesError } = await supabase.from("messages" as never)
      .select("id,sender_id,subject,body,content,created_at,edited_at,message_kind")
      .eq("thread_id", id).is("deleted_at", null).order("created_at").limit(250);
    if (messagesError) return fail("טעינת ההודעות נכשלה.", 400);
    return ok({ thread, messages: messages ?? [] });
  } catch (error) { return handleSafeRouteError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile?.active) return fail("נדרשת התחברות מחדש.", 401);
    const { id } = paramsSchema.parse(await context.params);
    const payload = sendSchema.parse(await request.json());
    const key = z.string().uuid().safeParse(request.headers.get("Idempotency-Key"));
    if (!key.success) return fail("נדרש מזהה בקשה למניעת כפילות.", 422);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("send_management_communication_message" as never, {
      p_thread_id: id, p_body: payload.body, p_idempotency_key: key.data
    } as never);
    if (error) return fail(error.code === "42501" ? "אין הרשאה לשיחה זו." : "שליחת ההודעה נכשלה.", error.code === "42501" ? 403 : 400);
    return ok(data);
  } catch (error) { return handleSafeRouteError(error); }
}
