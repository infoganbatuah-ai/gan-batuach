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

    const { data: staff, error: readError } = await supabase
      .from("staff")
      .select("*")
      .eq("id", id)
      .eq("garden_id", profile.garden_id)
      .single();

    if (readError || !staff) return fail(readError?.message ?? "Staff member not found", 404);
    if (staff.background_check_status !== "valid" || staff.police_clearance_status !== "valid") {
      return fail("Cannot approve staff before background check and police clearance are valid", 422);
    }

    const { data, error } = await supabase.from("staff").update({ approved_to_work: true }).eq("id", id).select("*").single();
    if (error) return fail(error.message, 400);

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: profile.role,
      gardenId: profile.garden_id,
      entityType: "staff",
      entityId: id,
      action: "approve_staff_user",
      afterData: { staff_id: id, approved_to_work: true }
    });

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
