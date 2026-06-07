import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

function loginUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
}

function canStoreTemporaryPasswordInMockLog() {
  return process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SANDBOX_MODE === "true";
}

function credentialVariables(temporaryPassword: string) {
  const mockLogAllowed = canStoreTemporaryPasswordInMockLog();
  return {
    temporary_password: mockLogAllowed ? temporaryPassword : "[redacted]",
    temporary_password_redacted: !mockLogAllowed
  };
}

export async function insertInvitationDeliveryLogs(admin: AdminClient, input: {
  profileId: string;
  gardenId: string;
  role: "parent" | "staff";
  username: string;
  temporaryPassword: string;
  recipientName: string;
  phone?: string | null;
}) {
  const now = new Date().toISOString();
  const roleLabel = input.role === "parent" ? "הורה" : "צוות";
  const title = `פרטי כניסה לגן בטוח - ${roleLabel}`;
  const preview = `שלום ${input.recipientName}, נוצרו לך פרטי כניסה לגן בטוח. יש להתחבר ולהשלים תהליך קצר.`;
  const href = input.role === "parent" ? "/parent-onboarding" : "/onboarding/staff";
  const passwordVariables = credentialVariables(input.temporaryPassword);

  await Promise.all([
    admin.from("email_delivery_logs" as any).insert({
      recipient_profile_id: input.profileId,
      kindergarten_id: input.gardenId,
      category: "invitation",
      recipient_email: input.username,
      subject_preview: title,
      message_preview: preview,
      status: "queued",
      provider: "mock_email",
      metadata: {
        login_url: `${loginUrl()}/login`,
        onboarding_url: `${loginUrl()}${href}`,
        includes_temporary_password: canStoreTemporaryPasswordInMockLog(),
        temporary_password_redacted: !canStoreTemporaryPasswordInMockLog(),
        role: input.role
      }
    }),
    admin.from("whatsapp_message_logs" as any).insert({
      recipient_profile_id: input.profileId,
      kindergarten_id: input.gardenId,
      event_type: input.role === "parent" ? "parent_approval" : "registration",
      recipient_phone: input.phone ?? null,
      masked_phone: input.phone ? `***${String(input.phone).slice(-4)}` : null,
      status: "queued",
      provider: "mock_whatsapp",
      template_name: input.role === "parent" ? "parent_invitation" : "staff_invitation",
      template_language: "he",
      variables: {
        login_url: `${loginUrl()}/login`,
        onboarding_url: `${loginUrl()}${href}`,
        username: input.username,
        ...passwordVariables,
        recipient_name: input.recipientName
      },
      queued_at: now,
      metadata: { source: "parent_staff_onboarding", role: input.role }
    }),
    admin.from("sms_message_logs" as any).insert({
      recipient_profile_id: input.profileId,
      kindergarten_id: input.gardenId,
      event_type: input.role === "parent" ? "parent_approval" : "registration_verification",
      recipient_phone: input.phone ?? null,
      masked_phone: input.phone ? `***${String(input.phone).slice(-4)}` : null,
      message_preview: preview,
      status: "queued",
      provider: "mock_sms",
      variables: {
        login_url: `${loginUrl()}/login`,
        username: input.username,
        ...passwordVariables,
        role: input.role
      },
      queued_at: now,
      metadata: { source: "parent_staff_onboarding", readiness_only: true }
    }),
    admin.from("notifications" as any).insert({
      garden_id: input.gardenId,
      recipient_id: input.profileId,
      title,
      body: input.role === "parent" ? "התחברו והשלימו פרטי ילד והרשאות." : "התחברו והשלימו פרטים ומסמכי צוות.",
      entity_type: input.role,
      entity_id: input.profileId,
      severity: "medium",
      metadata: { href, onboarding: true, role: input.role }
    })
  ]);
}
