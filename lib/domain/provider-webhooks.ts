import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { getIntegrationSafetyModes } from "@/lib/domain/provider-integration-safety";
import { normalizeFinancialEventType } from "@/lib/domain/financial-provider-policy";
import { verifyLegacyHmacSignature } from "@/lib/domain/provider-webhook-signature";
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
    currency: payload.currency ?? null,
    failure_reason: payload.failure_reason ?? null,
    occurred_at: payload.occurred_at ?? null,
    mode,
    signing_secret_env: secretEnv,
    note: "Raw webhook body is not stored by the app endpoint.",
    normalized_event_type: normalizeFinancialEventType(payload.event_type)
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
    // A retry must never replace the original processed/failed event state.
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

export async function handleProviderWebhook(request: Request, kind: IntegrationKind) {
  try {
    if (!isAdminClientConfigured()) return fail("Webhook readiness requires server-side Supabase service role configuration.", 503);
    // This generic HMAC endpoint has no provider-specific signature parser, checkout
    // intent, account binding or authoritative retrieval adapter. It may retain a
    // signed event for review, but cannot settle money or issue a tax document.
    const guard = modeFor(kind);
    if (!guard.secret) return fail("Provider webhook verification is not configured.", 503);

    const rawBody = await request.text();
    if (!verifyLegacyHmacSignature(rawBody, signatureHeader(request), guard.secret)) {
      return fail("Invalid or missing webhook signature.", 401);
    }
    await assertRateLimit(ipFor(request), `/api/webhooks/${kind}`, 30, 60);
    const parsedJson = JSON.parse(rawBody || "{}");
    const payload = eventSchema.parse(parsedJson);
    const configuredProvider = process.env[kind === "payment" ? "PAYMENT_PROVIDER" : "INVOICE_PROVIDER"];
    if (!configuredProvider || (payload.provider && payload.provider !== configuredProvider)) {
      return fail("Webhook provider account mismatch or not configured.", 403);
    }
    const provider = configuredProvider;
    const supportedEvent = isSupportedEventType(payload.event_type);
    const eventRecord = await recordEvent({
      kind,
      provider,
      payload,
      signatureValid: true,
      status: "ignored",
      errorMessage: supportedEvent
        ? "Provider-specific verification and bound checkout intent are unavailable; no financial side effect."
        : "Unsupported webhook event type ignored safely.",
      mode: guard.mode,
      secretEnv: guard.secretEnv
    });

    if (eventRecord.replay) return ok({ status: "duplicate_ignored", replay_detected: true });
    return ok({ status: "verification_pending", side_effects_applied: false, mode: guard.mode, supported_event: supportedEvent }, 202);
  } catch (error) {
    console.error("[provider-webhook]", error);
    return fail("Webhook processing failed safely.", 400);
  }
}
