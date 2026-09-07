import { fail, handleRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const { profile } = access.session;
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
    await supabase.from("child_kindergarten_enrollments" as any).update({
      status: "active",
      manager_approved_at: new Date().toISOString(),
      manager_approved_by: profile.id
    }).eq("child_id", id).eq("garden_id", profile.garden_id);
    await supabase.from("child_timeline_events" as any).insert({
      child_id: id,
      permanent_child_file_id: (child as any).permanent_child_file_id ?? null,
      garden_id: profile.garden_id,
      actor_id: profile.id,
      actor_role: profile.role,
      event_type: "manager_approved_enrollment",
      title: "הגן אישר את הילד",
      description: "הילד הפך לפעיל בגן הנוכחי."
    });

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
