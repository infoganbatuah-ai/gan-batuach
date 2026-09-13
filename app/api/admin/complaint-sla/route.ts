import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const draft = z.object({
  action: z.literal("create_draft"),
  category: z.string().min(1).max(80).nullable().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).nullable().optional(),
  acknowledgementMinutes: z.number().int().positive(),
  responseMinutes: z.number().int().positive(),
  resolutionMinutes: z.number().int().positive(),
  effectiveFrom: z.string().datetime(),
  effectiveUntil: z.string().datetime().nullable().optional(),
  sourceNote: z.string().min(3).max(1000)
}).strict();
const transition = z.object({ action: z.enum(["activate", "retire"]), id: z.string().uuid() }).strict();

async function admin() {
  const session = await getSessionProfile();
  if (!session.user) return { error: fail("נדרשת התחברות מחדש.", 401) };
  if (session.profile?.role !== "admin" || session.profile.active !== true) return { error: fail("נדרשת הרשאת מנהל מערכת.", 403) };
  return { error: null };
}

export async function GET() {
  try {
    const access = await admin();
    if (access.error) return access.error;
    const supabase = await createClient();
    const { data, error } = await supabase.from("complaint_sla_policies" as never).select("*").order("version", { ascending: false });
    if (error) return fail("טעינת מדיניות SLA נכשלה.", 400);
    return ok(data ?? []);
  } catch (error) { return handleSafeRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const access = await admin();
    if (access.error) return access.error;
    const body = await request.json();
    const supabase = await createClient();
    if (body.action === "create_draft") {
      const payload = draft.parse(body);
      const { data, error } = await supabase.rpc("create_complaint_sla_draft" as never, {
        p_category: payload.category ?? null, p_severity: payload.severity ?? null,
        p_acknowledgement_minutes: payload.acknowledgementMinutes,
        p_response_minutes: payload.responseMinutes, p_resolution_minutes: payload.resolutionMinutes,
        p_effective_from: payload.effectiveFrom, p_effective_until: payload.effectiveUntil ?? null,
        p_source_note: payload.sourceNote
      } as never);
      if (error) return fail("יצירת טיוטת המדיניות נכשלה.", 400);
      return ok(data, 201);
    }
    const payload = transition.parse(body);
    const { data, error } = await supabase.rpc("transition_complaint_sla_policy" as never, { p_id: payload.id, p_action: payload.action } as never);
    if (error) return fail(error.code === "23505" ? "קיימת מדיניות פעילה חופפת." : "מעבר מצב המדיניות נדחה.", error.code === "23505" ? 409 : 400);
    return ok(data);
  } catch (error) { return handleSafeRouteError(error); }
}
