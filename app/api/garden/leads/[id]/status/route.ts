import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  status: z.enum(["new", "viewed", "missing_details", "parent_approved_pending_child_completion", "approved_pending_parent_completion", "converted", "active", "rejected"]),
  missing_details: z.array(z.string()).optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const { profile } = access.session;
    if (!profile.garden_id) return fail("לא נמצא גן משויך", 422);
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    const supabase = isAdminClientConfigured() ? createAdminClient() : await createClient();
    const patch: Record<string, unknown> = { status: payload.status };
    if (payload.missing_details) patch.missing_details = payload.missing_details;
    const { data, error } = await supabase
      .from("leads" as any)
      .update(patch)
      .eq("id", id)
      .eq("garden_id", profile.garden_id)
      .eq("lead_type", "parent")
      .select("*")
      .single();
    if (error) return fail("לא ניתן לעדכן סטטוס ליד כרגע", 400);
    await supabase.from("audit_logs" as any).insert({ actor_id: profile.id, actor_role: profile.role, garden_id: profile.garden_id, entity_type: "leads", entity_id: id, action: `parent_lead_${payload.status}`, after_data: payload });
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
