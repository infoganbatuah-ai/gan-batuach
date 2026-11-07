/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 39 tables precede generated Supabase database types. */
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { applyAuthenticatedCallback } from "@/lib/domain/digital-observer/notification-delivery-service";
import { verifyWebhookSignature } from "@/lib/domain/digital-observer/webhook-security";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const schema = z.object({ delivery_id: z.string().uuid(), provider_key: z.string().trim().min(1).max(100),
  provider_event_id: z.string().trim().min(1).max(180), outcome: z.enum(["success", "timeout", "rate_limit", "temporary_failure", "permanent_failure", "unknown_outcome", "acknowledged", "expired", "cancelled"]),
  occurred_at: z.string().datetime().nullable().optional(), metadata: z.record(z.string(), z.unknown()).optional() }).strict();

export async function POST(request: Request) {
  try {
    if (!isAdminClientConfigured()) return fail("Provider callbacks are unavailable.", 503);
    const secret = process.env.DIGITAL_OBSERVER_PROVIDER_CALLBACK_SECRET;
    if (!secret) return fail("Provider callback verification is disabled.", 503);
    const rawBody = await request.text();
    const parsed = schema.parse(JSON.parse(rawBody || "{}"));
    const admin = createAdminClient() as any;
    const delivery = await admin.from("digital_observer_notification_deliveries")
      .select("id,observer_site_id,channel,provider_mode,metadata").eq("id", parsed.delivery_id).maybeSingle();
    if (!delivery.data || delivery.data.provider_mode !== "production") return fail("Provider callback target is not an active Production delivery.", 409);
    const provider = await admin.from("digital_observer_provider_channels")
      .select("provider_key,provider_mode,active,configuration_status,callback_key_version")
      .eq("observer_site_id", delivery.data.observer_site_id).eq("channel", delivery.data.channel).maybeSingle();
    if (!provider.data || provider.data.provider_key !== parsed.provider_key || provider.data.provider_mode !== "production"
      || provider.data.active !== true || provider.data.configuration_status !== "ready") return fail("Provider callback source is not authorized.", 403);
    const timestamp = Number(request.headers.get("x-do-timestamp"));
    const keyVersion = Number(request.headers.get("x-do-key-version") || "1");
    if (keyVersion !== provider.data.callback_key_version) return fail("Provider callback key version is revoked or stale.", 401);
    const verification = verifyWebhookSignature({ body: rawBody, timestamp, deliveryId: parsed.delivery_id,
      signature: request.headers.get("x-do-signature"), secret, keyVersion });
    if (!verification.valid) return fail(`Callback rejected: ${verification.reason}.`, 401);
    const result = await applyAuthenticatedCallback(admin, { deliveryId: parsed.delivery_id,
      providerKey: parsed.provider_key, providerEventId: parsed.provider_event_id, outcome: parsed.outcome,
      occurredAt: parsed.occurred_at, safeMetadata: parsed.metadata });
    return ok(result, result.replay ? 200 : 202);
  } catch (error) { return handleRouteError(error); }
}
