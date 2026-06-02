import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import type { Database } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { DuplicateContactError, checkEmailConflict, normalizeOptionalEmail, provisionAuthUser, provisionedUserSchema, writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const ownershipTypes = ["teacher_is_owner", "separate_owner", "teacher_only", "owner_only"] as const;
const provisionedUserWithPhotoSchema = provisionedUserSchema.extend({
  identity_number: z.string().optional(),
  profile_image_url: z.string().url().optional()
});

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
    owner_name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    image_url: z.string().url().optional(),
    logo_url: z.string().url().optional(),
    inspector_id: z.string().uuid().optional(),
    ownership_type: z.enum(ownershipTypes).optional(),
    owner_role_label: z.string().optional(),
    public_profile_enabled: z.boolean().default(true),
    notes: z.string().optional()
  }),
  manager: provisionedUserWithPhotoSchema.optional(),
  owner: provisionedUserWithPhotoSchema.optional()
}).superRefine((payload, ctx) => {
  const ownership = payload.garden.ownership_type ?? "teacher_only";
  if (ownership !== "owner_only") {
    if (!payload.manager?.full_name) ctx.addIssue({ code: "custom", path: ["manager", "full_name"], message: "שם מנהלת/גננת חובה" });
    if (!payload.manager?.email) ctx.addIssue({ code: "custom", path: ["manager", "email"], message: "מייל מנהלת/גננת חובה" });
  }
  if (ownership === "separate_owner" || ownership === "owner_only") {
    if (!payload.owner?.full_name && !payload.garden.owner_name) ctx.addIssue({ code: "custom", path: ["owner", "full_name"], message: "שם בעלים חובה" });
    if (!payload.owner?.email) ctx.addIssue({ code: "custom", path: ["owner", "email"], message: "מייל בעלים חובה" });
  }
});

function debugLogsEnabled() {
  return process.env.NODE_ENV !== "production";
}

