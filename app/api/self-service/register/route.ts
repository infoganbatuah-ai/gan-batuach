import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { checkEmailConflict, normalizeOptionalEmail } from "@/lib/onboarding/user-provisioning";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.object({
  account_type: z.enum(["parent", "staff_candidate", "inspector_candidate", "kindergarten_manager"]),
  full_name: z.string().min(2),
  email: z.preprocess((value) => normalizeOptionalEmail(value as string | null), z.string().email()),
  phone: z.string().optional(),
  city: z.string().optional(),
  password: z.string().min(8)
});

function appRoleFor(accountType: z.infer<typeof schema>["account_type"]) {
  if (accountType === "staff_candidate") return "staff";
  if (accountType === "inspector_candidate") return "inspector";
  if (accountType === "kindergarten_manager") return "manager";
  return "parent";
}

export async function POST(request: Request) {
  try {
    if (!isAdminClientConfigured()) return fail("הרשמה עצמאית דורשת הגדרת Service Role בצד השרת.", 503);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const conflict = await checkEmailConflict({ supabase: admin, email: payload.email, field: "email" });
    if (conflict) return fail(conflict.message, 409, { field: conflict.field, source: conflict.source });

    const role = appRoleFor(payload.account_type);
    const { data, error } = await admin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: false,
      app_metadata: { role, self_service_role: payload.account_type },
      user_metadata: { full_name: payload.full_name, phone: payload.phone ?? null, self_service: true }
    });
    if (error || !data.user) return fail(error?.message ?? "לא ניתן ליצור משתמש.", 400);

    const status = "pending_affiliation";
    const profileWrite = await admin.from("profiles" as any).upsert({
      id: data.user.id,
      role,
      garden_id: null,
      full_name: payload.full_name,
      phone: payload.phone ?? null,
      email: payload.email,
      username: payload.email,
      active: false,
      must_change_password: false,
      self_service_status: status,
      self_service_role: payload.account_type,
      self_service_registered_at: new Date().toISOString()
    }, { onConflict: "id" });
    if (profileWrite.error) {
      await admin.auth.admin.deleteUser(data.user.id);
      return fail("המשתמש נוצר ב-Auth אך יצירת הפרופיל נכשלה: " + profileWrite.error.message, 400);
    }

    const selfServiceWrite = await admin.from("self_service_user_profiles" as any).upsert({
      profile_id: data.user.id,
      requested_role: payload.account_type,
      status,
      full_name: payload.full_name,
      phone: payload.phone ?? null,
      email: payload.email,
      city: payload.city ?? null,
      metadata: { registration_source: "self_service" }
    }, { onConflict: "profile_id" });
    if (selfServiceWrite.error) {
      await admin.auth.admin.deleteUser(data.user.id);
      return fail("הפרופיל המוגבל לא נשמר: " + selfServiceWrite.error.message, 400);
    }

    await admin.from("audit_logs" as any).insert({
      actor_id: data.user.id,
      actor_role: role,
      entity_type: "self_service_user_profiles",
      entity_id: data.user.id,
      action: "self_service_registration",
      after_data: { requested_role: payload.account_type, status }
    });

    return ok({
      user_id: data.user.id,
      role,
      status,
      next_path: role === "parent" ? "/dashboard/parent" : role === "staff" ? "/dashboard/staff" : role === "inspector" ? "/dashboard/inspector/apply" : "/dashboard/garden"
    }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
