import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { managementContactVerification } from "@/lib/management/contact-verification";
import { normalizeInvitationEmail, resolveSignedInvitation } from "@/lib/management/signed-invitation";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.object({ token: z.string().min(40).max(2048) });

export async function POST(request: Request) {
  try {
    const { user, profile } = await requireRole(["parent"], "/app/login");
    if (!isAdminClientConfigured()) return fail("שירות ההזמנות אינו זמין כרגע.", 503);
    const { token } = schema.parse(await request.json());
    const admin = createAdminClient();
    const resolved = await resolveSignedInvitation(admin, token);
    if (!resolved.ok) return fail("ההזמנה אינה זמינה.", 410);
    const invitation = resolved.invitation;
    if (invitation.intended_role !== "parent") return fail("ההזמנה אינה מיועדת לחשבון הורה.", 403);
    const verifiedEmail = user.email_confirmed_at ? normalizeInvitationEmail(user.email) : null;
    if (!verifiedEmail || verifiedEmail !== normalizeInvitationEmail(invitation.recipient_email)) return fail("ההזמנה אינה תואמת לדוא״ל המאומת בחשבון.", 403);
    if (invitation.target_profile_id && invitation.target_profile_id !== profile.id) return fail("ההזמנה כבר קושרה לחשבון אחר.", 409);

    const now = new Date().toISOString();
    const bound = await admin.from("management_invitations").update({ target_profile_id: profile.id, updated_at: now })
      .eq("id", invitation.id).is("target_profile_id", null).in("status", ["pending", "delivered"]);
    if (bound.error) throw new Error(bound.error.message);
    if (invitation.legacy_affiliation_request_id) {
      const legacy = await admin.from("user_affiliation_requests").select("metadata").eq("id", invitation.legacy_affiliation_request_id).maybeSingle();
      if (legacy.data) await admin.from("user_affiliation_requests").update({ metadata: { ...legacy.data.metadata, invited_parent_profile_id: profile.id, claimed_at: now }, updated_at: now }).eq("id", invitation.legacy_affiliation_request_id);
    }
    await admin.from("audit_logs").insert({ actor_id: profile.id, actor_role: "parent", garden_id: invitation.garden_id, entity_type: "management_invitations", entity_id: invitation.id, action: "signed_invitation_claimed", after_data: { contact_verification_complete: managementContactVerification(user, profile).complete } });
    return ok({ claimed: true, next_path: "/dashboard/parent" });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
