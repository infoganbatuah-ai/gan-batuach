import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const broadcastSchema = z.object({
  garden_id: z.string().uuid(), classroom_id: z.string().uuid().optional(),
  audience: z.enum(["parents", "staff"]), subject: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(8000)
}).strict();

export async function POST(request: Request) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile?.active) return fail("נדרשת התחברות מחדש.", 401);
    if (!["manager", "owner"].includes(session.profile.role)) return fail("אין הרשאה להודעת גן.", 403);
    const payload = broadcastSchema.parse(await request.json());
    const key = z.string().uuid().safeParse(request.headers.get("Idempotency-Key"));
    if (!key.success) return fail("נדרש מזהה בקשה למניעת כפילות.", 422);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_management_communication_broadcast" as never, {
      p_garden_id: payload.garden_id, p_classroom_id: payload.classroom_id ?? null,
      p_audience: payload.audience, p_subject: payload.subject, p_body: payload.body,
      p_idempotency_key: key.data
    } as never);
    if (error) return fail(error.code === "42501" ? "אין הרשאה לגן או לכיתה שנבחרו." : "לא ניתן לשלוח הודעת גן.", error.code === "42501" ? 403 : 400);
    return ok(data, 201);
  } catch (error) { return handleSafeRouteError(error); }
}
