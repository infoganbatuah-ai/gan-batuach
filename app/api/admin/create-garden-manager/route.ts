import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import type { Database } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionAuthUser, provisionedUserSchema, writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const schema = z.object({
  source_lead_id: z.string().uuid().optional(),
  garden: z.object({
    name: z.string().min(2),
    city: z.string().min(2),
    address: z.string().optional(),
    framework_type: z.string().default("mixed"),
    children_capacity: z.number().int().min(0).default(0),
    staff_count: z.number().int().min(0).default(0),
    owner_name: z.string().min(2),
    phone: z.string().optional(),
    email: z.string().email().optional()
  }),
  manager: provisionedUserSchema,
  owner: provisionedUserSchema.optional()
});

export async function POST(request: Request) {
  const createdAuthUserIds: string[] = [];
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();

    const manager = await provisionAuthUser({ role: "manager", fullName: payload.manager.full_name, email: payload.manager.email, phone: payload.manager.phone, temporaryPassword: payload.manager.temporary_password });
    createdAuthUserIds.push(manager.user.id);

    const owner = payload.owner?.full_name
      ? await provisionAuthUser({ role: "owner", fullName: payload.owner.full_name, email: payload.owner.email, phone: payload.owner.phone, temporaryPassword: payload.owner.temporary_password })
      : null;
    if (owner) createdAuthUserIds.push(owner.user.id);

    const gardenInsert: Database["public"]["Tables"]["gardens"]["Insert"] = {
      name: payload.garden.name,
      city: payload.garden.city,
      address: payload.garden.address || null,
      framework_type: payload.garden.framework_type,
      children_capacity: payload.garden.children_capacity,
      staff_count: payload.garden.staff_count,
      owner_name: payload.garden.owner_name,
      phone: payload.garden.phone || null,
      email: payload.garden.email || manager.oneTimeCredentials.email,
      manager_id: manager.user.id,
      owner_profile_id: owner?.user.id ?? null,
      status: "active",
      safe_status: "pending_review",
      public_profile_enabled: true,
      eligible_for_safe_status: false
    } as Database["public"]["Tables"]["gardens"]["Insert"];

    const { data: garden, error: gardenError } = await admin.from("gardens").insert(gardenInsert).select("*").single();
    if (gardenError || !garden) {
      for (const userId of createdAuthUserIds) await admin.auth.admin.deleteUser(userId);
      return fail("לא ניתן ליצור את הגן: " + (gardenError?.message ?? "שגיאה לא ידועה"), 400);
    }

    const { error: managerProfileError } = await admin.from("profiles").update({ garden_id: garden.id }).eq("id", manager.user.id);
    if (managerProfileError) return fail("הגן נוצר אך שיוך המנהלת נכשל: " + managerProfileError.message, 400);

    if (owner) {
      const { error: ownerProfileError } = await admin.from("profiles").update({ garden_id: garden.id }).eq("id", owner.user.id);
      if (ownerProfileError) return fail("הגן נוצר אך שיוך הבעלים נכשל: " + ownerProfileError.message, 400);
    }

    if (payload.source_lead_id) {
      await admin.from("leads").update({ status: "converted", converted_entity_id: garden.id, converted_at: new Date().toISOString() }).eq("id", payload.source_lead_id);
    }

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: "admin",
      gardenId: garden.id,
      entityType: "gardens",
      entityId: garden.id,
      action: payload.source_lead_id ? "convert_garden_lead_to_active_garden" : "create_garden_manager_owner",
      afterData: { garden_id: garden.id, manager_user_id: manager.user.id, owner_user_id: owner?.user.id ?? null, source_lead_id: payload.source_lead_id ?? null }
    });

    return ok({ garden, manager_user_id: manager.user.id, owner_user_id: owner?.user.id ?? null, credentials: { manager: manager.oneTimeCredentials, owner: owner?.oneTimeCredentials ?? null } }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
