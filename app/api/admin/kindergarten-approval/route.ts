import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTemporaryPassword, provisionAuthUser, writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const schema = z.object({
  action: z.enum(["approve_lead", "resend_credentials", "approve_final_profile", "request_corrections", "reject", "suspend"]),
  lead_id: z.string().uuid().optional(),
  garden_id: z.string().uuid().optional(),
  note: z.string().optional()
});

function loginUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
}

async function insertCredentialCommunicationLogs(admin: ReturnType<typeof createAdminClient>, input: {
  gardenId: string;
  managerId: string;
  username: string;
  temporaryPassword: string;
  gardenName: string;
}) {
  const now = new Date().toISOString();
  const messagePreview = `כניסה לגן בטוח עבור ${input.gardenName}. שם משתמש: ${input.username}. יש להשלים פרופיל גן לאחר התחברות.`;
  await Promise.all([
    admin.from("email_delivery_logs" as any).insert({
      recipient_profile_id: input.managerId,
      kindergarten_id: input.gardenId,
      category: "onboarding",
      recipient_email: input.username,
      subject_preview: "פרטי כניסה לגן בטוח",
      message_preview: messagePreview,
      status: "queued",
      provider: "mock",
      sent_at: null,
      metadata: {
        login_url: `${loginUrl()}/login`,
        includes_temporary_password: true,
        password_delivery: "provider_payload_only"
      }
    }),
    admin.from("whatsapp_message_logs" as any).insert({
      recipient_profile_id: input.managerId,
      kindergarten_id: input.gardenId,
      event_type: "registration",
      status: "queued_mock",
      provider: "mock",
      template_name: "kindergarten_manager_credentials",
      template_language: "he",
      variables: {
        login_url: `${loginUrl()}/login`,
        username: input.username,
        temporary_password: input.temporaryPassword,
        garden_name: input.gardenName
      },
      queued_at: now,
      metadata: { source: "kindergarten_approval_flow" }
    })
  ]);
}

