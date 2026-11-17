import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const DIGITAL_OBSERVER_PARTNER_CONTRACT = "digital-observer-partner-v1";
export const partnerTypes = ["manufacturer", "security_company", "monitoring_center", "vms_provider", "smart_home", "enterprise_software", "reseller", "oem", "white_label"] as const;
export const embeddedScopes = ["cameras.read", "camera_health.read", "events.read", "incidents.read", "evidence.read", "investigations.read", "alerts.read"] as const;
export type EmbeddedScope = (typeof embeddedScopes)[number];

const httpsOrLocal = z.string().url().max(1000).refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
}, "HTTPS_REQUIRED");

export const brandProfileSchema = z.object({
  brand_name: z.string().trim().min(2).max(100),
  product_name: z.string().trim().min(2).max(100),
  logo_url: httpsOrLocal.nullable().optional(),
  primary_color: z.string().regex(/^#[0-9a-f]{6}$/i),
  accent_color: z.string().regex(/^#[0-9a-f]{6}$/i),
  support_url: httpsOrLocal.nullable().optional(),
  privacy_url: httpsOrLocal,
  terms_url: httpsOrLocal,
  customer_domain: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+$/).max(253).nullable().optional(),
  notification_sender_label: z.string().trim().min(2).max(80).nullable().optional(),
  legally_required_notices: z.array(z.string().trim().min(2).max(500)).min(1).max(20)
}).strict();

export const partnerProvisioningSchema = z.object({
  customer_organization_id: z.string().uuid(),
  external_customer_reference: z.string().trim().min(3).max(200),
  site_ids: z.array(z.string().uuid()).min(1).max(1000),
  entitlement_grant_ids: z.array(z.string().uuid()).min(1).max(100),
  idempotency_key: z.string().regex(/^[A-Za-z0-9._:-]{8,200}$/)
}).strict();

export const embeddedSessionSchema = z.object({
  partner_customer_id: z.string().uuid(), site_id: z.string().uuid(),
  audience: z.string().trim().min(3).max(200), allowed_origin: httpsOrLocal,
  scopes: z.array(z.enum(embeddedScopes)).min(1).max(embeddedScopes.length),
  ttl_minutes: z.number().int().min(1).max(60).default(15)
}).strict();

export function customerReference(value: string) {
  const normalized = value.trim();
  return { hash: createHash("sha256").update(normalized).digest("hex"), hint: `${normalized.slice(0, 3)}…${normalized.slice(-2)}` };
}

export function validateEmbedOrigin(origin: string, allowlist: string[]) {
  const parsed = new URL(origin);
  if (parsed.username || parsed.password || parsed.hash || parsed.pathname !== "/" || parsed.search) throw new Error("PARTNER_EMBED_ORIGIN_INVALID");
  const normalized = parsed.origin;
  if (!allowlist.includes(normalized)) throw new Error("PARTNER_EMBED_ORIGIN_DENIED");
  return normalized;
}

export function issueEmbeddedToken(input: { pepper: string; ttlMinutes: number; now?: number }) {
  if (input.pepper.length < 16) throw new Error("PARTNER_TOKEN_PEPPER_REQUIRED");
  const now = input.now ?? Date.now();
  const raw = `doemb_${randomBytes(32).toString("base64url")}`;
  return { raw, prefix: raw.slice(0, 14), hash: createHmac("sha256", input.pepper).update(raw).digest("hex"),
    expiresAt: new Date(now + Math.min(60, Math.max(1, input.ttlMinutes)) * 60_000).toISOString() };
}

export function hashEmbeddedToken(raw: string, pepper: string) {
  return createHmac("sha256", pepper).update(raw).digest("hex");
}

export function verifyEmbeddedAudience(input: { expected: string; actual: string }) {
  const expected = Buffer.from(input.expected);
  const actual = Buffer.from(input.actual);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function partnerCustomerTransition(from: string, to: string) {
  const transitions: Record<string, string[]> = {
    provisioning: ["active", "suspended", "deprovisioned"], active: ["suspended", "deprovisioned"],
    suspended: ["active", "deprovisioned"], deprovisioned: []
  };
  if (!transitions[from]?.includes(to)) throw new Error("PARTNER_CUSTOMER_TRANSITION_DENIED");
  return to;
}

export function publicBrandProfile<T extends Record<string, unknown>>(row: T) {
  const safe = Object.fromEntries(Object.entries(row).filter(([key]) => key !== "partner_id" && key !== "updated_by"));
  return { ...safe, platform_brand_exposed: false, legally_required_notices_preserved: true };
}
