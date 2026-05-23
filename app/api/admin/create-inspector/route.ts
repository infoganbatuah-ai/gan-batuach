import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { provisionAuthUser, provisionedUserSchema, writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const schema = provisionedUserSchema.extend({
  service_cities: z.array(z.string().min(2)).min(1),
  certification_notes: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const { supabase, user, oneTimeCredentials } = await provisionAuthUser({
      role: "inspector",
      fullName: payload.full_name,
      email: payload.email,
      phone: payload.phone,
      temporaryPassword: payload.temporary_password
    });

    const { data: inspector, error } = await supabase
      .from("inspectors")
      .insert({ id: user.id, service_cities: payload.service_cities, certification_notes: payload.certification_notes })
      .select("*")
      .single();

    if (error) return fail(error.message, 400);

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: "admin",
      entityType: "inspectors",
      entityId: user.id,
      action: "create_inspector_user",
      afterData: { inspector_user_id: user.id, service_cities: payload.service_cities }
    });

    return ok({ inspector, credentials: oneTimeCredentials }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
