import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    if (!profile.garden_id) return fail("Manager is not assigned to a garden", 422);
    const { id } = await context.params;
    const supabase = createAdminClient();

    const { data: child, error } = await supabase
      .from("children")
      .update({ status: "active", manager_approved_at: new Date().toISOString() })
      .eq("id", id)
      .eq("garden_id", profile.garden_id)
      .select("*")
      .single();

    if (error) return fail(error.message, 400);

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: profile.role,
      gardenId: profile.garden_id,
      entityType: "children",
      entityId: id,
      action: "approve_child_registration",
      afterData: { child_id: id, status: "active" }
    });

    return ok({ child });
  } catch (error) {
    return handleRouteError(error);
  }
}