export async function POST(request: Request) {
  const createdAuthUserIds: string[] = [];
  let createdGardenId: string | null = null;
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const ownershipType = payload.garden.ownership_type ?? "teacher_only";
    const managerEmail = ownershipType !== "owner_only" ? normalizeOptionalEmail(payload.manager?.email) : undefined;
    const ownerEmail = normalizeOptionalEmail(payload.owner?.email);

    if (debugLogsEnabled()) {
      console.info("[create-garden-manager-email-check]", {
        attemptedManagerEmail: payload.manager?.email ?? null,
        normalizedManagerEmail: managerEmail ?? null,
        attemptedOwnerEmail: payload.owner?.email ?? null,
        normalizedOwnerEmail: ownerEmail ?? null
      });
    }

    const managerConflict = ownershipType !== "owner_only" ? await checkEmailConflict({ supabase: admin, email: managerEmail, field: "manager_email" }) : null;
    if (managerConflict) return fail(managerConflict.message, 409, { field: managerConflict.field, source: managerConflict.source });
    if (ownerEmail && ownerEmail === managerEmail) {
      if (debugLogsEnabled()) console.warn("[email-duplicate-check-conflict]", { field: "owner_email", normalizedEmail: ownerEmail, source: "same_as_manager_email" });
      return fail("המייל כבר קיים במערכת", 409, { field: "owner_email", source: "same_as_manager_email" });
    }
    const ownerConflict = (ownershipType === "separate_owner" || ownershipType === "owner_only") ? await checkEmailConflict({ supabase: admin, email: ownerEmail, field: "owner_email" }) : null;
    if (ownerConflict) return fail(ownerConflict.message, 409, { field: ownerConflict.field, source: ownerConflict.source });
    const identityNumbers = [payload.manager?.identity_number, payload.owner?.identity_number].map((item) => String(item ?? "").replace(/\D/g, "")).filter(Boolean);
    if (identityNumbers.length) {
      const { count } = await admin.from("profiles" as any).select("id", { count: "exact", head: true }).in("identity_number", identityNumbers);
      if ((count ?? 0) > 0) return fail("משתמש מנהלת/בעלים כבר קיים. ניתן להוסיף גן נוסף לחשבון הקיים.", 409, { field: "identity_number" });
    }

    const manager = ownershipType !== "owner_only" && payload.manager
      ? await provisionAuthUser({ role: "manager", fullName: payload.manager.full_name, email: managerEmail, phone: payload.manager.phone, temporaryPassword: payload.manager.temporary_password, createdBy: profile.id, conflictField: "manager_email" })
      : null;
    if (manager) createdAuthUserIds.push(manager.user.id);

    const owner = (ownershipType === "separate_owner" || ownershipType === "owner_only") && payload.owner?.full_name && ownerEmail
      ? await provisionAuthUser({ role: "owner", fullName: payload.owner.full_name, email: ownerEmail, phone: payload.owner.phone, temporaryPassword: payload.owner.temporary_password, createdBy: profile.id, conflictField: "owner_email" })
      : null;
    if (owner) createdAuthUserIds.push(owner.user.id);

    const primaryUser = manager ?? owner;
    if (!primaryUser) return fail("חסר משתמש מנהלת או בעלים ליצירת הגן.", 422);
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
      owner_name: payload.garden.owner_name || owner?.oneTimeCredentials.email || manager?.oneTimeCredentials.email,
      phone: payload.garden.phone || null,
      email: payload.garden.email || primaryUser.oneTimeCredentials.email,
      manager_id: manager?.user.id ?? null,
      owner_profile_id: owner?.user.id ?? null,
      ownership_type: ownershipType,
      owner_role_label: payload.garden.owner_role_label || (ownershipType === "teacher_is_owner" ? "גננת ובעלים" : ownershipType === "separate_owner" ? "בעלים נפרד" : ownershipType === "owner_only" ? "בעלים בלבד" : "מנהלת/גננת"),
      inspector_id: payload.garden.inspector_id ?? null,
      status: "active",
      image_url: payload.garden.image_url ?? payload.garden.logo_url ?? null,
      logo_url: payload.garden.logo_url ?? payload.garden.image_url ?? null,
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
      if (gardenError?.message?.includes("owner_profile_id") || gardenError?.message?.includes("ownership_type") || gardenError?.message?.includes("schema cache")) {
        console.error("[create-garden-schema-mismatch]", { message: gardenError.message, details: gardenError.details, hint: gardenError.hint });
        return fail("סכמת מסד הנתונים לא מעודכנת. יש להריץ את מיגרציית ownership בגני הילדים ואז לרענן את Supabase schema cache.", 500, { field: "gardens_schema", source: "schema_cache", migration: "20260523007000_garden_ownership_schema_alignment.sql" });
      }
      return fail("לא ניתן ליצור את הגן: " + (gardenError?.message ?? "שגיאה לא ידועה"), 400);
    }
    createdGardenId = garden.id;

    if (manager) {
      const { error: managerProfileError } = await admin.from("profiles").update({ garden_id: garden.id, identity_number: payload.manager?.identity_number ? payload.manager.identity_number.replace(/\D/g, "") : null, profile_image_url: payload.manager?.profile_image_url ?? null }).eq("id", manager.user.id);
      if (managerProfileError) {
        await admin.from("gardens").delete().eq("id", garden.id);
        for (const userId of createdAuthUserIds) await admin.auth.admin.deleteUser(userId);
        return fail("שיוך המנהלת נכשל ולכן יצירת הגן בוטלה: " + managerProfileError.message, 400);
      }
    }

    if (owner) {
      const { error: ownerProfileError } = await admin.from("profiles").update({ garden_id: garden.id, identity_number: payload.owner?.identity_number ? payload.owner.identity_number.replace(/\D/g, "") : null, profile_image_url: payload.owner?.profile_image_url ?? null }).eq("id", owner.user.id);
      if (ownerProfileError) {
        await admin.from("gardens").delete().eq("id", garden.id);
        for (const userId of createdAuthUserIds) await admin.auth.admin.deleteUser(userId);
        return fail("שיוך הבעלים נכשל ולכן יצירת הגן בוטלה: " + ownerProfileError.message, 400);
      }
    }

    if (payload.source_lead_id) {
      const leadUpdate = await admin.from("leads").update({ status: "converted", converted_entity_id: garden.id, converted_at: new Date().toISOString() }).eq("id", payload.source_lead_id).select("id").maybeSingle();
      if (leadUpdate.error || !leadUpdate.data) {
        console.error("[create-garden-lead-conversion-failed]", { garden_id: garden.id, source_lead_id: payload.source_lead_id, message: leadUpdate.error?.message ?? "lead not found" });
        return fail("הגן נוצר, אך עדכון סטטוס הליד נכשל. יש לפתוח את הליד ולבדוק אותו ידנית לפני הצגת הצלחה.", 409, { garden_id: garden.id, source_lead_id: payload.source_lead_id });
      }
    }

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: "admin",
      gardenId: garden.id,
      entityType: "gardens",
      entityId: garden.id,
      action: payload.source_lead_id ? "convert_garden_lead_to_active_garden" : "create_garden_manager_owner",
      afterData: { garden_id: garden.id, manager_user_id: manager?.user.id ?? null, owner_user_id: owner?.user.id ?? null, ownership_type: ownershipType, source_lead_id: payload.source_lead_id ?? null }
    });

    return ok({ garden, manager_user_id: manager?.user.id ?? null, owner_user_id: owner?.user.id ?? null, credentials: { manager: manager?.oneTimeCredentials ?? null, owner: owner?.oneTimeCredentials ?? null } }, 201);
  } catch (error) {
    if (createdGardenId) {
      const admin = createAdminClient();
      await admin.from("gardens").delete().eq("id", createdGardenId);
      for (const userId of createdAuthUserIds) await admin.auth.admin.deleteUser(userId);
    }
    if (error instanceof DuplicateContactError) {
      return fail(error.message, 409, { field: error.field, source: error.source });
    }
    return handleRouteError(error);
  }
}
