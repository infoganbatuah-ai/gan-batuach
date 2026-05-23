import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { provisionAuthUser, provisionedUserSchema, writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const schema = provisionedUserSchema.extend({
  identity_number: z.string().optional(),
  address: z.string().optional(),
  lead_id: z.string().uuid().optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    if (!profile.garden_id) return fail("Manager is not assigned to a garden", 422);
    const payload = schema.parse(await request.json());
    const { supabase, user, oneTimeCredentials } = await provisionAuthUser({
      role: "parent",
      gardenId: profile.garden_id,
      fullName: payload.full_name,
      email: payload.email,
      phone: payload.phone,
      temporaryPassword: payload.temporary_password
    });

    const { data: parent, error } = await supabase
      .from("parents")
      .insert({
        profile_id: user.id,
        garden_id: profile.garden_id,
        full_name: payload.full_name,
        identity_number: payload.identity_number,
        phone: payload.phone ?? "",
        email: payload.email,
        address: payload.address,
        status: "invited",
        completed_profile: false
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 400);

    if (payload.lead_id) {
      await supabase.from("leads").update({ status: "parent_user_created", assigned_to: user.id }).eq("id", payload.lead_id);
    }

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: "manager",
      gardenId: profile.garden_id,
      entityType: "parents",
      entityId: parent.id as string,
      action: "create_parent_user",
      afterData: { parent_id: parent.id, parent_user_id: user.id, lead_id: payload.lead_id ?? null }
    });

    return ok({ parent, credentials: oneTimeCredentials }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
