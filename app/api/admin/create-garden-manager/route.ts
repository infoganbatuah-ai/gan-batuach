import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import type { Database } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { DuplicateContactError, checkEmailConflict, normalizeOptionalEmail, provisionAuthUser, provisionedUserSchema, writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const schema = z.object({
  source_lead_id: z.string().uuid().optional(),
  garden: z.object({
    name: z.string().min(2),
    city: z.string().min(2),
    address: z.string().optional(),
    gps_lat: z.coerce.number().optional(),
    gps_lng: z.coerce.number().optional(),
    framework_type: z.string().default("mixed"),
    ages: z.array(z.string()).optional(),
    children_capacity: z.number().int().min(0).default(0),
    current_children_count: z.number().int().min(0).default(0),
    staff_count: z.number().int().min(0).default(0),
    owner_name: z.string().min(2),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    inspector_id: z.string().uuid().optional(),
    public_profile_enabled: z.boolean().default(true),
    notes: z.string().optional()
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
    const managerEmail = normalizeOptionalEmail(payload.manager.email);
    const ownerEmail = normalizeOptionalEmail(payload.owner?.email);

    console.info("[create-garden-manager-email-check]", {
      attemptedManagerEmail: payload.manager.email ?? null,
      normalizedManagerEmail: managerEmail ?? null,
      attemptedOwnerEmail: payload.owner?.email ?? null,
      normalizedOwnerEmail: ownerEmail ?? null
    });

    const managerConflict = await checkEmailConflict({ supabase: admin, email: managerEmail, field: "manager_email" });
    if (managerConflict) return fail(managerConflict.message, 409, { field: managerConflict.field, source: managerConflict.source });
    if (ownerEmail && ownerEmail === managerEmail) {
      console.warn("[email-duplicate-check-conflict]", { field: "owner_email", normalizedEmail: ownerEmail, source: "same_as_manager_email" });
      return fail("המייל כבר קיים במערכת", 409, { field: "owner_email", source: "same_as_manager_email" });
    }
    const ownerConflict = await checkEmailConflict({ supabase: admin, email: ownerEmail, field: "owner_email" });
    if (ownerConflict) return fail(ownerConflict.message, 409, { field: ownerConflict.field, source: ownerConflict.source });

    const manager = await provisionAuthUser({ role: "manager", fullName: payload.manager.full_name, email: managerEmail, phone: payload.manager.phone, temporaryPassword: payload.manager.temporary_password, createdBy: profile.id, conflictField: "manager_email" });
    createdAuthUserIds.push(manager.user.id);

    const owner = payload.owner?.full_name && ownerEmail
      ? await provisionAuthUser({ role: "owner", fullName: payload.owner.full_name, email: ownerEmail, phone: payload.owner.phone, temporaryPassword: payload.owner.temporary_password, createdBy: profile.id, conflictField: "owner_email" })
      : null;
    if (owner) createdAuthUserIds.push(owner.user.id);

    const gardenInsert: Database["public"]["Tables"]["gardens"]["Insert"] = {
      name: payload.garden.name,
      city: payload.garden.city,
      address: payload.garden.address || null,
      gps_lat: payload.garden.gps_lat ?? null,
      gps_lng: payload.garden.gps_lng ?? null,
      framework_type: payload.garden.framework_type,
      ages: payload.garden.ages ?? [],
      children_capacity: payload.garden.children_capacity,
      current_children_count: payload.garden.current_children_count,
      staff_count: payload.garden.staff_count,
      owner_name: payload.garden.owner_name,
      phone: payload.garden.phone || null,
      email: payload.garden.email || manager.oneTimeCredentials.email,
      manager_id: manager.user.id,
      owner_profile_id: owner?.user.id ?? null,
      inspector_id: payload.garden.inspector_id ?? null,
      status: "active",
      safe_status: "pending_review",
      first_inspection_due_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      first_inspection_grace_until: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      inspection_required_status: "pending_first_inspection",
      public_profile_enabled: payload.garden.public_profile_enabled,
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
    if (error instanceof DuplicateContactError) {
      return fail(error.message, 409, { field: error.field, source: error.source });
    }
    return handleRouteError(error);
  }
}
