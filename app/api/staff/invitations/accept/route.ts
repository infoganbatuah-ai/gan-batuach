import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { managementContactVerification } from "@/lib/management/contact-verification";
import { normalizeInvitationEmail, resolveSignedInvitation } from "@/lib/management/signed-invitation";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ token: z.string().min(40).max(2048) });

export async function POST(request: Request) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile) return fail("נדרשת התחברות מחדש.", 401);
    if (session.profile.role !== "staff") return fail("ההזמנה אינה מיועדת לתפקיד המשתמש.", 403);
    if (!isAdminClientConfigured()) return fail("שירות ההזמנות אינו זמין כרגע.", 503);
    const { token } = schema.parse(await request.json()); const admin = createAdminClient(); const resolved = await resolveSignedInvitation(admin, token);
    if (!resolved.ok) return fail("ההזמנה אינה זמינה או שפג תוקפה.", 410);
    const invitation = resolved.invitation;
    if (invitation.invitation_type !== "staff" || invitation.intended_role !== "staff") return fail("ההזמנה אינה הזמנת צוות.", 403);
    const verifiedEmail = session.user.email_confirmed_at ? normalizeInvitationEmail(session.user.email) : null;
    if (!verifiedEmail || verifiedEmail !== normalizeInvitationEmail(invitation.recipient_email)) return fail("ההזמנה אינה תואמת לדוא״ל המאומת בחשבון.", 403);
    if (invitation.target_profile_id && invitation.target_profile_id !== session.profile.id) return fail("ההזמנה משויכת למשתמש אחר.", 403);
    if (!managementContactVerification(session.user, session.profile).complete) return fail("יש להשלים אימות דוא״ל וטלפון לפני קבלת ההזמנה.", 409);
    const completeness = await admin.from("staff_candidate_profiles").select("profile_completeness,qualification_keys").eq("profile_id", session.profile.id).maybeSingle();
    if (!completeness.data || completeness.data.profile_completeness?.required_fields_complete !== true) return fail("יש להשלים את הפרופיל המקצועי והמסמכים לפני קבלת ההזמנה.", 409);
    const openingId = String(invitation.payload?.opening_id ?? "");
    const opening = await admin.from("kindergarten_staff_openings").select("id,garden_id,role_needed,classroom_id,qualification_keys,active_status").eq("id", openingId).eq("garden_id", invitation.garden_id).eq("active_status", "published").maybeSingle();
    if (!opening.data) return fail("המשרה שבהזמנה אינה פתוחה עוד.", 409);
    if (!(opening.data.qualification_keys ?? []).every((key: string) => (completeness.data?.qualification_keys ?? []).includes(key))) return fail("חסרה הסמכה שנדרשת למשרה.", 409);
    const now = new Date().toISOString();
    let applicationId = invitation.staff_application_id as string | null;
    if (!applicationId) {
      const created = await admin.from("staff_job_applications").insert({ staff_candidate_id: session.profile.id, garden_id: invitation.garden_id, opening_id: opening.data.id, classroom_id: invitation.payload?.classroom_id ?? opening.data.classroom_id, invitation_id: invitation.id, requested_role: invitation.payload?.role ?? opening.data.role_needed, status: "awaiting_candidate_acceptance", reviewed_at: now, reviewed_by: invitation.created_by, manager_decision: "garden_invitation", requirement_snapshot: { role: opening.data.role_needed, qualification_keys: opening.data.qualification_keys }, metadata: { source: "signed_staff_invitation" } }).select("id").single();
      if (created.error) return fail("לא ניתן לחבר את ההזמנה למסלול ההעסקה.", 409); applicationId = created.data.id;
    }
    await admin.from("management_invitations").update({ target_profile_id: session.profile.id, staff_application_id: applicationId, updated_at: now }).eq("id", invitation.id).in("status", ["pending","delivered"]);
    await admin.from("staff_job_applications").update({ invitation_id: invitation.id, status: "awaiting_candidate_acceptance", updated_at: now }).eq("id", applicationId).eq("staff_candidate_id", session.profile.id).neq("status", "employed");
    const supabase = await createClient(); const activation = await supabase.rpc("activate_staff_employment", { target_application_id: applicationId, target_invitation_id: invitation.id });
    if (activation.error) return fail("ההזמנה אומתה, אך ההעסקה לא הופעלה. אפשר לנסות שוב בבטחה.", 409);
    return ok(activation.data);
  } catch (error) { return handleSafeRouteError(error); }
}
