import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { deliverSignedInvitation } from "@/lib/management/invitation-delivery";
import { createSignedInvitation, normalizeInvitationEmail } from "@/lib/management/signed-invitation";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.object({ full_name: z.string().trim().min(2), email: z.string().trim().email(), phone: z.string().trim().optional(), child_name: z.string().trim().optional(), fee_group_id: z.string().uuid().optional() });

export async function POST(request: Request) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const { profile } = access.session;
    if (!profile.garden_id) return fail("לא נמצא גן משויך.", 422);
    if (!isAdminClientConfigured()) return fail("שליחת הזמנה דורשת שירות שרת מאובטח.", 503);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const email = normalizeInvitationEmail(payload.email)!;
    const [{ data: existing, error: existingError }, { data: garden, error: gardenError }] = await Promise.all([
      admin.from("profiles" as any).select("id,role,full_name,email,phone").eq("email", email).maybeSingle(),
      admin.from("gardens" as any).select("id,name").eq("id", profile.garden_id).single()
    ]);
    if (existingError) throw new Error(existingError.message);
    if (gardenError || !garden) throw new Error(gardenError?.message ?? "Garden not found");
    if (existing && existing.role !== "parent") return fail("המייל קיים במערכת בתפקיד אחר ואי אפשר להזמין אותו כהורה.", 409);
    if (existing) {
      const activeLink = await admin.from("parent_kindergarten_links" as any).select("id").eq("parent_profile_id", existing.id).eq("garden_id", profile.garden_id).eq("status", "active").maybeSingle();
      if (activeLink.data) return fail("ההורה כבר משויך לגן.", 409);
    }

    let priceSnapshot: number | null = null;
    if (payload.fee_group_id) {
      const fee = await admin.from("kindergarten_fee_groups" as any).select("id,monthly_fee").eq("id", payload.fee_group_id).eq("garden_id", profile.garden_id).maybeSingle();
      if (!fee.data) return fail("קבוצת התשלום אינה שייכת לגן.", 422);
      priceSnapshot = Number((fee.data as any).monthly_fee ?? 0);
    }

    const now = new Date().toISOString();
    const legacy = await admin.from("user_affiliation_requests" as any).insert({
      requester_id: profile.id, target_type: "kindergarten", target_id: profile.garden_id,
      request_type: "parent_to_kindergarten", status: "submitted",
      metadata: { direction: "kindergarten_to_parent", invited_parent_profile_id: existing?.id ?? null, invited_parent_email: email, invited_parent_name: payload.full_name, child_name_hint: payload.child_name || null, requested_class_id: payload.fee_group_id ?? null, published_price_snapshot: priceSnapshot, parent_acceptance_required: true, signed_invitation_required: true },
      created_at: now, updated_at: now
    }).select("id,status,metadata,created_at").single();
    if (legacy.error) throw new Error(legacy.error.message);

    let signed;
    try {
      signed = await createSignedInvitation(admin, {
        invitationType: "parent_guardian", intendedRole: "parent", gardenId: profile.garden_id,
        targetProfileId: existing?.id ?? null, recipientEmail: email, recipientPhone: payload.phone,
        createdBy: profile.id, legacyAffiliationRequestId: legacy.data.id,
        payload: { invited_parent_name: payload.full_name, child_name_hint: payload.child_name || null, fee_group_id: payload.fee_group_id ?? null, published_price_snapshot: priceSnapshot }
      });
    } catch (error) {
      await admin.from("user_affiliation_requests" as any).delete().eq("id", legacy.data.id);
      throw error;
    }
    await admin.from("user_affiliation_requests" as any).update({ metadata: { ...legacy.data.metadata, canonical_invitation_id: signed.invitation.id } }).eq("id", legacy.data.id);
    const delivery = await deliverSignedInvitation(admin, { invitationId: signed.invitation.id, email, recipientName: payload.full_name, gardenId: profile.garden_id, gardenName: garden.name, targetProfileId: existing?.id ?? null, url: signed.url });
    await admin.from("audit_logs" as any).insert({
      actor_id: profile.id, actor_role: profile.role, garden_id: profile.garden_id,
      entity_type: "management_invitations", entity_id: signed.invitation.id, action: "signed_parent_invitation_created",
      after_data: { intended_role: "parent", target_profile_exists: Boolean(existing), legacy_affiliation_request_id: legacy.data.id, expires_at: signed.invitation.expires_at, delivery_provider: delivery.provider, delivery_status: delivery.status }
    });
    return ok({ invitation: { ...legacy.data, canonical_invitation_id: signed.invitation.id, expires_at: signed.invitation.expires_at }, account_created: false, delivery_mode: delivery.status, already_pending: false }, 201);
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
