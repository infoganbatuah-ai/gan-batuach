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
  manager: provisionedUserSchema,
  owner: provisionedUserSchema.optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const manager = await provisionAuthUser({ role: "manager", fullName: payload.manager.full_name, email: payload.manager.email, phone: payload.manager.phone, temporaryPassword: payload.manager.temporary_password });
    const owner = payload.owner?.email ? await provisionAuthUser({ role: "owner", fullName: payload.owner.full_name, email: payload.owner.email, phone: payload.owner.phone, temporaryPassword: payload.owner.temporary_password }) : null;

    const gardenInsert: Database["public"]["Tables"]["gardens"]["Insert"] & { owner_profile_id?: string | null } = {
      ...payload.garden,
      email: payload.garden.email,
      manager_id: manager.user.id,
      owner_profile_id: owner?.user.id ?? null,
      status: "active",
      safe_status: "pending_review",
      public_profile_enabled: true
    };

    const { data: garden, error: gardenError } = await manager.supabase.from("gardens").insert(gardenInsert as Database["public"]["Tables"]["gardens"]["Insert"]).select("*").single();
    if (gardenError) return fail(gardenError.message, 400);

    const managerProfile: Database["public"]["Tables"]["profiles"]["Insert"] = { id: manager.user.id, role: "manager", garden_id: garden.id, full_name: payload.manager.full_name, phone: payload.manager.phone ?? null, active: true, must_change_password: true };
    const { error: managerProfileError } = await manager.supabase.from("profiles").upsert(managerProfile, { onConflict: "id" });
    if (managerProfileError) return fail(managerProfileError.message, 400);

    if (owner && payload.owner) {
      const ownerProfile: Database["public"]["Tables"]["profiles"]["Insert"] = { id: owner.user.id, role: "owner", garden_id: garden.id, full_name: payload.owner.full_name, phone: payload.owner.phone ?? null, active: true, must_change_password: true };
      const { error: ownerProfileError } = await manager.supabase.from("profiles").upsert(ownerProfile, { onConflict: "id" });
      if (ownerProfileError) return fail(ownerProfileError.message, 400);
    }

    await writeUserCreationAudit({ actorId: profile.id, actorRole: "admin", gardenId: garden.id, entityType: "gardens", entityId: garden.id, action: "create_garden_manager_owner", afterData: { garden_id: garden.id, manager_user_id: manager.user.id, owner_user_id: owner?.user.id ?? null } });
    return ok({ garden, manager_user_id: manager.user.id, owner_user_id: owner?.user.id ?? null, credentials: { manager: manager.oneTimeCredentials, owner: owner?.oneTimeCredentials ?? null } }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
