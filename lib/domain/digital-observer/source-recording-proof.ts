import { createHash, verify, type KeyObject } from "node:crypto";
import { z } from "zod";

const version = "observer-source-recording-proof-v1";
const maxReceiptLifetimeMs = 120_000;
const maxClockUncertaintyMs = 2_000;
const maxRangeMs = 300_000;
const id = z.string().uuid();
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
const timestamp = z.number().int().min(0).max(8_640_000_000_000_000);
const digest = z.string().regex(/^[a-f0-9]{64}$/);

const binding = z.object({
  operationId: id,
  tenantId: id,
  siteId: id,
  sourceId: id,
  eventId: id,
  evidenceId: id,
  recordingReferenceId: id,
  recorderId: identifier,
  channelId: identifier,
  clockEpoch: identifier,
  anchorSha256: digest,
  eventObservedUtcMs: timestamp,
}).strict();

const receiptSchema = binding.extend({
  version: z.literal(version),
  requestedFromUtcMs: timestamp,
  requestedToUtcMs: timestamp,
  issuedAtMs: timestamp,
  expiresAtMs: timestamp,
  archiveStartRecorderMs: timestamp,
  archiveEndRecorderMs: timestamp,
  clockVerifiedFromUtcMs: timestamp,
  clockVerifiedUntilUtcMs: timestamp,
  recorderMinusUtcMs: z.number().int().min(-120_000).max(120_000),
  clockUncertaintyMs: z.number().int().min(0).max(maxClockUncertaintyMs),
}).strict();

const envelope = z.object({ receipt: receiptSchema, signature: z.string().regex(/^[A-Za-z0-9_-]{86}$/) }).strict();

export function sourceRecordingProofSigningBytes(value: unknown) {
  // Strict schema emits a flat object. Sort its ASCII keys for stable signing.
  const receipt = receiptSchema.parse(value);
  return Buffer.from(JSON.stringify(receipt, Object.keys(receipt).sort()), "utf8");
}

export function verifySourceRecordingProof(input: {
  proof: unknown;
  expected: z.input<typeof binding>;
  recorderPublicKey: KeyObject;
  range: { fromUtcMs: number; toUtcMs: number };
  nowMs: number;
}) {
  const parsed = envelope.safeParse(input.proof);
  const expected = binding.safeParse(input.expected);
  const { fromUtcMs, toUtcMs } = input.range;
  if (!parsed.success || !expected.success || ![input.nowMs, fromUtcMs, toUtcMs].every(Number.isSafeInteger)) {
    throw new Error("SOURCE_RECORDING_PROOF_INVALID");
  }
  const { receipt, signature } = parsed.data;
  const bytes = sourceRecordingProofSigningBytes(receipt);
  const signatureBytes = Buffer.from(signature, "base64url");
  if (input.recorderPublicKey.type !== "public" || input.recorderPublicKey.asymmetricKeyType !== "ed25519" ||
    signatureBytes.toString("base64url") !== signature || !verify(null, bytes, input.recorderPublicKey, signatureBytes)) {
    throw new Error("SOURCE_RECORDING_SIGNATURE_INVALID");
  }

  const scope = expected.data;
  const identityFields = Object.keys(scope) as (keyof typeof scope)[];
  if (identityFields.some((field) => scope[field] !== receipt[field])) {
    throw new Error("SOURCE_RECORDING_PROOF_SCOPE_MISMATCH");
  }
  if (!(receipt.issuedAtMs <= input.nowMs && input.nowMs < receipt.expiresAtMs &&
    receipt.expiresAtMs - receipt.issuedAtMs <= maxReceiptLifetimeMs)) {
    throw new Error("SOURCE_RECORDING_PROOF_EXPIRED");
  }
  const correctedStart = receipt.archiveStartRecorderMs - receipt.recorderMinusUtcMs;
  const correctedEnd = receipt.archiveEndRecorderMs - receipt.recorderMinusUtcMs;
  const guaranteedStart = correctedStart + receipt.clockUncertaintyMs;
  const guaranteedEnd = correctedEnd - receipt.clockUncertaintyMs;
  // Clock evidence must cover the entire possible archive interval in this epoch.
  if (!(receipt.clockVerifiedFromUtcMs <= correctedStart - receipt.clockUncertaintyMs &&
    correctedEnd + receipt.clockUncertaintyMs <= receipt.clockVerifiedUntilUtcMs &&
    receipt.clockVerifiedUntilUtcMs <= receipt.issuedAtMs && guaranteedStart < guaranteedEnd)) {
    throw new Error("SOURCE_RECORDING_CLOCK_UNVERIFIED");
  }
  if (!(receipt.requestedFromUtcMs === fromUtcMs && receipt.requestedToUtcMs === toUtcMs &&
    fromUtcMs <= receipt.eventObservedUtcMs && receipt.eventObservedUtcMs < toUtcMs &&
    toUtcMs - fromUtcMs <= maxRangeMs && guaranteedStart <= fromUtcMs && toUtcMs <= guaranteedEnd)) {
    throw new Error("SOURCE_RECORDING_RANGE_UNVERIFIED");
  }

  return {
    proofVersion: version,
    operationId: scope.operationId,
    receiptSha256: createHash("sha256").update(bytes).digest("hex"),
    fromUtcMs,
    toUtcMs,
  };
}
