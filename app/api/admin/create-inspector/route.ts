import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionAuthUser, provisionedUserSchema, writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const schema = provisionedUserSchema.extend({
  source_lead_id: z.string().uuid().optional(),
  service_cities: z.array(z.string().min(2)).min(1),
  garden_ids: z.array(z.string().uuid()).optional(),
  certification_notes: z.string().optional()
});

export async function POST(request: Request) {
  let createdUserId: string | null = null;
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const { supabase, user, oneTimeCredentials } = await provisionAuthUser({
      role: "inspector",
      fullName: payload.full_name,
      email: payload.email,
      phone: payload.phone,
      temporaryPassword: payload.temporary_password,
      createdBy: profile.id
    });
    createdUserId = user.id;

    const { data: inspector, error } = await supabase
      .from("inspectors")
      .upsert({ id: user.id, service_cities: payload.service_cities, certification_notes: payload.certification_notes ?? null }, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      await supabase.auth.admin.deleteUser(user.id);
      return fail("לא ניתן ליצור רשומת פקח: " + error.message, 400);
    }

    if (payload.garden_ids?.length) {
      await supabase.from("gardens").update({ inspector_id: user.id }).in("id", payload.garden_ids);
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
      afterData: { inspector_user_id: user.id, service_cities: payload.service_cities, garden_ids: payload.garden_ids ?? [], source_lead_id: payload.source_lead_id ?? null }
    });

    return ok({ inspector, credentials: oneTimeCredentials }, 201);
  } catch (error) {
    if (createdUserId) {
      try { await createAdminClient().auth.admin.deleteUser(createdUserId); } catch {}
    }
    return handleRouteError(error);
  }
}
