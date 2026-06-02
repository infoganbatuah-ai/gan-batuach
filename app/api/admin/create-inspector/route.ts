import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DuplicateContactError, checkEmailConflict, normalizeOptionalEmail, provisionAuthUser, provisionedUserSchema, writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const schema = provisionedUserSchema.extend({
  source_lead_id: z.string().uuid().optional(),
  profile_image_url: z.string().url(),
  identity_number: z.string().min(5),
  service_cities: z.array(z.string().min(2)).min(1),
  garden_ids: z.array(z.string().uuid()).optional(),
  certification_notes: z.string().optional()
});

function debugLogsEnabled() {
  return process.env.NODE_ENV !== "production";
}

async function cleanupProvisionedInspector(userId: string) {
  const admin = createAdminClient();
  try {
    await admin.from("inspectors" as any).delete().eq("id", userId);
    await admin.from("generated_credentials" as any).delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
  } catch (error) {
    console.error("[create-inspector-cleanup-failed]", { user_id: userId, error });
  }
}

export async function POST(request: Request) {
  let createdUserId: string | null = null;
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const inspectorEmail = normalizeOptionalEmail(payload.email);
    const identityNumber = payload.identity_number.replace(/\D/g, "");
    if (identityNumber.length < 5) return fail("יש להזין תעודת זהות מפקח תקינה.", 422, { field: "identity_number" });
    if (debugLogsEnabled()) console.info("[create-inspector-email-check]", { attemptedEmail: payload.email ?? null, normalizedEmail: inspectorEmail ?? null });
    const conflict = await checkEmailConflict({ supabase: admin, email: inspectorEmail, field: "inspector_email" });
    if (conflict) return fail(conflict.message, 409, { field: conflict.field, source: conflict.source });
    const duplicateIdentity = await admin.from("inspectors" as any).select("id", { count: "exact", head: true }).eq("identity_number", identityNumber);
    if ((duplicateIdentity.count ?? 0) > 0) return fail("מפקח עם תעודת זהות זו כבר קיים במערכת.", 409, { field: "identity_number", source: "inspectors.identity_number" });
    const { supabase, user, oneTimeCredentials } = await provisionAuthUser({
      role: "inspector",
      fullName: payload.full_name,
      email: inspectorEmail,
      phone: payload.phone,
      temporaryPassword: payload.temporary_password,
      createdBy: profile.id,
      conflictField: "inspector_email"
    });
    createdUserId = user.id;

    const { data: inspector, error } = await supabase
      .from("inspectors")
      .upsert({ id: user.id, identity_number: identityNumber, service_cities: payload.service_cities, certification_notes: payload.certification_notes ?? null, profile_photo_url: payload.profile_image_url }, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      await cleanupProvisionedInspector(user.id);
      return fail("לא ניתן ליצור רשומת פקח: " + error.message, 400);
    }

    if (payload.garden_ids?.length) {
      const assignment = await supabase.from("gardens").update({ inspector_id: user.id }).in("id", payload.garden_ids).select("id");
      if (assignment.error || (assignment.data?.length ?? 0) !== payload.garden_ids.length) {
        await cleanupProvisionedInspector(user.id);
        return fail("המפקח נוצר, אך שיוך הגנים לא נשמר במלואו. הפעולה בוטלה כדי למנוע הצלחה שגויה.", 409, { expected: payload.garden_ids.length, assigned: assignment.data?.length ?? 0, error: assignment.error?.message });
      }
    }

    if (payload.profile_image_url || identityNumber) {
      const { error: profilePhotoError } = await supabase.from("profiles").update({ profile_image_url: payload.profile_image_url, identity_number: identityNumber }).eq("id", user.id);
      if (profilePhotoError) console.error("[create-inspector-profile-sync-failed]", { user_id: user.id, message: profilePhotoError.message });
    }

    if (payload.source_lead_id) {
      await supabase.from("leads").update({ status: "converted", converted_entity_id: user.id, converted_at: new Date().toISOString() }).eq("id", payload.source_lead_id);
    }

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: "admin",
      entityType: "inspectors",
      entityId: user.id,
      action: payload.source_lead_id ? "convert_inspector_lead_to_active_inspector" : "create_inspector_user",
      afterData: { inspector_user_id: user.id, identity_number: identityNumber, service_cities: payload.service_cities, garden_ids: payload.garden_ids ?? [], source_lead_id: payload.source_lead_id ?? null }
    });

    return ok({ inspector, credentials: oneTimeCredentials }, 201);
  } catch (error) {
    if (createdUserId) {
      await cleanupProvisionedInspector(createdUserId);
    }
    if (error instanceof DuplicateContactError) {
      return fail(error.message, 409, { field: error.field, source: error.source });
    }
    return handleRouteError(error);
  }
}
