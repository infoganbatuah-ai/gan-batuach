import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const idSchema = z.string().uuid();

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const gardenId = access.session.profile.garden_id;
    if (!gardenId) return fail("לא נמצא גן משויך.", 422);
    if (!isAdminClientConfigured()) return fail("שירות ההזמנות אינו זמין כרגע.", 503);
    const id = idSchema.parse((await context.params).id);
    const now = new Date().toISOString();
    const admin = createAdminClient();
    const result = await admin.from("management_invitations").update({
      status: "revoked", revoked_at: now, revoked_by: access.session.profile.id, updated_at: now
    }).eq("id", id).eq("garden_id", gardenId).in("status", ["pending", "delivered"]).select("id,status,revoked_at").maybeSingle();
    if (result.error) throw new Error(result.error.message);
    if (!result.data) return fail("ההזמנה אינה פעילה או אינה שייכת לגן.", 404);
    await admin.from("audit_logs").insert({
      actor_id: access.session.profile.id, actor_role: access.session.profile.role, garden_id: gardenId,
      entity_type: "management_invitations", entity_id: id, action: "signed_invitation_revoked",
      after_data: { status: "revoked" }
    });
    return ok({ invitation: result.data });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
