import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["review", "request_information", "approve", "reject"]),
  decision_reason: z.string().trim().max(3000).optional(), assigned_role: z.string().trim().max(100).optional(),
  classroom_id: z.string().uuid().optional().nullable()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getManagementGardenContext(); if (!access.allowed) return access.response;
    const { id } = await params; const payload = schema.parse(await request.json()); const supabase = await createClient();
    const scoped = await supabase.from("staff_job_applications" as never).select("id" as never).eq("id", id).eq("garden_id", access.gardenId).maybeSingle();
    if (!scoped.data) return fail("המועמדות לא נמצאה בגן שנבחר.", 404);
    const result = await supabase.rpc("decide_staff_job_application", { target_application_id: id, target_action: payload.action, target_reason: payload.decision_reason ?? null, target_role: payload.assigned_role ?? null, target_classroom_id: payload.classroom_id ?? null });
    if (result.error) return fail(result.error.message.includes("candidate_profile_incomplete") ? "המועמד/ת עדיין לא השלימו את הפרופיל והמסמכים הנדרשים." : "הפעולה אינה מותרת במצב הנוכחי.", result.error.code === "42501" ? 403 : 409);
    return ok({ application: result.data });
  } catch (error) { return handleSafeRouteError(error); }
}