async function latestCredentials(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin
    .from("generated_credentials" as any)
    .select("username, temporary_password")
    .eq("user_id", userId)
    .is("password_changed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as any;
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const now = new Date().toISOString();

    if (payload.action === "approve_lead") {
      if (!payload.lead_id) return fail("חסר ליד לאישור", 422);
      const { data: lead, error: leadError } = await admin
        .from("leads" as any)
        .select("*")
        .eq("id", payload.lead_id)
        .eq("lead_type", "garden")
        .maybeSingle();
      if (leadError || !lead) return fail("לא נמצא ליד גן לאישור", 404);
      if (lead.converted_entity_id) return fail("הליד כבר חובר לגן", 409);

      const managerName = lead.manager_name || lead.owner_name || lead.garden_name || "מנהלת הגן";
      const managerEmail = lead.email || undefined;
      const temporaryPassword = generateTemporaryPassword();
      const manager = await provisionAuthUser({
        role: "manager",
        fullName: managerName,
        email: managerEmail,
        phone: lead.phone,
        temporaryPassword,
        createdBy: profile.id,
        conflictField: "manager_email"
      });

      const { data: garden, error: gardenError } = await admin.from("gardens" as any).insert({
        name: lead.garden_name || "גן חדש",
        city: lead.city || "לא צוינה",
        address: lead.address || null,
        phone: lead.phone || null,
        email: manager.oneTimeCredentials.email,
        manager_id: manager.user.id,
        owner_name: lead.owner_name || managerName,
        status: "pending",
        approval_flow_status: "lead_approved_credentials_sent",
        final_approval_status: "profile_incomplete",
        onboarding_status: "profile_incomplete",
        public_profile_enabled: false,
        children_capacity: Number(lead.capacity ?? 0),
        current_children_count: Number(lead.children_count ?? 0),
        staff_count: Number(lead.staff_count ?? 0),
        ages: Array.isArray(lead.age_groups) ? lead.age_groups : [],
        safe_status: "pending_review",
        eligible_for_safe_status: false,
        credentials_sent_at: now,
        admin_correction_note: null
      }).select("*").single();
      if (gardenError || !garden) {
        await admin.auth.admin.deleteUser(manager.user.id);
        return fail("לא ניתן ליצור גן ממתין להשלמה: " + (gardenError?.message ?? "שגיאה לא ידועה"), 400);
      }

      const { error: profileError } = await admin.from("profiles" as any).update({ garden_id: garden.id }).eq("id", manager.user.id);
      if (profileError) {
        await admin.from("gardens" as any).delete().eq("id", garden.id);
        await admin.auth.admin.deleteUser(manager.user.id);
        return fail("נוצר משתמש אך שיוך הגן נכשל", 400);
      }

      await Promise.all([
        admin.from("leads" as any).update({
          status: "lead_approved_credentials_sent",
          converted_entity_id: garden.id,
          converted_at: now
        }).eq("id", lead.id),
        admin.from("notifications" as any).insert({
          garden_id: garden.id,
          recipient_id: manager.user.id,
          title: "ברוכה הבאה לגן בטוח",
          body: "התחברי והשלימי את פרופיל הגן כדי לשלוח לאישור סופי.",
          entity_type: "garden",
          entity_id: garden.id,
          severity: "medium",
          metadata: { href: "/dashboard/garden", onboarding: true }
        })
      ]);

      await insertCredentialCommunicationLogs(admin, {
        gardenId: garden.id,
        managerId: manager.user.id,
        username: manager.oneTimeCredentials.username,
        temporaryPassword,
        gardenName: garden.name
      });

      await writeUserCreationAudit({
        actorId: profile.id,
        actorRole: "admin",
        gardenId: garden.id,
        entityType: "gardens",
        entityId: garden.id,
        action: "approve_kindergarten_lead_credentials_sent",
        afterData: { lead_id: lead.id, garden_id: garden.id, manager_user_id: manager.user.id }
      });

      revalidatePath("/dashboard/admin/leads");
      return ok({ garden, manager_user_id: manager.user.id, credentials: manager.oneTimeCredentials }, 201);
    }

    if (!payload.garden_id) return fail("חסר גן לעדכון", 422);
    const { data: garden, error: gardenError } = await admin
      .from("gardens" as any)
      .select("id, name, manager_id, status, approval_flow_status, final_approval_status")
      .eq("id", payload.garden_id)
      .maybeSingle();
    if (gardenError || !garden) return fail("לא נמצא גן לעדכון", 404);

    if (payload.action === "resend_credentials") {
      if (!garden.manager_id) return fail("לגן אין מנהלת משויכת", 422);
      let credentials = await latestCredentials(admin, garden.manager_id);
      if (!credentials) {
        const temporaryPassword = generateTemporaryPassword();
        const { data: user } = await admin.from("profiles" as any).select("email, username").eq("id", garden.manager_id).maybeSingle();
        credentials = { username: user?.email || user?.username, temporary_password: temporaryPassword };
        await admin.auth.admin.updateUserById(garden.manager_id, { password: temporaryPassword });
        await admin.from("generated_credentials" as any).insert({
          user_id: garden.manager_id,
          username: credentials.username,
          temporary_password: temporaryPassword,
          created_by: profile.id
        });
      }
      await insertCredentialCommunicationLogs(admin, {
        gardenId: garden.id,
        managerId: garden.manager_id,
        username: credentials.username,
        temporaryPassword: credentials.temporary_password,
        gardenName: garden.name
      });
      await admin.from("gardens" as any).update({ credentials_sent_at: now }).eq("id", garden.id);
      revalidatePath("/dashboard/admin/leads");
      return ok({ credentials });
    }

    const statusPatch: Record<string, unknown> = { updated_at: now };
    if (payload.action === "approve_final_profile") {
      Object.assign(statusPatch, {
        status: "active",
        approval_flow_status: "active",
        final_approval_status: "active",
        onboarding_status: "completed",
        final_approved_at: now,
        admin_correction_note: null,
        public_profile_enabled: true
      });
    }
    if (payload.action === "request_corrections") {
      Object.assign(statusPatch, {
        status: "pending",
        approval_flow_status: "correction_required",
        final_approval_status: "correction_required",
        onboarding_status: "correction_required",
        admin_correction_note: payload.note || "נדרשת השלמה לפני אישור סופי"
      });
    }
    if (payload.action === "reject") {
      Object.assign(statusPatch, {
        status: "pending",
        approval_flow_status: "rejected",
        final_approval_status: "rejected",
        rejected_at: now,
        admin_correction_note: payload.note || null
      });
    }
    if (payload.action === "suspend") {
      Object.assign(statusPatch, {
        status: "blocked",
        approval_flow_status: "suspended",
        final_approval_status: "suspended",
        suspended_at: now,
        admin_correction_note: payload.note || null,
        public_profile_enabled: false
      });
    }

    const { error } = await admin.from("gardens" as any).update(statusPatch).eq("id", garden.id);
    if (error) return fail("לא ניתן לעדכן סטטוס גן", 400);
    await admin.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: "admin",
      performed_by_user: profile.id,
      performed_by_role: "admin",
      garden_id: garden.id,
      entity_type: "gardens",
      entity_id: garden.id,
      action: `kindergarten_${payload.action}`,
      after_data: statusPatch
    });
    revalidatePath("/dashboard/admin/leads");
    revalidatePath("/dashboard/admin/kindergartens");
    revalidatePath("/dashboard/garden");
    return ok({ garden_id: garden.id, status: statusPatch.status });
  } catch (error) {
    return handleRouteError(error);
  }
}
