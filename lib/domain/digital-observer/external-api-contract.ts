import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const DIGITAL_OBSERVER_EXTERNAL_API_VERSION = "2026-10-19.v1";
export const DIGITAL_OBSERVER_EXTERNAL_API_PREFIX = "/api/digital-observer/external/v1";
export const DIGITAL_OBSERVER_EXTERNAL_WEBHOOK_VERSION = "do-external-webhook-v1";

export const externalApiScopes = [
  "cameras.read", "events.read", "incidents.read", "evidence.read", "investigations.run",
  "watch_rules.read", "watch_rules.write", "webhooks.read", "webhooks.write",
  "integrations.read", "federation.query", "gan_batuach.read"
] as const;

export type ExternalApiScope = (typeof externalApiScopes)[number];

export const externalApiPermissionMap: Record<ExternalApiScope, string> = {
  "cameras.read": "camera.live.view",
  "events.read": "events.view",
  "incidents.read": "events.view",
  "evidence.read": "evidence.view",
  "investigations.run": "investigation.run",
  "watch_rules.read": "events.view",
  "watch_rules.write": "watch_rules.manage",
  "webhooks.read": "notifications.manage",
  "webhooks.write": "notifications.manage",
  "integrations.read": "camera.live.view",
  "federation.query": "investigation.run",
  "gan_batuach.read": "events.view"
};

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(500).optional()
});

export const siteQuerySchema = paginationSchema.extend({
  site_id: z.string().uuid(),
  camera_id: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});

export const investigationRequestSchema = z.object({
  site_id: z.string().uuid(),
  question: z.string().trim().min(2).max(500),
  camera_id: z.string().uuid().optional(),
  cursor: z.number().int().min(0).max(500).default(0),
  limit: z.number().int().min(1).max(25).default(25)
}).strict();

export const watchRuleRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("compile"), site_id: z.string().uuid(), text: z.string().trim().min(3).max(1200), camera_id: z.string().uuid().nullable().optional() }).strict(),
  z.object({ action: z.literal("set_state"), site_id: z.string().uuid(), rule_id: z.string().uuid(), state: z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]) }).strict()
]);

const webhookSite = z.string().uuid();
const webhookId = z.string().uuid();
export const webhookSubscriptionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("register"), site_id: webhookSite,
    display_name: z.string().trim().min(2).max(100),
    destination_url: z.string().url().max(2000),
    allowed_event_types: z.array(z.enum(["event.created", "incident.opened", "incident.updated", "evidence.available", "camera.health.changed"])).min(1).max(10),
    mode: z.enum(["disabled", "sandbox"]).default("disabled"),
    signing_key_reference: z.string().regex(/^secret:\/\/[a-zA-Z0-9/_-]+$/).max(500)
  }).strict(),
  z.object({ action: z.literal("rotate_key"), site_id: webhookSite, subscription_id: webhookId,
    signing_key_reference: z.string().regex(/^secret:\/\/[a-zA-Z0-9/_-]+$/).max(500) }).strict(),
  z.object({ action: z.literal("revoke"), site_id: webhookSite, subscription_id: webhookId }).strict()
]);

export const federationQuerySchema = z.object({
  site_id: z.string().uuid(),
  source_ids: z.array(z.string().uuid()).min(1).max(20),
  query: z.string().trim().min(2).max(500),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
}).strict();

export const integrationDeepLinkSchema = z.object({
  site_id: z.string().uuid(),
  source_id: z.string().uuid(),
  resource_id: z.string().trim().min(1).max(300)
}).strict();

export const ganBatuachRoleMapping = {
  garden_manager: ["camera.health.read", "events.reviewed.read", "incidents.read"],
  authorized_inspector: ["camera.health.read", "events.reviewed.read", "incidents.read", "evidence.metadata.read"],
  staff: [],
  parent: []
} as const;

export function parseCursor(cursor?: string) {
  if (!cursor) return 0;
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const value = Number(decoded);
    if (!Number.isInteger(value) || value < 0 || value > 100_000) throw new Error();
    return value;
  } catch { throw new Error("INVALID_CURSOR"); }
}

