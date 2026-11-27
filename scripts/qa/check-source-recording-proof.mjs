import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { sourceRecordingProofSigningBytes, verifySourceRecordingProof } from "../../lib/domain/digital-observer/source-recording-proof.ts";

const uuid = (value) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const t = Date.parse("2026-11-27T10:00:00Z");
const keys = generateKeyPairSync("ed25519");
const otherKeys = generateKeyPairSync("ed25519");

function fixture() {
  const expected = {
    operationId: uuid(1), tenantId: uuid(2), siteId: uuid(3), sourceId: uuid(4),
    eventId: uuid(5), evidenceId: uuid(6), recordingReferenceId: uuid(7), recorderId: "fixture-recorder",
    channelId: "ch1", clockEpoch: "clock-epoch-a", anchorSha256: "a".repeat(64),
    eventObservedUtcMs: t + 10_000,
  };
  const receipt = {
    ...expected,
    version: "observer-source-recording-proof-v1",
    requestedFromUtcMs: t + 2_000, requestedToUtcMs: t + 28_000,
    issuedAtMs: t + 120_000, expiresAtMs: t + 180_000,
    archiveStartRecorderMs: t + 7_000, archiveEndRecorderMs: t + 37_000,
    clockVerifiedFromUtcMs: t - 2_000, clockVerifiedUntilUtcMs: t + 32_000,
    recorderMinusUtcMs: 7_000, clockUncertaintyMs: 1_000,
  };
  const signed = (value = receipt, key = keys.privateKey) => ({
    receipt: value, signature: sign(null, sourceRecordingProofSigningBytes(value), key).toString("base64url"),
  });
  const input = {
    proof: signed(), expected, recorderPublicKey: keys.publicKey,
    range: { fromUtcMs: t + 2_000, toUtcMs: t + 28_000 }, nowMs: t + 130_000,
  };
  return { expected, receipt, signed, input };
}

test("valid receipt proves the exact bounded range under a signed source and clock binding", () => {
  const f = fixture();
  const result = verifySourceRecordingProof(f.input);
  const reordered = Object.fromEntries(Object.entries(f.receipt).reverse());
  assert.deepEqual(verifySourceRecordingProof({ ...f.input, proof: f.signed(reordered) }), result);
  assert.deepEqual(result, { proofVersion: "observer-source-recording-proof-v1", operationId: f.expected.operationId,
    receiptSha256: result.receiptSha256, ...f.input.range });
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  assert(!JSON.stringify(result).includes("fixture-recorder"));
});

test("rejects an exact time match alone and rejects unrecognized receipt fields", () => {
  const f = fixture();
  assert.throws(() => verifySourceRecordingProof({ ...f.input, proof: { receipt: f.receipt } }), /PROOF_INVALID/);
  assert.throws(() => verifySourceRecordingProof({ ...f.input, proof: {
    ...f.input.proof, receipt: { ...f.receipt, untrusted_locator: "fixture-placeholder" },
  } }), /PROOF_INVALID/);
});

test("requires authentic assertions from the exact pinned public key", () => {
  const f = fixture();
  assert.throws(() => verifySourceRecordingProof({ ...f.input, proof: { ...f.input.proof,
    receipt: { ...f.receipt, eventId: uuid(8) } } }), /SIGNATURE_INVALID/);
  assert.throws(() => verifySourceRecordingProof({ ...f.input, proof: f.signed(f.receipt, otherKeys.privateKey) }), /SIGNATURE_INVALID/);
  assert.throws(() => verifySourceRecordingProof({ ...f.input, recorderPublicKey: keys.privateKey }), /SIGNATURE_INVALID/);
});

test("authentic but unrelated receipts cannot prove a different operation, owner, Site, source, Event or Evidence", () => {
  const f = fixture();
  const fields = ["operationId", "tenantId", "siteId", "sourceId", "eventId", "evidenceId", "recordingReferenceId"];
  for (const field of fields) {
    assert.throws(() => verifySourceRecordingProof({ ...f.input, proof: f.signed({ ...f.receipt, [field]: uuid(8) }) }),
      /PROOF_SCOPE_MISMATCH/, field);
  }
  for (const [field, value] of Object.entries({
    recorderId: "other", channelId: "ch2", clockEpoch: "old-epoch", anchorSha256: "b".repeat(64), eventObservedUtcMs: t + 11_000,
  })) {
    assert.throws(() => verifySourceRecordingProof({ ...f.input, proof: f.signed({ ...f.receipt, [field]: value }) }),
      /PROOF_SCOPE_MISMATCH/, field);
  }
});

test("expiry, future issuance and an overlong lifetime fail closed", () => {
  const f = fixture();
  for (const nowMs of [f.receipt.expiresAtMs, f.receipt.issuedAtMs - 1]) {
    assert.throws(() => verifySourceRecordingProof({ ...f.input, nowMs }), /PROOF_EXPIRED/);
  }
  assert.throws(() => verifySourceRecordingProof({ ...f.input, proof: f.signed({ ...f.receipt,
    expiresAtMs: f.receipt.issuedAtMs + 120_001 }) }), /PROOF_EXPIRED/);
});

test("requires measured clock evidence for the archive epoch and accounts for uncertainty at both boundaries", () => {
  const f = fixture();
  for (const patch of [{ clockVerifiedFromUtcMs: t }, { clockVerifiedUntilUtcMs: t + 30_000 }, { archiveEndRecorderMs: t + 8_000 }]) {
    assert.throws(() => verifySourceRecordingProof({ ...f.input, proof: f.signed({ ...f.receipt, ...patch }) }), /CLOCK_UNVERIFIED/);
  }
  for (const range of [
    { ...f.input.range, fromUtcMs: t + 999 }, { ...f.input.range, toUtcMs: t + 29_001 },
    { ...f.input.range, toUtcMs: f.receipt.eventObservedUtcMs },
  ]) {
    const proof = f.signed({ ...f.receipt, requestedFromUtcMs: range.fromUtcMs, requestedToUtcMs: range.toUtcMs });
    assert.throws(() => verifySourceRecordingProof({ ...f.input, proof, range }), /RANGE_UNVERIFIED/);
  }

  const negativeOffset = { ...f.receipt, recorderMinusUtcMs: -7_000,
    archiveStartRecorderMs: t - 7_000, archiveEndRecorderMs: t + 23_000 };
  assert.doesNotThrow(() => verifySourceRecordingProof({ ...f.input, proof: f.signed(negativeOffset) }));
});

test("cannot reuse a valid receipt for a different range that is otherwise covered", () => {
  const f = fixture();
  assert.throws(() => verifySourceRecordingProof({ ...f.input, range: { ...f.input.range, toUtcMs: t + 27_000 } }),
    /RANGE_UNVERIFIED/);
});

test("rejects ranges over five minutes even when signed archive coverage includes the whole request", () => {
  const f = fixture();
  const receipt = { ...f.receipt, requestedToUtcMs: t + 302_001, archiveEndRecorderMs: t + 315_000, clockVerifiedUntilUtcMs: t + 310_000,
    issuedAtMs: t + 320_000, expiresAtMs: t + 380_000 };
  assert.throws(() => verifySourceRecordingProof({ ...f.input, proof: f.signed(receipt), nowMs: t + 330_000,
    range: { fromUtcMs: t + 2_000, toUtcMs: t + 302_001 } }), /RANGE_UNVERIFIED/);
});
