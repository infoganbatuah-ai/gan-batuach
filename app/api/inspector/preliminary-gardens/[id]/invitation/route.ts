import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createSignedInvitation, normalizeInvitationEmail } from "@/lib/management/signed-invitation";
import { deliverSignedInvitation } from "@/lib/management/invitation-delivery";

const schema = z.object({
  recipient_email: z.string().email(),
  recipient_name: z.string().trim().min(2).optional(),
  registrant_type: z.enum(["owner_only", "owner_teacher", "teacher_operator"])
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, profile } = await getSessionProfile();
    if (!user || !profile) return fail("נדרשת התחברות.", 401);
    if (profile.role !== "inspector") return fail("אין הרשאת מפקח.", 403);
    if (!isAdminClientConfigured()) return fail("שירות ההזמנות אינו זמין.", 503);
    const supabase = await createClient();
    const approved = await supabase.rpc("current_inspector_approved" as never);
    if (approved.error || approved.data !== true) return fail("אישור המפקח אינו פעיל.", 403);
    const gardenId = z.string().uuid().parse((await params).id);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const { data: garden, error } = await admin.from("gardens" as never)
      .select("id,name,status,bootstrap_inspector_id,bootstrap_cancelled_at")
      .eq("id", gardenId).eq("bootstrap_inspector_id", profile.id).maybeSingle();
    const draft = garden as { id: string; name: string; status: string; bootstrap_cancelled_at: string | null } | null;
    if (error || !draft || draft.status !== "pending" || draft.bootstrap_cancelled_at) return fail("טיוטת הגן אינה זמינה למפקח זה.", 404);
    const claimed = await admin.from("kindergarten_onboarding_records" as never).select("manager_id").eq("garden_id", gardenId).maybeSingle();
    if (claimed.error || (claimed.data as { manager_id: string | null } | null)?.manager_id) return fail("הגן כבר נמסר להמשך קליטה.", 409);
    const email = normalizeInvitationEmail(payload.recipient_email)!;
    const role = payload.registrant_type === "teacher_operator" ? "manager" : "owner";
    const recipient = await admin.from("profiles" as never).select("id,role").eq("email", email).maybeSingle();
    if (recipient.error) throw recipient.error;
    const target = recipient.data as { id: string; role: string } | null;
    if (target && target.role !== role) return fail("לחשבון הקיים תפקיד שאינו מתאים לסוג ההזמנה.", 409);
    const superseded = await admin.from("management_invitations" as never).update({ status: "superseded", updated_at: new Date().toISOString() })
      .eq("garden_id", gardenId).eq("invitation_type", "garden_management").in("status", ["pending", "delivered"]);
    if (superseded.error) throw superseded.error;
    const issued = await createSignedInvitation(admin, {
      invitationType: "garden_management",
      intendedRole: role === "owner" ? "kindergarten_owner" : "kindergarten_manager",
      gardenId,
      targetProfileId: target?.id ?? null,
      recipientEmail: email,
      createdBy: profile.id,
      payload: { source: "inspector_preliminary", registrant_type: payload.registrant_type, inspector_id: profile.id }
    });
    const delivery = await deliverSignedInvitation(admin, {
      invitationId: issued.invitation.id, email, recipientName: payload.recipient_name ?? "מוזמן/ת",
      gardenId, gardenName: draft.name, targetProfileId: target?.id ?? null, url: issued.url
    });
    await admin.from("audit_logs" as never).insert({ actor_id: profile.id, actor_role: "inspector", garden_id: gardenId,
      entity_type: "management_invitations", entity_id: issued.invitation.id, action: "inspector_garden_invitation_issued",
      after_data: { registrant_type: payload.registrant_type, delivery_status: delivery.status } });
    return ok({ invitation_id: issued.invitation.id, delivery_status: delivery.status,
      next_state: delivery.status === "sent" ? "delivered" : "delivery_pending" }, 201);
  } catch (error) { return handleSafeRouteError(error); }
}
