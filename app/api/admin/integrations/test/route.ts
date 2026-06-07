import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const communicationTypes = new Set(["email", "whatsapp", "sms", "push"]);

const schema = z.object({
  integration_type: z.enum(["email", "whatsapp", "sms", "push", "supabase", "vercel", "camera_gateway", "ai_provider"]),
  provider: z.string().min(2).optional(),
  recipient: z.string().trim().optional()
});

function recipientTypeFor(integrationType: string, recipient?: string | null) {
  if (integrationType === "email" || recipient?.includes("@")) return "email";
  if (integrationType === "push") return "push_profile";
  return "phone";
}

function maskRecipient(value?: string | null) {
  if (!value) return "infrastructure-test";
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    return `${local.slice(0, 2)}***@${domain ?? "***"}`;
  }
  return `***${value.slice(-4)}`;
}

async function isApprovedRecipient(admin: ReturnType<typeof createAdminClient>, profile: any, integrationType: string, recipient?: string | null) {
  if (!communicationTypes.has(integrationType)) return true;
  if (!recipient) return false;
  const normalized = recipient.trim().toLowerCase();
  const ownEmail = String(profile.email ?? profile.username ?? "").trim().toLowerCase();
  const ownPhone = String(profile.phone ?? "").trim();
  if (ownEmail && normalized === ownEmail) return true;
  if (ownPhone && recipient.trim() === ownPhone) return true;
  const recipientType = recipientTypeFor(integrationType, recipient);
  const { data, error } = await admin
    .from("production_integration_test_recipients" as any)
    .select("id")
    .eq("recipient_type", recipientType)
    .eq("recipient_value", recipient.trim())
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const provider = payload.provider || (payload.integration_type === "email" ? "mock_email" : payload.integration_type === "whatsapp" ? "mock_whatsapp" : payload.integration_type === "sms" ? "mock_sms" : payload.integration_type === "push" ? "mock_push" : payload.integration_type);
    const approved = await isApprovedRecipient(admin, profile, payload.integration_type, payload.recipient);
    if (!approved) return fail("נמען הבדיקה לא מאושר. יש להשתמש בפרטי האדמין המחובר או להוסיף נמען מאושר.", 403);

    const recipientPreview = maskRecipient(payload.recipient);
    const testLog = await admin.from("production_integration_test_logs" as any).insert({
      integration_type: payload.integration_type,
      provider,
      requested_by: profile.id,
      recipient_preview: recipientPreview,
      status: "sent_mock",
      mode: "mock",
      test_payload: {
        integration_type: payload.integration_type,
        provider,
        recipient_preview: recipientPreview,
        real_send: false,
        broad_send: false
      },
      completed_at: now
    }).select("*").single();
    if (testLog.error) return fail("בדיקת האינטגרציה לא נשמרה", 400);

    await admin.from("production_integrations" as any).update({
      status: "test_mode",
      last_test_at: now,
      last_test_status: "sent_mock",
      updated_at: now
    }).eq("integration_type", payload.integration_type).eq("provider", provider);

    if (communicationTypes.has(payload.integration_type)) {
      await admin.from("communication_test_logs" as any).insert({
        channel: payload.integration_type,
        provider,
        requested_by: profile.id,
        recipient_preview: recipientPreview,
        template_kind: "welcome",
        status: "sent_mock",
        mode: "mock",
        dry_run_payload: {
          source: "production_integrations",
          production_integration_test_log_id: testLog.data.id,
          real_send: false
        },
        completed_at: now
      });
    }

    return ok({ test: testLog.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
