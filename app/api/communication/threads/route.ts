import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const createThreadSchema = z.object({
  garden_id: z.string().uuid().optional(),
  recipient_id: z.string().uuid(),
  child_id: z.string().uuid().optional(),
  subject: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(8000)
}).strict();

function idempotencyKey(request: Request) {
  const parsed = z.string().uuid().safeParse(request.headers.get("Idempotency-Key"));
  return parsed.success ? parsed.data : null;
}

export async function GET() {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile?.active) return fail("נדרשת התחברות מחדש.", 401);
    if (!["parent", "manager", "owner", "staff"].includes(session.profile.role)) return fail("אין הרשאה להודעות תפעוליות.", 403);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("communication_threads" as never)
      .select("id,garden_id,child_id,classroom_id,thread_type,subject,status,last_message_at,created_at,updated_at,communication_thread_participants!inner(profile_id,last_read_at,last_read_message_id)")
      .eq("communication_thread_participants.profile_id", session.profile.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) return fail("טעינת השיחות נכשלה.", 400);
    return ok(data ?? []);
  } catch (error) { return handleSafeRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile?.active) return fail("נדרשת התחברות מחדש.", 401);
    const payload = createThreadSchema.parse(await request.json());
    const key = idempotencyKey(request);
    if (!key) return fail("נדרש מזהה בקשה למניעת כפילות.", 422);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_management_communication_thread" as never, {
      p_garden_id: payload.garden_id ?? null,
      p_recipient_id: payload.recipient_id,
      p_child_id: payload.child_id ?? null,
      p_subject: payload.subject,
      p_body: payload.body,
      p_idempotency_key: key
    } as never);
    if (error) return fail(error.code === "42501" ? "אין הרשאה לנמען, לילד או לגן שנבחרו." : "לא ניתן לפתוח שיחה.", error.code === "42501" ? 403 : 400);
    return ok(data, 201);
  } catch (error) { return handleSafeRouteError(error); }
}
