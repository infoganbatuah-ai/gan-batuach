import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { deliverSignedInvitation } from "@/lib/management/invitation-delivery";
import { createSignedInvitation, normalizeInvitationEmail } from "@/lib/management/signed-invitation";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.object({ email: z.string().trim().email(), phone: z.string().trim().optional(), full_name: z.string().trim().min(2).max(150), opening_id: z.string().uuid(), classroom_id: z.string().uuid().optional().nullable() });

export async function POST(request: Request) {
  try {
    const access = await getManagementGardenContext(); if (!access.allowed) return access.response;
    if (!isAdminClientConfigured()) return fail("שירות ההזמנות אינו זמין כרגע.", 503);
    const payload = schema.parse(await request.json()); const admin = createAdminClient(); const email = normalizeInvitationEmail(payload.email)!;
    const [openingRes, existingRes, gardenRes] = await Promise.all([
      admin.from("kindergarten_staff_openings").select("id,garden_id,role_needed,classroom_id,qualification_keys,active_status").eq("id", payload.opening_id).eq("garden_id", access.gardenId).eq("active_status", "published").maybeSingle(),
      admin.from("profiles").select("id,role,email").eq("email", email).maybeSingle(),
      admin.from("gardens").select("id,name").eq("id", access.gardenId).single()
    ]);
    if (!openingRes.data || !gardenRes.data) return fail("המשרה אינה פתוחה בגן שנבחר.", 404);
    if (existingRes.data && existingRes.data.role !== "staff") return fail("כתובת הדוא״ל שייכת לתפקיד משתמש אחר.", 409);
    const classroomId = payload.classroom_id ?? openingRes.data.classroom_id;
    if (classroomId) { const room = await admin.from("classrooms").select("id").eq("id", classroomId).eq("garden_id", access.gardenId).eq("status", "active").maybeSingle(); if (!room.data) return fail("הכיתה אינה שייכת לגן.", 422); }
    let applicationId: string | null = null;
    if (existingRes.data) {
      const prior = await admin.from("staff_job_applications").select("id,status").eq("staff_candidate_id", existingRes.data.id).eq("opening_id", openingRes.data.id).in("status", ["draft","submitted","under_review","information_required","resubmitted","approved","awaiting_candidate_acceptance","accepted","employed"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (prior.data) applicationId = prior.data.id;
      else {
        const created = await admin.from("staff_job_applications").insert({ staff_candidate_id: existingRes.data.id, garden_id: access.gardenId, opening_id: openingRes.data.id, classroom_id: classroomId, requested_role: openingRes.data.role_needed, status: "awaiting_candidate_acceptance", reviewed_at: new Date().toISOString(), reviewed_by: access.session.profile.id, manager_decision: "garden_invitation", requirement_snapshot: { role: openingRes.data.role_needed, qualification_keys: openingRes.data.qualification_keys, classroom_id: classroomId }, metadata: { source: "signed_staff_invitation" } }).select("id").single();
        if (created.error) return fail("יצירת מסלול ההזמנה נכשלה.", 409); applicationId = created.data.id;
      }
    }
    const signed = await createSignedInvitation(admin, { invitationType: "staff", intendedRole: "staff", gardenId: access.gardenId, targetProfileId: existingRes.data?.id ?? null, recipientEmail: email, recipientPhone: payload.phone, createdBy: access.session.profile.id, payload: { opening_id: openingRes.data.id, classroom_id: classroomId, role: openingRes.data.role_needed, recipient_name: payload.full_name } });
    await admin.from("management_invitations").update({ staff_application_id: applicationId }).eq("id", signed.invitation.id);
    if (applicationId) await admin.from("staff_job_applications").update({ invitation_id: signed.invitation.id, status: "awaiting_candidate_acceptance" }).eq("id", applicationId).neq("status", "employed");
    const delivery = await deliverSignedInvitation(admin, { invitationId: signed.invitation.id, email, recipientName: payload.full_name, gardenId: access.gardenId, gardenName: gardenRes.data.name, targetProfileId: existingRes.data?.id ?? null, url: signed.url });
    await admin.from("audit_logs").insert({ actor_id: access.session.profile.id, actor_role: access.session.profile.role, garden_id: access.gardenId, entity_type: "management_invitations", entity_id: signed.invitation.id, action: "signed_staff_invitation_created", after_data: { opening_id: openingRes.data.id, application_id: applicationId, delivery_status: delivery.status, target_profile_exists: Boolean(existingRes.data) } });
    return ok({ invitation: { id: signed.invitation.id, expires_at: signed.invitation.expires_at, application_id: applicationId }, delivery_status: delivery.status }, 201);
  } catch (error) { return handleSafeRouteError(error); }
}
