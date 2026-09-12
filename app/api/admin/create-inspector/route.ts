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
    if (payload.garden_ids?.length) return fail("יש לאשר את בקשת המפקח לפני שיוך גנים.", 409);
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

    const application = await supabase.from("inspector_applications" as never).insert({
      profile_id: user.id,
      full_name: payload.full_name,
      phone: payload.phone ?? null,
      email: inspectorEmail ?? null,
      city: payload.service_cities[0],
      preferred_regions: payload.service_cities,
      experience_summary: payload.certification_notes ?? null,
      status: "submitted",
      submitted_at: new Date().toISOString()
    });
    if (application.error) {
      await cleanupProvisionedInspector(user.id);
      return fail("לא ניתן לפתוח בקשת מפקח לבדיקה: " + application.error.message, 400);
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
