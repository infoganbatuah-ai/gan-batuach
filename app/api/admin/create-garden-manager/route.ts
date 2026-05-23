import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import type { Database } from "@/lib/supabase/types";
import { provisionAuthUser, provisionedUserSchema, writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const schema = z.object({
  garden: z.object({
    name: z.string().min(2),
    city: z.string().min(2),
    address: z.string().optional(),
    framework_type: z.string().default("mixed"),
    children_capacity: z.number().int().min(0).default(0),
    owner_name: z.string().min(2),
    phone: z.string().optional(),
    email: z.string().email()
  }),
  manager: provisionedUserSchema
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const { supabase, user, oneTimeCredentials } = await provisionAuthUser({
      role: "manager",
      fullName: payload.manager.full_name,
      email: payload.manager.email,
      phone: payload.manager.phone,
      temporaryPassword: payload.manager.temporary_password
    });

    const gardenInsert: Database["public"]["Tables"]["gardens"]["Insert"] = {
      ...payload.garden,
      email: payload.garden.email,
      manager_id: user.id,
      status: "active",
      safe_status: "pending_review",
      public_profile_enabled: true
    };

    const { data: garden, error: gardenError } = await supabase.from("gardens").insert(gardenInsert).select("*").single();
    if (gardenError) return fail(gardenError.message, 400);

    const profileUpdate: Database["public"]["Tables"]["profiles"]["Update"] = {
      role: "manager",
      garden_id: garden.id,
      full_name: payload.manager.full_name,
      phone: payload.manager.phone,
      must_change_password: true
    };

    const { error: profileError } = await supabase.from("profiles").update(profileUpdate).eq("id", user.id);
    if (profileError) return fail(profileError.message, 400);

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: "admin",
      gardenId: garden.id,
      entityType: "gardens",
      entityId: garden.id,
      action: "create_garden_and_manager",
      afterData: { garden_id: garden.id, manager_user_id: user.id }
    });

    return ok({ garden, manager_user_id: user.id, credentials: oneTimeCredentials }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
