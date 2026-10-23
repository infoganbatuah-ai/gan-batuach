import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { PUSH39_WEBHOOK_VERSION } from "./notification-orchestration";

const forbiddenHosts = new Set(["localhost", "localhost.localdomain", "metadata.google.internal", "metadata.aws.internal"]);

function privateIp(host: string) {
  if (isIP(host) === 4) {
    const [a, b] = host.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (isIP(host) === 6) {
    const value = host.toLowerCase();
    return value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
  }
  return false;
}

export function validateWebhookDestination(rawUrl: string, allowedHosts: string[]) {
  let destination: URL;
  try { destination = new URL(rawUrl); } catch { return { allowed: false as const, reason: "invalid_url" }; }
  const host = destination.hostname.toLowerCase().replace(/\.$/, "");
  if (destination.protocol !== "https:") return { allowed: false as const, reason: "https_required" };
  if (destination.username || destination.password) return { allowed: false as const, reason: "embedded_credentials_denied" };
  if (!host || forbiddenHosts.has(host) || host.endsWith(".localhost") || host.endsWith(".local") || privateIp(host)) return { allowed: false as const, reason: "private_destination_denied" };
  const normalized = allowedHosts.map((item) => item.toLowerCase().replace(/\.$/, ""));
  if (!normalized.includes(host)) return { allowed: false as const, reason: "destination_not_allowlisted" };
  return { allowed: true as const, reason: null, url: destination.toString(), host, fingerprint: createHash("sha256").update(destination.origin).digest("hex") };
}

export function webhookSignature(input: { body: string; timestamp: number; deliveryId: string; secret: string; keyVersion: number }) {
  const canonical = `${PUSH39_WEBHOOK_VERSION}.${input.keyVersion}.${input.timestamp}.${input.deliveryId}.${input.body}`;
  return `v1=${createHmac("sha256", input.secret).update(canonical).digest("hex")}`;
}

export function verifyWebhookSignature(input: { body: string; timestamp: number; deliveryId: string; signature: string | null; secret: string; keyVersion: number; now?: number; replayWindowSeconds?: number }) {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const window = Math.max(30, Math.min(input.replayWindowSeconds ?? 300, 900));
  if (!Number.isInteger(input.timestamp) || Math.abs(now - input.timestamp) > window) return { valid: false as const, reason: "timestamp_outside_replay_window" };
  if (!input.signature || !/^v1=[a-f0-9]{64}$/i.test(input.signature)) return { valid: false as const, reason: "signature_invalid" };
  const expected = webhookSignature(input);
  const valid = timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature));
  return valid ? { valid: true as const, reason: null } : { valid: false as const, reason: "signature_invalid" };
}

export function versionedWebhookPayload(input: { deliveryId: string; eventType: string; occurredAt: string; siteReference: string; status: string; productPath?: string | null }) {
  return {
    version: PUSH39_WEBHOOK_VERSION,
    delivery_id: input.deliveryId,
    event_type: input.eventType,
    occurred_at: input.occurredAt,
    site_reference: input.siteReference,
    status: input.status,
    product_path: input.productPath?.startsWith("/digital-observer/") ? input.productPath : null
  };
}
