import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["acknowledge", "review", "request_reporter", "request_garden", "reporter_reply", "garden_reply", "escalate", "resolve", "close", "reopen", "note", "assign", "mark_urgent"]),
  publicNote: z.string().max(4000).nullable().optional(),
  internalNote: z.string().max(4000).nullable().optional()
}).strict();

type ComplaintResult = {
  id: string; garden_id: string; child_id: string | null; subject: string;
  status: string; routing_state: string; reporter_user_id: string | null;
  resolution_public: string | null; acknowledged_at: string | null;
  resolved_at: string | null; closed_at: string | null;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionProfile();
    if (!session.user) return fail("נדרשת התחברות מחדש.", 401);
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return fail("תלונה לא תקינה.", 400);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("transition_management_complaint" as never, {
      p_id: id, p_action: payload.action, p_public_note: payload.publicNote ?? null,
      p_internal_note: payload.internalNote ?? null
    } as never);
    if (error) return fail(error.code === "42501" ? "הפעולה אינה מורשית או שהמצב השתנה." : "עדכון התלונה נכשל.", error.code === "42501" ? 403 : 400);
    const row = data as ComplaintResult;
    const reporter = row.reporter_user_id === session.user.id;
    return ok(reporter ? {
      id: row.id, garden_id: row.garden_id, child_id: row.child_id, subject: row.subject,
      status: row.status, resolution_public: row.resolution_public, acknowledged_at: row.acknowledged_at,
      resolved_at: row.resolved_at, closed_at: row.closed_at
    } : {
      id: row.id, garden_id: row.garden_id, status: row.status, routing_state: row.routing_state,
      acknowledged_at: row.acknowledged_at, resolved_at: row.resolved_at, closed_at: row.closed_at
    });
  } catch (error) { return handleSafeRouteError(error); }
}
