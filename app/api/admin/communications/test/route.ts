import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  channel: z.enum(["whatsapp", "sms", "email", "push"]),
  provider: z.string().min(2).optional(),
  recipient: z.string().min(2).optional(),
  template_kind: z.string().default("welcome")
});

function maskRecipient(value?: string) {
  if (!value) return "mock-recipient";
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    return `${local.slice(0, 2)}***@${domain ?? "***"}`;
  }
  return `***${value.slice(-4)}`;
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const provider = payload.provider || `mock_${payload.channel}`;
    const recipientPreview = maskRecipient(payload.recipient);

    const testLog = await admin.from("communication_test_logs" as any).insert({
      channel: payload.channel,
      provider,
      requested_by: profile.id,
      recipient_preview: recipientPreview,
      template_kind: payload.template_kind,
      status: "sent_mock",
      mode: "mock",
      dry_run_payload: {
        channel: payload.channel,
        provider,
        recipient_preview: recipientPreview,
        template_kind: payload.template_kind,
        real_send: false
      },
      completed_at: now
    }).select("*").single();
    if (testLog.error) return fail("בדיקת הערוץ לא נשמרה", 400);

    if (payload.channel === "whatsapp") {
      await admin.from("whatsapp_message_logs" as any).insert({
        recipient_profile_id: profile.id,
        event_type: "registration",
        recipient_phone: payload.recipient && !payload.recipient.includes("@") ? payload.recipient : null,
        masked_phone: recipientPreview,
        status: "queued",
        provider,
        template_name: "mock_test_template",
        template_language: "he",
        variables: { template_kind: payload.template_kind },
        queued_at: now,
        metadata: { test_log_id: testLog.data.id, real_send: false }
      });
    }

    if (payload.channel === "sms") {
      await admin.from("sms_message_logs" as any).insert({
        recipient_profile_id: profile.id,
        event_type: payload.template_kind === "password_reset" ? "password_reset" : "registration_verification",
        recipient_phone: payload.recipient && !payload.recipient.includes("@") ? payload.recipient : null,
        masked_phone: recipientPreview,
        message_preview: "בדיקת SMS במצב mock בלבד",
        status: "queued",
        provider,
        variables: { template_kind: payload.template_kind },
        queued_at: now,
        metadata: { test_log_id: testLog.data.id, real_send: false }
      });
    }

    if (payload.channel === "email") {
      await admin.from("email_delivery_logs" as any).insert({
        recipient_profile_id: profile.id,
        category: "invitation",
        recipient_email: payload.recipient?.includes("@") ? payload.recipient : null,
        subject_preview: "בדיקת אימייל גן בטוח",
        message_preview: "בדיקת אימייל במצב mock בלבד",
        status: "queued",
        provider,
        metadata: { test_log_id: testLog.data.id, template_kind: payload.template_kind, real_send: false }
      });
    }

    if (payload.channel === "push") {
      await admin.from("push_notification_logs" as any).insert({
        profile_id: profile.id,
        platform: "web",
        title: "בדיקת Push",
        body: "בדיקת Push במצב mock בלבד",
        action_url: "/dashboard/admin/communications",
        status: "queued_mock",
        provider,
        sent_at: now,
        category: "system_notification",
        deep_link_type: "admin_communications",
        metadata: { test_log_id: testLog.data.id, template_kind: payload.template_kind, real_send: false }
      });
    }

    await admin.from("communication_provider_configs" as any).update({
      status: "testing",
      last_tested_at: now,
      last_health_checked_at: now,
      last_error: null,
      updated_at: now
    }).eq("channel", payload.channel).eq("provider", provider);

    return ok({ test: testLog.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
