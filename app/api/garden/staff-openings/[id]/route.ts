import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  role_needed: z.string().trim().min(2).max(100).optional(), age_group: z.string().trim().max(100).nullable().optional(),
  description: z.string().trim().max(3000).nullable().optional(), requirements: z.string().trim().max(3000).nullable().optional(),
  qualification_keys: z.array(z.string().trim().min(2).max(100)).max(12).optional(), classroom_id: z.string().uuid().nullable().optional(),
  employment_type: z.string().trim().max(100).nullable().optional(), active_status: z.enum(["draft","published","paused","closed","filled"]).optional()
});
type OpeningRow = { garden_id: string; active_status: string };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getManagementGardenContext(); if (!access.allowed) return access.response;
    const { id } = await params; const payload = schema.parse(await request.json()); const supabase = await createClient();
    const existing = await supabase.from("kindergarten_staff_openings" as never).select("id,garden_id,active_status" as never).eq("id", id).maybeSingle();
    const existingOpening = existing.data as unknown as OpeningRow | null;
    if (!existingOpening || existingOpening.garden_id !== access.gardenId) return fail("המשרה אינה זמינה בגן שנבחר.", 404);
    if (payload.classroom_id) {
      const room = await supabase.from("classrooms" as never).select("id" as never).eq("id", payload.classroom_id).eq("garden_id", access.gardenId).eq("status", "active").maybeSingle();
      if (!room.data) return fail("הכיתה אינה שייכת לגן או אינה פעילה.", 422);
    }
    const update: Record<string, unknown> = { ...payload, updated_at: new Date().toISOString() };
    if (payload.active_status === "published") update.published_at = new Date().toISOString();
    if (["closed", "filled"].includes(payload.active_status ?? "")) update.closed_at = new Date().toISOString();
    const result = await supabase.from("kindergarten_staff_openings" as never).update(update as never).eq("id", id).eq("garden_id", access.gardenId).select("*" as never).single();
    if (result.error) return fail("עדכון המשרה נכשל.", 400);
    const updatedOpening = result.data as unknown as OpeningRow;
    await supabase.from("audit_logs" as never).insert({ actor_id: access.session.profile.id, actor_role: access.session.profile.role, garden_id: access.gardenId, entity_type: "kindergarten_staff_openings", entity_id: id, action: "staff_opening_updated", after_data: { active_status: updatedOpening.active_status } } as never);
    return ok({ opening: result.data });
  } catch (error) { return handleRouteError(error); }
}
