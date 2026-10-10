import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { writeAdminActionEvent } from "@/lib/security/audit-log-service";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  birth_date: z.string().date().optional().nullable(),
  hmo: z.string().trim().max(80).optional().nullable()
}).strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const existing = await supabase.from("children" as never).select("id" as never).eq("id", id).eq("garden_id", access.gardenId).maybeSingle();
    if (!existing.data) return fail("כרטיס הילד לא נמצא בגן שנבחר", 404);
    const result = await supabase.from("children" as never).update({
      full_name: payload.full_name,
      birth_date: payload.birth_date ?? null,
      hmo: payload.hmo ?? null,
      updated_at: new Date().toISOString()
    } as never).eq("id", id).eq("garden_id", access.gardenId).select("id,full_name,birth_date,hmo" as never).single();
    if (result.error) return fail("לא ניתן לעדכן את פרטי הילד כרגע", 409);
    await writeAdminActionEvent({
      eventType: "child_profile_updated",
      actorProfileId: access.session.profile.id,
      actorRole: access.session.profile.role,
      targetType: "child",
      targetId: id,
      gardenId: access.gardenId,
      riskLevel: "low",
      metadata: { fields: ["full_name", "birth_date", "hmo"] }
    });
    return ok(result.data);
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
