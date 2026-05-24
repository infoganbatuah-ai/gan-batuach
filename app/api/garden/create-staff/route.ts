import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { provisionAuthUser, provisionedUserSchema, writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const schema = provisionedUserSchema.extend({
  role_title: z.string().min(2),
  identity_number: z.string().optional(),
  address: z.string().optional(),
  class_group: z.string().optional(),
  start_date: z.string().optional(),
  notes: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    if (!profile.garden_id) return fail("Manager is not assigned to a garden", 422);
    const payload = schema.parse(await request.json());
    const { supabase, user, oneTimeCredentials } = await provisionAuthUser({
      role: "staff",
      gardenId: profile.garden_id,
      fullName: payload.full_name,
      email: payload.email,
      phone: payload.phone,
      temporaryPassword: payload.temporary_password
    });

    const { data: staff, error } = await supabase
      .from("staff")
      .insert({
        profile_id: user.id,
        garden_id: profile.garden_id,
        full_name: payload.full_name,
        role_title: payload.role_title,
        identity_number: payload.identity_number,
        phone: payload.phone,
        email: payload.email,
        address: payload.address,
        class_group: payload.class_group,
        start_date: payload.start_date || null,
        notes: payload.notes,
        approved_to_work: false,
        background_check_status: "missing",
        police_clearance_status: "missing"
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 400);

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: profile.role,
      gardenId: profile.garden_id,
      entityType: "staff",
      entityId: staff.id as string,
      action: "create_staff_user",
      afterData: { staff_id: staff.id, staff_user_id: user.id, approval_status: "pending_documents" }
    });

    return ok({ staff, credentials: oneTimeCredentials }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
