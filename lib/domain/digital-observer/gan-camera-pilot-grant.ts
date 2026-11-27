import "server-only";
import { randomBytes, verify, type KeyObject } from "node:crypto";
import { z } from "zod";

const maxTtlMs = 45_000;
const identifier = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const handleSchema = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/);
const bindingSchema = z.object({
  viewerId: identifier,
  role: z.enum(["owner", "manager", "parent", "staff"]),
  gardenId: identifier,
  siteId: identifier,
  cameraId: identifier,
  protocol: z.literal("WebRTC")
}).strict();
const assertionFields = {
  version: z.literal(1),
  issuer: z.literal("gan_batuach"),
  audience: z.literal("digital_observer:gan_camera_pilot"),
  environment: z.literal("development"),
  binding: bindingSchema,
  sessionId: identifier,
  jti: handleSchema,
  issuedAtMs: z.number().int().nonnegative(),
  expiresAtMs: z.number().int().nonnegative()
};
const assertionSchema = z.discriminatedUnion("operation", [
  z.object({ ...assertionFields, operation: z.literal("issue") }).strict(),
  z.object({ ...assertionFields, operation: z.literal("redeem"), handle: handleSchema }).strict()
]);

type Binding = z.infer<typeof bindingSchema>;
type Assertion = z.infer<typeof assertionSchema>;
export type GanCameraPilotScope = Binding & {
  sessionId: string;
  tenantId: string;
  sourceId: string;
  gatewayId: string;
  streamId: string;
};
export type GanCameraPilotGrantRecord = { scope: GanCameraPilotScope; handle: string; expiresAtMs: number };

export const ganCameraPilotLimits = Object.freeze({
  durationSeconds: 300,
  cumulativeBytes: 100 * 1024 * 1024,
  viewers: 1,
  streams: 1,
  sources: 1
});

// Server-only port. An implementation must atomically create a unique handle
// and reserve the issuer's jti until assertion expiry. Consume must compare
// the entire scope and check the expiry/revocation at commit time before
// consuming the handle once. The trusted owner can revoke via the same store.
export type GanCameraPilotGrantStore = {
  issue(record: GanCameraPilotGrantRecord, assertionId: string): Promise<boolean>;
  consume(handle: string, scope: GanCameraPilotScope, assertionExpiresAtMs: number): Promise<GanCameraPilotGrantRecord | null>;
  revoke(handle: string): Promise<void>;
};

function verifyAssertion(signed: string, key: KeyObject, now: number): Assertion | null {
  if (typeof signed !== "string" || signed.length > 4096 || key.type !== "public" || key.asymmetricKeyType !== "ed25519") return null;
  const [payload, signature, extra] = signed.split(".");
  if (extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(payload ?? "") || !/^[A-Za-z0-9_-]{86}$/.test(signature ?? "")) return null;
  const signatureBytes = Buffer.from(signature, "base64url");
  if (signatureBytes.toString("base64url") !== signature || !verify(null, Buffer.from(payload), key, signatureBytes)) return null;
  const result = assertionSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  if (!result.success) return null;
  const { issuedAtMs, expiresAtMs } = result.data;
  if (issuedAtMs > now || expiresAtMs <= now || expiresAtMs - issuedAtMs > maxTtlMs) return null;
  return result.data;
}

function sameBinding(left: Binding, right: Binding) {
  return Object.keys(bindingSchema.shape).every((key) => left[key as keyof Binding] === right[key as keyof Binding]);
}

function sameScope(left: GanCameraPilotScope, right: GanCameraPilotScope) {
  return sameBinding(left, right) && left.sessionId === right.sessionId && left.tenantId === right.tenantId &&
    left.sourceId === right.sourceId && left.gatewayId === right.gatewayId && left.streamId === right.streamId;
}

type ProviderOptions = {
  environment: string;
  qaGardenId: string;
  signedAssertion: string;
  ganPublicKey: KeyObject;
  // Resolve from authoritative QA mappings plus current viewer/session access.
  // Missing, revoked, unverified or out-of-domain relationships must return null.
  resolveScope: (binding: Binding, sessionId: string) => Promise<GanCameraPilotScope | null>;
  store: GanCameraPilotGrantStore;
  now?: () => number;
};

/** Offline provider boundary compatible with Gan's issue(binding)/consume(binding, handle). */
export function createGanCameraPilotGrantProvider({ environment, qaGardenId, signedAssertion, ganPublicKey, resolveScope, store, now = Date.now }: ProviderOptions) {
  async function execute(operation: Assertion["operation"], requested: Binding, handle?: string) {
    if (environment !== "development") return null;
    try {
      const assertion = verifyAssertion(signedAssertion, ganPublicKey, now());
      const binding = bindingSchema.safeParse(requested);
      if (!assertion || !binding.success || binding.data.gardenId !== qaGardenId ||
          assertion.operation !== operation || !sameBinding(assertion.binding, binding.data)) return null;
      if (assertion.operation === "redeem" && assertion.handle !== handle) return null;
      const resolved = await resolveScope(binding.data, assertion.sessionId);
      if (!resolved || !sameBinding(resolved, binding.data) || resolved.sessionId !== assertion.sessionId ||
          ![resolved.tenantId, resolved.sourceId, resolved.gatewayId, resolved.streamId].every((value) => identifier.safeParse(value).success)) return null;
      const { tenantId, sourceId, gatewayId, streamId, sessionId } = resolved;
      const scope = { ...binding.data, tenantId, sourceId, gatewayId, streamId, sessionId };
      if (now() >= assertion.expiresAtMs) return null;

      let record: GanCameraPilotGrantRecord | null;
      if (assertion.operation === "issue") {
        record = { scope, handle: randomBytes(32).toString("base64url"), expiresAtMs: assertion.expiresAtMs };
        if (!await store.issue(record, assertion.jti)) return null;
      } else {
        record = await store.consume(assertion.handle, scope, assertion.expiresAtMs);
        if (!record || record.handle !== assertion.handle || !sameScope(record.scope, scope)) return null;
      }
      const expiresAtMs = Math.min(record.expiresAtMs, assertion.expiresAtMs);
      const returnedAtMs = now();
      if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= returnedAtMs || expiresAtMs - returnedAtMs > maxTtlMs) return null;
      return { ...binding.data, version: 1, environment: "development", capability: "live_playback",
        recording: false, operation, handle: record.handle, expiresAtMs } as const;
    } catch {
      return null;
    }
  }

  return {
    issue: (binding: Binding) => execute("issue", binding),
    consume: (binding: Binding, handle: string) => execute("redeem", binding, handle)
  };
}
