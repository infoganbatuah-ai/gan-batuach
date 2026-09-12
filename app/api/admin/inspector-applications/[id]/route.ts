import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["under_review", "request_more_information", "approve", "reject", "suspend"]),
  decision_reason: z.string().optional(),
  assigned_regions: z.array(z.string()).optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, profile } = await getSessionProfile();
    if (!user || !profile) return fail("נדרשת התחברות.", 401);
    if (profile.role !== "admin" || profile.active !== true) return fail("אין הרשאה לבדיקת בקשות מפקחים.", 403);
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("decide_inspector_application" as any, {
      p_application_id: id,
      p_action: payload.action,
      p_reason: payload.decision_reason ?? null,
      p_regions: payload.assigned_regions ?? null
    } as any);
    if (error) return fail(error.message, error.code === "42501" ? 403 : 409);
    return ok({ application: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