export function encodeCursor(offset: number) {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

export function externalApiSignature(input: { method: string; path: string; timestamp: string; nonce: string; body: string; credential: string }) {
  const bodyDigest = createHash("sha256").update(input.body).digest("hex");
  const canonical = [DIGITAL_OBSERVER_EXTERNAL_API_VERSION, input.method.toUpperCase(), input.path, input.timestamp, input.nonce, bodyDigest].join("\n");
  return `v1=${createHmac("sha256", input.credential).update(canonical).digest("hex")}`;
}

export function verifyExternalApiSignature(input: {
  method: string; path: string; timestamp: string | null; nonce: string | null; body: string;
  signature: string | null; credential: string; now?: number; replayWindowSeconds?: number;
}) {
  if (!input.timestamp || !/^\d{10}$/.test(input.timestamp)) return { valid: false as const, reason: "timestamp_required" };
  if (!input.nonce || !/^[A-Za-z0-9_-]{16,120}$/.test(input.nonce)) return { valid: false as const, reason: "nonce_required" };
  if (!input.signature || !/^v1=[a-f0-9]{64}$/i.test(input.signature)) return { valid: false as const, reason: "signature_required" };
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const window = Math.max(30, Math.min(input.replayWindowSeconds ?? 300, 900));
  if (Math.abs(now - Number(input.timestamp)) > window) return { valid: false as const, reason: "timestamp_outside_replay_window" };
  const expected = externalApiSignature({ ...input, timestamp: input.timestamp, nonce: input.nonce });
  const valid = expected.length === input.signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature));
  return valid ? { valid: true as const, reason: null } : { valid: false as const, reason: "signature_invalid" };
}

export function safeExternalProductPath(path: string) {
  if (!path.startsWith("/digital-observer/") || path.startsWith("//") || path.includes("..")) throw new Error("INVALID_PRODUCT_PATH");
  return path;
}

export function integrationCapabilityTruth(input: { kind: string; configured: boolean; realProof: boolean; supportsDeepLink?: boolean }) {
  return {
    kind: input.kind,
    status: input.realProof ? "CONNECTED_AND_VERIFIED" : input.configured ? "CONNECTED_NOT_PROVEN" : "NOT_CONFIGURED",
    supports_deep_link: Boolean(input.supportsDeepLink && input.configured),
    universal_compatibility_claimed: false,
    external_proof_required: !input.realProof
  } as const;
}

export function externalApiError(code: string, requestId: string, details?: Record<string, unknown>) {
  return { error: { code, message: code.toLowerCase().replaceAll("_", " "), request_id: requestId, details: details ?? null }, api_version: DIGITAL_OBSERVER_EXTERNAL_API_VERSION };
}

export function externalWebhookPayload(input: { id: string; eventType: string; organizationId: string; siteId: string; resourceId: string; occurredAt: string; productPath: string }) {
  return {
    version: DIGITAL_OBSERVER_EXTERNAL_WEBHOOK_VERSION,
    id: input.id,
    event_type: input.eventType,
    occurred_at: input.occurredAt,
    organization_id: input.organizationId,
    site_id: input.siteId,
    resource: { id: input.resourceId, product_path: safeExternalProductPath(input.productPath) },
    sensitive_media_embedded: false
  };
}

export function externalWebhookSignature(input: { payload: string; timestamp: number; deliveryId: string; secret: string; keyVersion: number }) {
  const canonical = `${DIGITAL_OBSERVER_EXTERNAL_WEBHOOK_VERSION}.${input.keyVersion}.${input.timestamp}.${input.deliveryId}.${input.payload}`;
  return `v1=${createHmac("sha256", input.secret).update(canonical).digest("hex")}`;
}

export function verifyExternalWebhookSignature(input: { payload: string; timestamp: number; deliveryId: string; signature: string; secret: string; keyVersion: number; now?: number }) {
  if (Math.abs((input.now ?? Math.floor(Date.now() / 1000)) - input.timestamp) > 300) return { valid: false as const, reason: "timestamp_outside_replay_window" };
  if (!/^v1=[a-f0-9]{64}$/i.test(input.signature)) return { valid: false as const, reason: "signature_invalid" };
  const expected = externalWebhookSignature(input);
  const valid = expected.length === input.signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature));
  return valid ? { valid: true as const, reason: null } : { valid: false as const, reason: "signature_invalid" };
}
