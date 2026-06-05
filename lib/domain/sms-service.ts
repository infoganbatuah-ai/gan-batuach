import { maskPhone, normalizeIsraeliPhone } from "@/lib/domain/communication-service";
import { getSmsProvider, type SmsEventType } from "@/lib/domain/sms-provider";

type SupabaseLike = {
  from: (table: string) => any;
};

export type QueueSmsInput = {
  recipientProfileId: string;
  kindergartenId?: string | null;
  eventType: SmsEventType;
  templateKey: string;
  variables?: Record<string, string | number | null | undefined>;
  metadata?: Record<string, unknown>;
};

function renderSmsTemplate(template: string, variables?: QueueSmsInput["variables"]) {
  return Object.entries(variables ?? {}).reduce((body, [key, value]) => {
    return body.replaceAll(`{{${key}}}`, value === null || value === undefined ? "" : String(value));
  }, template);
}

function nextRetryDate(attempts: number) {
  const minutes = [5, 20, 60][Math.min(attempts, 2)] ?? 60;
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export async function queueSms(supabase: SupabaseLike, input: QueueSmsInput) {
  const [{ data: template, error: templateError }, { data: recipient, error: recipientError }] = await Promise.all([
    supabase.from("sms_templates").select("*").eq("template_key", input.templateKey).maybeSingle(),
    supabase.from("profiles").select("id, phone").eq("id", input.recipientProfileId).maybeSingle()
  ]);

  if (templateError || !template) {
    return { ok: false, status: "failed" as const, error: templateError?.message ?? "sms_template_not_found" };
  }
  if (recipientError || !recipient) {
    return { ok: false, status: "failed" as const, error: recipientError?.message ?? "recipient_not_found" };
  }

  const normalizedPhone = normalizeIsraeliPhone(recipient.phone);
  const message = renderSmsTemplate(template.body_template, input.variables).slice(0, 500);
  if (!normalizedPhone) {
    const failed = await supabase.from("sms_message_logs").insert({
      template_id: template.id,
      recipient_profile_id: input.recipientProfileId,
      kindergarten_id: input.kindergartenId ?? null,
      event_type: input.eventType,
      status: "failed",
      provider: "validation",
      message_preview: message,
      variables: input.variables ?? {},
      failure_reason: "Missing or invalid SMS phone number.",
      retry_attempts: 0,
      next_retry_at: nextRetryDate(0),
      failed_at: new Date().toISOString(),
      metadata: input.metadata ?? {}
    }).select("id, status").single();
    return { ok: false, status: "failed" as const, log: failed.data, error: failed.error?.message ?? "invalid_phone" };
  }

  const provider = getSmsProvider();
  const result = await provider.send({ to: normalizedPhone, body: message, eventType: input.eventType, metadata: input.metadata });
  const now = new Date().toISOString();
  const shouldRetry = result.status === "failed";
  const inserted = await supabase.from("sms_message_logs").insert({
    template_id: template.id,
    recipient_profile_id: input.recipientProfileId,
    kindergarten_id: input.kindergartenId ?? null,
    event_type: input.eventType,
    recipient_phone: normalizedPhone,
    masked_phone: maskPhone(normalizedPhone),
    message_preview: message,
    status: result.status,
    provider: result.provider,
    provider_message_id: result.providerMessageId ?? null,
    provider_reference: result.providerReference ?? null,
    variables: input.variables ?? {},
    failure_reason: result.failureReason ?? null,
    retry_attempts: 0,
    next_retry_at: shouldRetry ? nextRetryDate(0) : null,
    queued_at: now,
    sent_at: result.status === "sent" ? now : null,
    failed_at: shouldRetry ? now : null,
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
