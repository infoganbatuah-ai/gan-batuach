import { getEmailProvider } from "./email-provider";

type SupabaseLike = {
  from: (table: string) => any;
};

export type QueueEmailInput = {
  recipientProfileId: string;
  kindergartenId?: string | null;
  templateKey: string;
  variables?: Record<string, string | number | null | undefined>;
  metadata?: Record<string, unknown>;
  critical?: boolean;
};

function renderTemplate(template: string, variables?: QueueEmailInput["variables"]) {
  return Object.entries(variables ?? {}).reduce((output, [key, value]) => {
    return output.replaceAll(`{{${key}}}`, value === null || value === undefined ? "" : String(value));
  }, template);
}

async function preferencesAllowEmail(supabase: SupabaseLike, profileId: string, category?: string | null, critical?: boolean) {
  const { data: preferences, error: prefError } = await supabase
    .from("communication_preferences")
    .select("receive_email, emergency_messages_allowed")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (prefError) return { allowed: true, error: prefError.message };
  if (critical && preferences?.emergency_messages_allowed !== false) return { allowed: true, error: null };
  if (preferences && preferences.receive_email === false) return { allowed: false, error: null };

  if (!category) return { allowed: true, error: null };
  const { data: categoryPreference, error: categoryError } = await supabase
    .from("email_category_preferences")
    .select("enabled, critical_only")
    .eq("profile_id", profileId)
    .eq("category", category)
    .maybeSingle();
  if (categoryError) return { allowed: true, error: categoryError.message };
  if (!categoryPreference) return { allowed: true, error: null };
  if (categoryPreference.enabled === false) return { allowed: false, error: null };
  if (categoryPreference.critical_only && !critical) return { allowed: false, error: null };
  return { allowed: true, error: null };
}

export async function queueEmail(supabase: SupabaseLike, input: QueueEmailInput) {
  const [{ data: template, error: templateError }, { data: recipient, error: recipientError }] = await Promise.all([
    supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", input.templateKey)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id, email")
      .eq("id", input.recipientProfileId)
      .maybeSingle()
  ]);

  if (templateError || !template) {
    return { ok: false, log: null, error: templateError?.message ?? "email_template_not_found" };
  }

  const category = template.category as string;
  const subject = renderTemplate(template.subject_template, input.variables);
  const text = renderTemplate(template.body_text_template, input.variables);
  const html = template.body_html_template ? renderTemplate(template.body_html_template, input.variables) : null;
  const preference = await preferencesAllowEmail(supabase, input.recipientProfileId, category, input.critical);

  if (recipientError || !recipient?.email) {
    const failed = await supabase.from("email_delivery_logs").insert({
      template_id: template.id,
      recipient_profile_id: input.recipientProfileId,
      kindergarten_id: input.kindergartenId ?? null,
      category,
      subject_preview: subject.slice(0, 200),
      message_preview: text.slice(0, 500),
      status: "failed",
      provider: "validation",
      failure_reason: recipientError?.message ?? "Missing recipient email address.",
      failed_at: new Date().toISOString(),
      next_retry_at: null,
      metadata: input.metadata ?? {}
    }).select("id, status, provider, failure_reason").single();
    return { ok: false, log: failed.data, error: failed.error?.message ?? "Missing recipient email address." };
  }

  if (!preference.allowed) {
    const skipped = await supabase.from("email_delivery_logs").insert({
      template_id: template.id,
      recipient_profile_id: input.recipientProfileId,
      kindergarten_id: input.kindergartenId ?? null,
      category,
      recipient_email: recipient.email,
      subject_preview: subject.slice(0, 200),
      message_preview: text.slice(0, 500),
      status: "skipped_preferences",
      provider: "preferences",
      failure_reason: "User communication preferences do not allow this email category.",
      metadata: input.metadata ?? {}
    }).select("id, status, provider, failure_reason").single();
    return { ok: !skipped.error, log: skipped.data, error: skipped.error?.message ?? null };
  }

  const provider = getEmailProvider();
  const result = await provider.send({
    to: recipient.email,
    subject,
    text,
    html,
    category,
    metadata: input.metadata ?? {}
  });

  const log = await supabase.from("email_delivery_logs").insert({
    template_id: template.id,
    recipient_profile_id: input.recipientProfileId,
    kindergarten_id: input.kindergartenId ?? null,
    category,
    recipient_email: recipient.email,
    subject_preview: subject.slice(0, 200),
    message_preview: text.slice(0, 500),
    status: result.status,
    provider: result.provider,
    provider_message_id: result.providerMessageId ?? null,
    provider_reference: result.providerReference ?? null,
    failure_reason: result.failureReason ?? null,
    sent_at: result.status === "sent" ? new Date().toISOString() : null,
    failed_at: result.status === "failed" ? new Date().toISOString() : null,
    next_retry_at: result.status === "failed" ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
    metadata: {
      ...(input.metadata ?? {}),
      dry_run_payload: result.dryRunPayload ?? null
    }
  }).select("id, status, provider, provider_message_id, failure_reason").single();

  return {
    ok: !log.error && result.status !== "failed",
    log: log.data,
    error: log.error?.message ?? result.failureReason ?? null
  };
}
