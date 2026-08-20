import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { insertInvitationDeliveryLogs } from "@/lib/onboarding/invitation-delivery";
import { normalizeOptionalEmail, provisionAuthUser, writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.object({
  full_name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
  child_name: z.string().trim().optional(),
  fee_group_id: z.string().uuid().optional()
});

export async function POST(request: Request) {
  let createdUserId: string | null = null;
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    if (!profile.garden_id) return fail("לא נמצא גן משויך.", 422);
    if (!isAdminClientConfigured()) return fail("שליחת הזמנה דורשת שירות שרת מאובטח.", 503);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const email = normalizeOptionalEmail(payload.email)!;
    const existing = await admin.from("profiles" as any).select("id,role,full_name,email,phone").eq("email", email).maybeSingle();
    if (existing.data && existing.data.role !== "parent") return fail("המייל קיים במערכת בתפקיד אחר ואי אפשר להזמין אותו כהורה.", 409);

    let parentProfile = existing.data as any;
    let credentials: { username: string; email: string; temporary_password: string } | null = null;
    if (!parentProfile) {
      const provisioned = await provisionAuthUser({ role: "parent", gardenId: null, fullName: payload.full_name, email, phone: payload.phone, createdBy: profile.id });
      parentProfile = { id: provisioned.user.id, role: "parent", full_name: payload.full_name, email, phone: payload.phone ?? null };
      credentials = provisioned.oneTimeCredentials;
      createdUserId = provisioned.user.id;
    }

    const activeLink = await admin.from("parent_kindergarten_links" as any).select("id").eq("parent_profile_id", parentProfile.id).eq("garden_id", profile.garden_id).eq("status", "active").maybeSingle();
    if (activeLink.data) return fail("ההורה כבר משויך לגן.", 409);
    const pending = await admin.from("user_affiliation_requests" as any)
      .select("id,status,metadata")
      .eq("requester_id", profile.id)
      .eq("target_type", "kindergarten")
      .eq("target_id", profile.garden_id)
      .eq("request_type", "parent_to_kindergarten")
      .in("status", ["submitted", "under_review"])
      .contains("metadata", { invited_parent_profile_id: parentProfile.id, direction: "kindergarten_to_parent" })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pending.data) return ok({ invitation: pending.data, account_created: Boolean(credentials), delivery_mode: "in_app_and_test_channels", already_pending: true });

    let priceSnapshot: number | null = null;
    if (payload.fee_group_id) {
      const fee = await admin.from("kindergarten_fee_groups" as any).select("id,monthly_fee").eq("id", payload.fee_group_id).eq("garden_id", profile.garden_id).maybeSingle();
      if (!fee.data) return fail("קבוצת התשלום אינה שייכת לגן.", 422);
      priceSnapshot = Number((fee.data as any).monthly_fee ?? 0);
    }
    const now = new Date().toISOString();
    const invitation = await admin.from("user_affiliation_requests" as any).insert({
      requester_id: profile.id,
      target_type: "kindergarten",
      target_id: profile.garden_id,
      request_type: "parent_to_kindergarten",
      status: "submitted",
      metadata: {
        direction: "kindergarten_to_parent",
        invited_parent_profile_id: parentProfile.id,
        invited_parent_email: email,
        invited_parent_name: payload.full_name,
        child_name_hint: payload.child_name || null,
        requested_class_id: payload.fee_group_id ?? null,
        published_price_snapshot: priceSnapshot,
        parent_acceptance_required: true,
        created_account: Boolean(credentials)
      },
      created_at: now,
      updated_at: now
    }).select("id,status,metadata,created_at").single();
    if (invitation.error) throw new Error(invitation.error.message);

    await Promise.all([
      admin.from("notifications" as any).insert({
        garden_id: profile.garden_id,
        recipient_id: parentProfile.id,
        recipient_profile_id: parentProfile.id,
        recipient_role: "parent",
        title: "הזמנה להצטרף לגן",
        body: `${profile.full_name ?? "מנהלת הגן"} הזמינה אותך לבחור ילד ולאשר הצטרפות.`,
        message: "נדרש אישור שלך לפני שייווצר שיוך לגן.",
        entity_type: "user_affiliation_requests",
        entity_id: invitation.data.id,
        severity: "medium",
        action_url: "/dashboard/parent",
        kindergarten_id: profile.garden_id,
        created_by: profile.id
      }),
      admin.from("audit_logs" as any).insert({
        actor_id: profile.id,
        actor_role: profile.role,
        garden_id: profile.garden_id,
        entity_type: "user_affiliation_requests",
        entity_id: invitation.data.id,
        action: "kindergarten_parent_invitation_created",
        after_data: { invited_parent_profile_id: parentProfile.id, account_created: Boolean(credentials), acceptance_required: true }
      })
    ]);
    if (credentials) {
      await insertInvitationDeliveryLogs(admin, { profileId: parentProfile.id, gardenId: profile.garden_id, role: "parent", username: credentials.username, temporaryPassword: credentials.temporary_password, recipientName: payload.full_name, phone: payload.phone });
    }
    await writeUserCreationAudit({ actorId: profile.id, actorRole: profile.role, gardenId: profile.garden_id, entityType: "user_affiliation_requests", entityId: invitation.data.id, action: "invite_parent_to_kindergarten", afterData: { parent_profile_id: parentProfile.id, created_account: Boolean(credentials) } });
    return ok({ invitation: invitation.data, account_created: Boolean(credentials), delivery_mode: "in_app_and_test_channels" }, 201);
  } catch (error) {
    if (createdUserId) {
      const admin = createAdminClient();
      await admin.from("generated_credentials" as any).delete().eq("user_id", createdUserId);
      await admin.from("profiles" as any).delete().eq("id", createdUserId);
      await admin.auth.admin.deleteUser(createdUserId);
    }
    return handleRouteError(error);
  }
}
