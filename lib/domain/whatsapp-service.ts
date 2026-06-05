import { maskPhone, normalizeIsraeliPhone } from "@/lib/domain/communication-service";
import {
  getWhatsAppProvider,
  type WhatsAppEventType,
  type WhatsAppTemplateMessage
} from "@/lib/domain/whatsapp-provider";

type SupabaseLike = {
  from: (table: string) => any;
};

export type QueueWhatsAppTemplateInput = {
  recipientProfileId: string;
  kindergartenId?: string | null;
  eventType: WhatsAppEventType;
  templateKey: string;
  variables?: Record<string, string | number | null | undefined>;
  metadata?: Record<string, unknown>;
};

export async function queueWhatsAppTemplate(supabase: SupabaseLike, input: QueueWhatsAppTemplateInput) {
  const [{ data: template, error: templateError }, { data: recipient, error: recipientError }] = await Promise.all([
    supabase.from("whatsapp_templates").select("*").eq("template_key", input.templateKey).maybeSingle(),
    supabase.from("profiles").select("id, phone").eq("id", input.recipientProfileId).maybeSingle()
  ]);

  if (templateError || !template) {
    return { ok: false, status: "failed" as const, error: templateError?.message ?? "whatsapp_template_not_found" };
  }
  if (recipientError || !recipient) {
    return { ok: false, status: "failed" as const, error: recipientError?.message ?? "recipient_not_found" };
  }

  const normalizedPhone = normalizeIsraeliPhone(recipient.phone);
  if (!normalizedPhone) {
    const failed = await supabase.from("whatsapp_message_logs").insert({
      template_id: template.id,
      recipient_profile_id: input.recipientProfileId,
      kindergarten_id: input.kindergartenId ?? null,
      event_type: input.eventType,
      status: "failed",
      provider: "validation",
      template_name: template.template_name,
      template_language: template.language,
      variables: input.variables ?? {},
      failure_reason: "Missing or invalid WhatsApp phone number.",
      failed_at: new Date().toISOString(),
      metadata: input.metadata ?? {}
    }).select("id, status").single();
    return { ok: false, status: "failed" as const, log: failed.data, error: failed.error?.message ?? "invalid_phone" };
  }

  const provider = getWhatsAppProvider();
  const message: WhatsAppTemplateMessage = {
    to: normalizedPhone,
    templateName: template.template_name,
    language: template.language ?? "he",
    variables: input.variables,
    eventType: input.eventType,
    metadata: input.metadata
  };
  const result = await provider.sendTemplate(message);
  const now = new Date().toISOString();
  const inserted = await supabase.from("whatsapp_message_logs").insert({
    template_id: template.id,
    recipient_profile_id: input.recipientProfileId,
    kindergarten_id: input.kindergartenId ?? null,
    event_type: input.eventType,
    recipient_phone: normalizedPhone,
    masked_phone: maskPhone(normalizedPhone),
    status: result.status,
    provider: result.provider,
    provider_message_id: result.providerMessageId ?? null,
    template_name: template.template_name,
    template_language: template.language ?? "he",
    variables: input.variables ?? {},
    failure_reason: result.failureReason ?? null,
    queued_at: now,
    sent_at: result.status === "sent" ? now : null,
    failed_at: result.status === "failed" ? now : null,
    metadata: { ...(input.metadata ?? {}), dry_run_payload: result.dryRunPayload ?? null }
  }).select("id, status").single();

  return {
    ok: !inserted.error && result.status !== "failed",
    status: result.status,
    provider: result.provider,
    log: inserted.data,
    error: inserted.error?.message ?? result.failureReason ?? null
  };
}
