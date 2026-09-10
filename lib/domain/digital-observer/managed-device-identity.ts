import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  timingSafeEqual,
  verify
} from "node:crypto";
import { z } from "zod";

export const managedDeviceIdentityProtocol = "observer-managed-device-v1" as const;
export const managedDeviceSignatureAlgorithm = "Ed25519" as const;
export const managedDeviceRequestSkewMs = 2 * 60_000;
export const managedDeviceNonceTtlMs = 5 * 60_000;

export const managedDeviceProfiles = ["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY", "ENTERPRISE_EDGE"] as const;
export type ManagedDeviceProfile = (typeof managedDeviceProfiles)[number];

export const managedDeviceOperations = [
  "AUTHENTICATE",
  "HEARTBEAT",
  "CONFIG_READ",
  "COMMAND_POLL",
  "DISCOVERY_PUBLISH",
  "LEARNING_PUBLISH",
  "EVENT_INGEST",
  "MEDIA_UPLOAD",
  "PLAYBACK_GRANT",
  "CREDENTIAL_ROTATE",
  "UPDATE_READ",
  "UPDATE_STATUS"
] as const;
export type ManagedDeviceOperation = (typeof managedDeviceOperations)[number];

export type ManagedDevicePrincipal = {
  deviceId: string;
  enrollmentId: string;
  tenantId: string | null;
  siteId: string;
  profile: ManagedDeviceProfile;
  credentialVersion: number;
  runtimeVersion: string | null;
  configVersion: number;
  enrollmentState: "HARDENED" | "LEGACY";
  lifecycleState: "ACTIVE" | "REVOKED" | "LOST" | "REPLACED" | "RETIRED";
  lastSeenAt: string | null;
};

export const publicKeySpkiSchema = z.string().regex(/^[A-Za-z0-9_-]{40,256}$/);
const uuidSchema = z.string().uuid();
const boundedIdentifier = z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/);

export const managedDeviceProofSchema = z.object({
  protocol: z.literal(managedDeviceIdentityProtocol),
  deviceId: uuidSchema,
  credentialVersion: z.number().int().positive().max(1_000_000),
  timestamp: z.string().datetime(),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  runtimeInstanceId: boundedIdentifier,
  sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  signature: z.string().regex(/^[A-Za-z0-9_-]{64,128}$/)
}).strict();

export type ManagedDeviceProof = z.infer<typeof managedDeviceProofSchema>;

export function generateManagedDeviceKeyPair() {
  const pair = generateKeyPairSync("ed25519");
  return {
    algorithm: managedDeviceSignatureAlgorithm,
    publicKeySpki: pair.publicKey.export({ format: "der", type: "spki" }).toString("base64url"),
    privateKeyPkcs8: pair.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64url")
  };
}

export function hashManagedDeviceBody(body: string | Uint8Array) {
  return createHash("sha256").update(body).digest("hex");
}

export function canonicalManagedDeviceRequest(input: {
  method: string;
  pathname: string;
  bodyHash: string;
  deviceId: string;
  credentialVersion: number;
  timestamp: string;
  nonce: string;
  runtimeInstanceId: string;
  sequence: number;
}) {
  if (!/^[a-f0-9]{64}$/.test(input.bodyHash) || !input.pathname.startsWith("/")) throw new Error("MANAGED_DEVICE_CANONICAL_INPUT_INVALID");
  return [managedDeviceIdentityProtocol, input.method.toUpperCase(), input.pathname, input.bodyHash,
    input.deviceId, String(input.credentialVersion), input.timestamp, input.nonce,
    input.runtimeInstanceId, String(input.sequence)].join("\n");
}

export function createManagedDeviceProof(input: {
  method: string;
  pathname: string;
  body: string | Uint8Array;
  deviceId: string;
  credentialVersion: number;
  privateKeyPkcs8: string;
  runtimeInstanceId: string;
  sequence: number;
  now?: number;
  nonce?: string;
}): ManagedDeviceProof {
  const proof = {
    protocol: managedDeviceIdentityProtocol,
    deviceId: input.deviceId,
    credentialVersion: input.credentialVersion,
    timestamp: new Date(input.now ?? Date.now()).toISOString(),
    nonce: input.nonce ?? randomBytes(32).toString("base64url"),
    runtimeInstanceId: input.runtimeInstanceId,
    sequence: input.sequence,
    signature: ""
  } as ManagedDeviceProof;
  const canonical = canonicalManagedDeviceRequest({
    method: input.method,
    pathname: input.pathname,
    bodyHash: hashManagedDeviceBody(input.body),
    ...proof
  });
  proof.signature = sign(null, Buffer.from(canonical), createPrivateKey({
    key: Buffer.from(input.privateKeyPkcs8, "base64url"), format: "der", type: "pkcs8"
  })).toString("base64url");
  return managedDeviceProofSchema.parse(proof);
}

