import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { authCallbackUrl } from "@/lib/domain/auth-flow";
import { normalizeInvitationEmail, resolveSignedInvitation } from "@/lib/management/signed-invitation";
import { checkEmailConflict, normalizeOptionalEmail } from "@/lib/onboarding/user-provisioning";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  account_type: z.enum(["parent", "staff_candidate", "inspector_candidate", "kindergarten_manager"]),
  full_name: z.string().min(2),
  email: z.preprocess((value) => normalizeOptionalEmail(value as string | null), z.string().email()),
  phone: z.string().optional(),
  city: z.string().optional(),
  password: z.string().min(8),
  invitation_token: z.string().min(40).max(2048).optional()
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
    const resolvedInvitation = payload.invitation_token ? await resolveSignedInvitation(admin, payload.invitation_token) : null;
    if (resolvedInvitation && !resolvedInvitation.ok) return fail("ההזמנה אינה זמינה.", 410);
    if (resolvedInvitation?.ok && (payload.account_type !== "parent" || resolvedInvitation.invitation.intended_role !== "parent")) return fail("ההזמנה אינה מתאימה למסלול ההרשמה.", 403);
    if (resolvedInvitation?.ok && normalizeInvitationEmail(resolvedInvitation.invitation.recipient_email) !== normalizeInvitationEmail(payload.email)) return fail("יש להירשם עם כתובת הדוא״ל שאליה נשלחה ההזמנה.", 403);
    if (resolvedInvitation?.ok && resolvedInvitation.invitation.target_profile_id) return fail("ההזמנה כבר קושרה לחשבון קיים.", 409);
    const conflict = await checkEmailConflict({ supabase: admin, email: payload.email, field: "email" });
    if (conflict) return fail(conflict.message, 409, { field: conflict.field, source: conflict.source });

    const role = appRoleFor(payload.account_type);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        emailRedirectTo: authCallbackUrl("gan_batuach", "/app/verify-contact", "verify"),
        data: { full_name: payload.full_name, phone: payload.phone ?? null, self_service: true }
      }
    });
    if (error || !data.user || data.user.identities?.length === 0) return fail("לא ניתן להשלים את ההרשמה.", 400);

    const authPolicy = await admin.auth.admin.updateUserById(data.user.id, {
      app_metadata: { role, self_service_role: payload.account_type, contact_verification_required: true }
    });
    if (authPolicy.error) {
      await admin.auth.admin.deleteUser(data.user.id);
      return fail("לא ניתן להגדיר את מדיניות אימות החשבון.", 400);
    }

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
      self_service_registered_at: new Date().toISOString(),
      contact_verification_required: true,
      email_verified_at: data.user.email_confirmed_at ?? null,
      phone_verified_at: data.user.phone_confirmed_at ?? null
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
      verification_status: { email: data.user.email_confirmed_at ? "verified" : "pending", phone: "pending", mfa: "not_required" },
      metadata: { registration_source: "self_service", contact_verification_required: true }
    }, { onConflict: "profile_id" });
    if (selfServiceWrite.error) {
      await admin.auth.admin.deleteUser(data.user.id);
      return fail("הפרופיל המוגבל לא נשמר: " + selfServiceWrite.error.message, 400);
    }

    if (resolvedInvitation?.ok) {
      const invitation = resolvedInvitation.invitation;
      const bound = await admin.from("management_invitations").update({ target_profile_id: data.user.id, updated_at: new Date().toISOString() }).eq("id", invitation.id).is("target_profile_id", null).in("status", ["pending", "delivered"]);
      if (bound.error) {
        await admin.auth.admin.deleteUser(data.user.id);
        return fail("לא ניתן לקשר את החשבון להזמנה.", 409);
      }
      if (invitation.legacy_affiliation_request_id) {
        const legacy = await admin.from("user_affiliation_requests").select("metadata").eq("id", invitation.legacy_affiliation_request_id).maybeSingle();
        if (legacy.data) await admin.from("user_affiliation_requests").update({ metadata: { ...legacy.data.metadata, invited_parent_profile_id: data.user.id, registered_from_signed_invitation: true }, updated_at: new Date().toISOString() }).eq("id", invitation.legacy_affiliation_request_id);
      }
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
      next_path: "/app/verify-contact"
    }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
