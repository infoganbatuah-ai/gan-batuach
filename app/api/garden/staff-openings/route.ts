import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  role_needed: z.string().min(2),
  age_group: z.string().optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  employment_type: z.string().optional(),
  active_status: z.enum(["draft", "published", "paused", "closed"]).default("published")
});

export async function POST(request: Request) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const { profile } = access.session;
    if (!profile.garden_id) return fail("המנהל/ת לא משויך/ת לגן.", 422);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const write = await supabase.from("kindergarten_staff_openings" as any).insert({
      garden_id: profile.garden_id,
      role_needed: payload.role_needed,
      age_group: payload.age_group ?? null,
      description: payload.description ?? null,
      requirements: payload.requirements ?? null,
      employment_type: payload.employment_type ?? null,
      active_status: payload.active_status,
      created_by: profile.id
    }).select("*").single();
    if (write.error) return fail(write.error.message, 400);
    await supabase.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: profile.role,
      garden_id: profile.garden_id,
      entity_type: "kindergarten_staff_openings",
      entity_id: write.data.id,
      action: "staff_opening_created",
      after_data: { active_status: payload.active_status, role_needed: payload.role_needed }
    });
    return ok({ opening: write.data }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