export function verifyManagedDeviceProof(input: {
  proof: unknown;
  method: string;
  pathname: string;
  body: string | Uint8Array;
  publicKeySpki: string;
  now?: number;
}) {
  const proof = managedDeviceProofSchema.safeParse(input.proof);
  if (!proof.success) return { ok: false as const, reason: "PROOF_INVALID" as const };
  const observedAt = Date.parse(proof.data.timestamp);
  const now = input.now ?? Date.now();
  if (!Number.isFinite(observedAt) || Math.abs(now - observedAt) > managedDeviceRequestSkewMs) {
    return { ok: false as const, reason: "PROOF_EXPIRED" as const };
  }
  try {
    const canonical = canonicalManagedDeviceRequest({ method: input.method, pathname: input.pathname,
      bodyHash: hashManagedDeviceBody(input.body), ...proof.data });
    const valid = verify(null, Buffer.from(canonical), createPublicKey({
      key: Buffer.from(publicKeySpkiSchema.parse(input.publicKeySpki), "base64url"), format: "der", type: "spki"
    }), Buffer.from(proof.data.signature, "base64url"));
    return valid ? { ok: true as const, proof: proof.data } : { ok: false as const, reason: "SIGNATURE_INVALID" as const };
  } catch {
    return { ok: false as const, reason: "PUBLIC_KEY_INVALID" as const };
  }
}

export function managedDeviceProofHeaders(proof: ManagedDeviceProof) {
  return {
    "x-observer-device-protocol": proof.protocol,
    "x-observer-device-id": proof.deviceId,
    "x-observer-device-credential-version": String(proof.credentialVersion),
    "x-observer-device-timestamp": proof.timestamp,
    "x-observer-device-nonce": proof.nonce,
    "x-observer-device-runtime-instance": proof.runtimeInstanceId,
    "x-observer-device-sequence": String(proof.sequence),
    "x-observer-device-signature": proof.signature
  };
}

export function managedDeviceProofFromHeaders(headers: Headers): ManagedDeviceProof | null {
  const protocol = headers.get("x-observer-device-protocol");
  if (!protocol) return null;
  const parsed = managedDeviceProofSchema.safeParse({
    protocol,
    deviceId: headers.get("x-observer-device-id"),
    credentialVersion: Number(headers.get("x-observer-device-credential-version")),
    timestamp: headers.get("x-observer-device-timestamp"),
    nonce: headers.get("x-observer-device-nonce"),
    runtimeInstanceId: headers.get("x-observer-device-runtime-instance"),
    sequence: Number(headers.get("x-observer-device-sequence")),
    signature: headers.get("x-observer-device-signature")
  });
  return parsed.success ? parsed.data : null;
}

export function managedDevicePermissions(profile: ManagedDeviceProfile): readonly ManagedDeviceOperation[] {
  const common: ManagedDeviceOperation[] = ["AUTHENTICATE", "HEARTBEAT", "CONFIG_READ",
    "DISCOVERY_PUBLISH", "LEARNING_PUBLISH", "EVENT_INGEST", "MEDIA_UPLOAD", "PLAYBACK_GRANT", "CREDENTIAL_ROTATE",
    "UPDATE_READ", "UPDATE_STATUS"];
  if (profile === "SOFTWARE_CONNECTOR") return common;
  return [...common, "COMMAND_POLL"];
}

export function managedDeviceOperationAllowed(profile: ManagedDeviceProfile, operation: ManagedDeviceOperation) {
  return managedDevicePermissions(profile).includes(operation);
}

export function safeManagedDeviceDiagnostic(input: Record<string, unknown>) {
  const forbidden = /(private.?key|password|secret|token|authorization|stream.?url|signed.?media|credential)/i;
  const forbiddenValue = /(rtsp|rtsps):\/\/|(?:token|signature|authorization)=/i;
  const scrub = (value: unknown, depth: number): unknown => {
    if (depth > 6) return "[redacted-depth]";
    if (typeof value === "string") return forbiddenValue.test(value) ? "[redacted]" : value;
    if (Array.isArray(value)) return value.slice(0, 50).map((item) => scrub(item, depth + 1));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, forbidden.test(key) ? "[redacted]" : scrub(item, depth + 1)]));
    return value;
  };
  return scrub(input, 0) as Record<string, unknown>;
}

export function safeDigestEquals(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function classifyManagedDeviceSession(input: {
  previousRuntimeInstanceId?: string | null;
  previousSeenAt?: string | null;
  previousSequence?: number | null;
  runtimeInstanceId: string;
  sequence: number;
  now?: number;
}) {
  if (!input.previousRuntimeInstanceId) return "FIRST_SEEN" as const;
  if (input.previousRuntimeInstanceId === input.runtimeInstanceId) {
    return input.sequence > Number(input.previousSequence ?? -1) ? "CONTINUATION" as const : "STALE_SESSION" as const;
  }
  const age = (input.now ?? Date.now()) - Date.parse(input.previousSeenAt ?? "");
  return Number.isFinite(age) && age >= 0 && age < 2 * 60_000 ? "SUSPECTED_CLONE" as const : "RESTART" as const;
}

export function canonicalRotationConfirmation(input: { deviceId: string; credentialVersion: number; rotationId: string; challenge: string }) {
  return ["observer-managed-device-rotation-v1", input.deviceId, String(input.credentialVersion), input.rotationId, input.challenge].join("\n");
}

export function verifyRotationConfirmation(input: {
  deviceId: string;
  credentialVersion: number;
  rotationId: string;
  challenge: string;
  signature: string;
  publicKeySpki: string;
}) {
  try {
    return verify(null, Buffer.from(canonicalRotationConfirmation(input)), createPublicKey({
      key: Buffer.from(publicKeySpkiSchema.parse(input.publicKeySpki), "base64url"), format: "der", type: "spki"
    }), Buffer.from(input.signature, "base64url"));
  } catch {
    return false;
  }
}
