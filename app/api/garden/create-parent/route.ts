import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { provisionAuthUser, provisionedUserSchema, writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertInvitationDeliveryLogs } from "@/lib/onboarding/invitation-delivery";

const schema = provisionedUserSchema.extend({
  identity_number: z.string().optional(),
  address: z.string().optional(),
  lead_id: z.string().uuid().optional()
});

async function cleanupProvisionedParent(userId: string) {
  const admin = createAdminClient();
  try {
    await admin.from("parents" as any).delete().eq("profile_id", userId);
    await admin.from("generated_credentials" as any).delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
  } catch (error) {
    console.error("[create-parent] cleanup failed", { user_id: userId, error });
  }
}

export async function POST(request: Request) {
  let createdUserId: string | null = null;
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    if (!profile.garden_id) return fail("Manager is not assigned to a garden", 422);
    const payload = schema.parse(await request.json());
    const identityNumber = String(payload.identity_number ?? "").replace(/\D/g, "");
    if (identityNumber) {
      const admin = createAdminClient();
      const [parentExisting, profileExisting] = await Promise.all([
        admin.from("parents" as any).select("id", { count: "exact", head: true }).eq("identity_number", identityNumber),
        admin.from("profiles" as any).select("id", { count: "exact", head: true }).eq("identity_number", identityNumber)
      ]);
      if ((parentExisting.count ?? 0) + (profileExisting.count ?? 0) > 0) return fail("קיים כבר משתמש הורה במערכת. יש להשתמש בחשבון הקיים ולהגיש בקשת הצטרפות/שיוך לגן נוסף.", 409, { field: "identity_number" });
    }
    const { supabase, user, oneTimeCredentials } = await provisionAuthUser({
      role: "parent",
      gardenId: profile.garden_id,
      fullName: payload.full_name,
      email: payload.email,
      phone: payload.phone,
      temporaryPassword: payload.temporary_password
    });
      createdUserId = user.id;
    const now = new Date().toISOString();
    if (identityNumber) await supabase.from("profiles" as any).update({ identity_number: identityNumber }).eq("id", user.id);

    const { data: parent, error } = await supabase
      .from("parents")
      .insert({
        profile_id: user.id,
        garden_id: profile.garden_id,
        full_name: payload.full_name,
        identity_number: identityNumber || null,
        phone: payload.phone ?? "",
        email: payload.email,
        address: payload.address,
        status: "invited",
        completed_profile: false,
        onboarding_status: "account_created",
        invitation_status: "account_created",
        invited_by: profile.id,
        invited_at: now,
        account_created_at: now
      })
      .select("*")
      .single();

    if (error) {
      await cleanupProvisionedParent(user.id);
      return fail(error.message, 400);
    }

    await Promise.all([
      supabase.from("parent_onboarding_records" as any).upsert({
        parent_id: parent.id,
        profile_id: user.id,
        garden_id: profile.garden_id,
        status: "account_created",
        progress_percent: 0,
        invited_by: profile.id,
        invited_at: now,
        account_created_at: now
      }, { onConflict: "parent_id" }),
      insertInvitationDeliveryLogs(supabase, {
        profileId: user.id,
        gardenId: profile.garden_id,
        role: "parent",
        username: oneTimeCredentials.username,
        temporaryPassword: oneTimeCredentials.temporary_password,
        recipientName: payload.full_name,
        phone: payload.phone
      })
    ]);

    if (payload.lead_id) {
      const leadUpdate = await supabase.from("leads").update({ status: "parent_user_created", assigned_to: user.id }).eq("id", payload.lead_id).eq("garden_id", profile.garden_id).select("id").maybeSingle();
      if (leadUpdate.error || !leadUpdate.data) {
        console.error("[create-parent] lead update failed", { lead_id: payload.lead_id, garden_id: profile.garden_id, error: leadUpdate.error?.message ?? "lead not found" });
        return fail("ההורה נוצר, אך עדכון הליד נכשל. יש לבדוק את סטטוס הליד לפני הצגת הצלחה מלאה.", 409, { parent_id: parent.id, parent_user_id: user.id });
      }
    }

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: profile.role,
      gardenId: profile.garden_id,
      entityType: "parents",
      entityId: parent.id as string,
      action: "create_parent_user",
      afterData: { parent_id: parent.id, parent_user_id: user.id, lead_id: payload.lead_id ?? null, onboarding_status: "account_created" }
    });

    return ok({ parent, credentials: oneTimeCredentials }, 201);
  } catch (error) {
    if (createdUserId) await cleanupProvisionedParent(createdUserId);
    return handleRouteError(error);
  }
}
