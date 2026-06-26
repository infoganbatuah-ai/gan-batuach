import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { getIntegrationSafetyModes, getProviderMissingConfiguration } from "@/lib/domain/provider-integration-safety";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { assertRateLimit } from "@/lib/security/rate-limit";

type IntegrationKind = "payment" | "invoice";

const supportedEventTypes = [
  "payment_success",
  "payment_failed",
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "invoice_created",
  "invoice_sent",
  "invoice_paid",
  "invoice_failed",
  "receipt_created"
] as const;

const eventSchema = z.object({
  provider: z.string().trim().min(1).max(80).optional(),
  event_type: z.string().trim().min(1).max(120),
  event_id: z.string().trim().min(1).max(180),
  idempotency_key: z.string().trim().min(1).max(220).optional(),
  stream: z.enum(["gan_batuach_subscription", "parent_tuition", "digital_observer"]).optional(),
  related_entity_type: z.string().trim().max(80).optional(),
  related_entity_id: z.string().uuid().optional(),
  garden_id: z.string().uuid().optional(),
  subscription_id: z.string().uuid().optional(),
  payment_id: z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
  invoice_number: z.string().trim().max(120).optional(),
  amount: z.coerce.number().min(0).optional(),
  currency: z.string().trim().max(8).optional(),
  failure_reason: z.string().trim().max(500).optional(),
  occurred_at: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

function ipFor(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

function signatureHeader(request: Request) {
  return request.headers.get("x-webhook-signature")
    || request.headers.get("x-provider-signature")
    || request.headers.get("x-signature");
}

function verifySignature(body: string, signature: string | null, secret?: string) {
  if (!secret) return false;
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const received = signature.startsWith("sha256=") ? signature.slice("sha256=".length) : signature;
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function modeFor(kind: IntegrationKind) {
  const modes = getIntegrationSafetyModes();
  return kind === "payment"
    ? { mode: modes.payment, live: modes.livePaymentsAllowed, secretEnv: "PAYMENT_WEBHOOK_SECRET", secret: process.env.PAYMENT_WEBHOOK_SECRET }
    : { mode: modes.invoice, live: modes.productionInvoicesAllowed, secretEnv: "INVOICE_WEBHOOK_SECRET", secret: process.env.INVOICE_WEBHOOK_SECRET };
}

function webhookKey(kind: IntegrationKind, provider: string) {
  return `${kind}:${provider}`;
}

function isSupportedEventType(eventType: string) {
  return (supportedEventTypes as readonly string[]).includes(eventType);
}

function safeMetadata(payload: z.infer<typeof eventSchema>, mode: string, secretEnv: string) {
  return {
    stream: payload.stream ?? null,
    garden_id: payload.garden_id ?? null,
    subscription_id: payload.subscription_id ?? null,
    payment_id: payload.payment_id ?? null,
    invoice_id: payload.invoice_id ?? null,
    invoice_number: payload.invoice_number ?? null,
    amount: payload.amount ?? null,
    currency: payload.currency ?? "ILS",
    failure_reason: payload.failure_reason ?? null,
    occurred_at: payload.occurred_at ?? null,
    mode,
    signing_secret_env: secretEnv,
    note: "Raw webhook body is not stored by the app endpoint."
  };
}

async function recordEvent(input: {
  kind: IntegrationKind;
  provider: string;
  payload: z.infer<typeof eventSchema>;
  signatureValid: boolean;
  status: "received" | "verified" | "processed" | "failed" | "ignored" | "replayed";
  replayDetected?: boolean;
  errorMessage?: string;
  mode: string;
  secretEnv: string;
}) {
  const admin = createAdminClient();
  const key = webhookKey(input.kind, input.provider);
  const idempotencyKey = input.payload.idempotency_key ?? `${input.provider}:${input.payload.event_id}`;
  const existing = await admin
    .from("provider_webhook_events" as any)
    .select("id,status")
    .eq("webhook_key", key)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing.data?.id) {
    await admin.from("provider_webhook_events" as any).update({
      replay_detected: true,
      status: "replayed",
      error_message: "Duplicate provider webhook event ignored.",
      processed_at: new Date().toISOString()
    }).eq("id", existing.data.id);
    return { replay: true, eventId: existing.data.id, admin };
  }

  const insert = await admin.from("provider_webhook_events" as any).insert({
    webhook_key: key,
    integration_type: input.kind,
    provider: input.provider,
    event_type: input.payload.event_type,
    event_id: input.payload.event_id,
    idempotency_key: idempotencyKey,
    signature_valid: input.signatureValid,
    replay_detected: Boolean(input.replayDetected),
    status: input.status,
    related_entity_type: input.payload.related_entity_type ?? (input.payload.subscription_id ? "kindergarten_subscriptions" : input.payload.invoice_id ? "billing_invoices" : null),
    related_entity_id: input.payload.related_entity_id ?? input.payload.subscription_id ?? input.payload.invoice_id ?? null,
    raw_payload_reference: null,
    processed_at: input.status === "processed" || input.status === "ignored" || input.status === "failed" ? new Date().toISOString() : null,
    error_message: input.errorMessage ?? null,
    metadata: safeMetadata(input.payload, input.mode, input.secretEnv)
  }).select("id").single();

  if (insert.error) throw new Error(insert.error.message);
  return { replay: false, eventId: insert.data?.id, admin };
}

async function applyPaymentSideEffect(admin: ReturnType<typeof createAdminClient>, payload: z.infer<typeof eventSchema>, provider: string) {
  const subscriptionId = payload.subscription_id ?? (payload.related_entity_type === "kindergarten_subscriptions" ? payload.related_entity_id : undefined);
  if (!subscriptionId || payload.stream && payload.stream !== "gan_batuach_subscription") {
    return { applied: false, reason: "Only Gan Batuach subscription webhook side effects are enabled in PROD 1." };
  }

  const patch: Record<string, unknown> = {
    provider,
    updated_at: new Date().toISOString(),
    metadata: {
      last_provider_event_id: payload.event_id,
      last_provider_event_type: payload.event_type,
      payment_stream: "gan_batuach_subscription"
    }
  };

  if (["payment_success", "subscription_created", "subscription_updated"].includes(payload.event_type)) {
    patch.status = "active";
    patch.billing_status = "active";
    patch.trial_status = "converted";
  }
  if (payload.event_type === "payment_failed") {
    patch.status = "payment_failed";
    patch.billing_status = "failed";
    patch.suspension_reason = payload.failure_reason ?? "Provider payment failed.";
  }
  if (payload.event_type === "subscription_cancelled") {
    patch.status = "cancelled";
    patch.billing_status = "cancelled";
    patch.cancelled_at = new Date().toISOString();
  }

  const update = await admin.from("kindergarten_subscriptions" as any).update(patch).eq("id", subscriptionId).select("id,garden_id,status").maybeSingle();
  if (update.error || !update.data) return { applied: false, reason: update.error?.message ?? "subscription_not_found" };

  if (payload.amount !== undefined || payload.event_type === "payment_failed") {
    await admin.from("subscription_payments" as any).insert({
      subscription_id: subscriptionId,
      garden_id: (update.data as any).garden_id,
      provider,
      provider_payment_id: payload.payment_id ?? null,
      payment_reference: payload.event_id,
      amount: payload.amount ?? 0,
      currency: payload.currency ?? "ILS",
      billing_status: payload.event_type === "payment_failed" ? "failed" : "paid",
      gateway_status: payload.event_type === "payment_failed" ? "failed" : "captured",
      paid_at: payload.event_type === "payment_failed" ? null : payload.occurred_at ?? new Date().toISOString(),
      failed_at: payload.event_type === "payment_failed" ? payload.occurred_at ?? new Date().toISOString() : null,
      failure_reason: payload.failure_reason ?? null,
      metadata: { source: "provider_webhook", event_id: payload.event_id, revenue_stream: "gan_batuach_subscription" }
    });
  }

  return { applied: true, gardenId: (update.data as any).garden_id, status: (update.data as any).status };
}

async function applyInvoiceSideEffect(admin: ReturnType<typeof createAdminClient>, payload: z.infer<typeof eventSchema>) {
  const invoiceId = payload.invoice_id ?? (payload.related_entity_type === "billing_invoices" ? payload.related_entity_id : undefined);
  if (!invoiceId) return { applied: false, reason: "invoice_id_required_for_safe_update" };
  const patch: Record<string, unknown> = { metadata: { last_provider_event_id: payload.event_id, stream: payload.stream ?? null } };
  if (payload.event_type === "invoice_sent") patch.email_status = "sent";
  if (payload.event_type === "invoice_failed") patch.email_status = "failed";
  if (payload.event_type === "invoice_paid" || payload.event_type === "receipt_created") patch.billing_status = "paid";
  const update = await admin.from("billing_invoices" as any).update(patch).eq("id", invoiceId).select("id").maybeSingle();
  if (update.error || !update.data) return { applied: false, reason: update.error?.message ?? "invoice_not_found" };
  return { applied: true };
}

export async function handleProviderWebhook(request: Request, kind: IntegrationKind) {
  try {
    if (!isAdminClientConfigured()) return fail("Webhook readiness requires server-side Supabase service role configuration.", 503);
    await assertRateLimit(ipFor(request), `/api/webhooks/${kind}`, 30, 60);

    const rawBody = await request.text();
    const parsedJson = JSON.parse(rawBody || "{}");
    const payload = eventSchema.parse(parsedJson);
    const provider = payload.provider ?? process.env[kind === "payment" ? "PAYMENT_PROVIDER" : "INVOICE_PROVIDER"] ?? "provider";
    const guard = modeFor(kind);
    const signatureValid = verifySignature(rawBody, signatureHeader(request), guard.secret);
    const signatureRequired = guard.live || Boolean(guard.secret);
    const missing = getProviderMissingConfiguration(kind, provider);
    const supportedEvent = isSupportedEventType(payload.event_type);

    if (signatureRequired && !signatureValid) {
      await recordEvent({
        kind,
        provider,
        payload,
        signatureValid,
        status: "failed",
        errorMessage: `${guard.secretEnv} signature validation failed or missing.`,
        mode: guard.mode,
        secretEnv: guard.secretEnv
      }).catch((error) => console.error("[provider-webhook-signature-log]", error));
      return fail("Invalid or missing webhook signature.", 401);
    }

    const shouldApplySideEffects = supportedEvent && guard.live && missing.length === 0 && signatureValid;
    const eventRecord = await recordEvent({
      kind,
      provider,
      payload,
      signatureValid,
      status: shouldApplySideEffects ? "verified" : "ignored",
      errorMessage: shouldApplySideEffects
        ? undefined
        : supportedEvent
          ? "Provider mode is not live/production with verified configuration; side effects skipped."
          : "Unsupported webhook event type ignored safely.",
      mode: guard.mode,
      secretEnv: guard.secretEnv
    });

    if (eventRecord.replay) return ok({ status: "duplicate_ignored", replay_detected: true });
    if (!shouldApplySideEffects) {
      return ok({
        status: "readiness_logged",
        side_effects_applied: false,
        mode: guard.mode,
        supported_event: supportedEvent,
        missing_configuration: missing,
        signature_valid: signatureValid
      }, 202);
    }

    const result = kind === "payment"
      ? await applyPaymentSideEffect(eventRecord.admin, payload, provider)
      : await applyInvoiceSideEffect(eventRecord.admin, payload);
    await eventRecord.admin.from("provider_webhook_events" as any).update({
      status: result.applied ? "processed" : "failed",
      processed_at: new Date().toISOString(),
      error_message: result.applied ? null : result.reason ?? "side_effect_not_applied",
      metadata: { ...safeMetadata(payload, guard.mode, guard.secretEnv), side_effect_result: result }
    }).eq("id", eventRecord.eventId);

    return ok({ status: result.applied ? "processed" : "logged_with_blocker", side_effects_applied: result.applied, result });
  } catch (error) {
    console.error("[provider-webhook]", error);
    return fail("Webhook processing failed safely.", 400);
  }
}
