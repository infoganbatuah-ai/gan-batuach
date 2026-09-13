import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getOperationalRoleContext } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["acknowledge", "progress", "submit", "accept", "reject", "reopen", "extend"]),
  note: z.string().max(2000).optional(),
  evidencePaths: z.array(z.string().max(300)).max(12).default([]),
  dueAt: z.string().datetime().optional(),
  responsibleProfileId: z.string().uuid().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getOperationalRoleContext(["admin", "inspector", "manager", "owner"]);
    if (!access.allowed) return access.response;
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return fail("מזהה ליקוי לא תקין", 422);
    const payload = schema.parse(await request.json());
    const { data, error } = await (await createClient()).rpc("transition_corrective_action" as never, {
      p_violation_id: id, p_action: payload.action, p_note: payload.note ?? null,
      p_evidence_paths: payload.evidencePaths, p_due_at: payload.dueAt ?? null,
      p_responsible_profile_id: payload.responsibleProfileId ?? null
    } as never);
    if (error) return fail(error.message, error.code === "42501" ? 403 : error.code === "23514" ? 409 : 400);
    return ok(data);
  } catch (error) { return handleRouteError(error); }
}
