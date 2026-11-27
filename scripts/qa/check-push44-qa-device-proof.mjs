import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import { QA_DEVICE_AUDIENCES, qaDeviceProofMessage, verifyQaDeviceProof } from "../../lib/domain/digital-observer/qa-device-proof-server.ts";

const pair = () => generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const approved = pair();
const other = pair();
const publicKeySpkiBase64 = approved.publicKey.export({ type: "spki", format: "der" }).toString("base64");
const expected = Object.freeze({
  nonce: "a".repeat(64), accountId: "qa-account-a", sessionId: "qa-session-a",
  installationId: "qa-installation-a", audience: QA_DEVICE_AUDIENCES.gan,
  issuedAt: 990, expiresAt: 1_010, consumedAt: null, revokedAt: null, publicKeySpkiBase64
});
const signed = (key = approved.privateKey, record = expected) => sign("sha256", qaDeviceProofMessage(record), key).toString("base64");

test("approved P-256 installation key signs the exact server challenge", () => {
  assert.equal(verifyQaDeviceProof(expected, signed(), 1_000, QA_DEVICE_AUDIENCES.gan), true);
});

test("different installation key and tampered signature fail", () => {
  assert.equal(verifyQaDeviceProof(expected, signed(other.privateKey), 1_000, QA_DEVICE_AUDIENCES.gan), false);
  assert.equal(verifyQaDeviceProof(expected, "not-base64", 1_000, QA_DEVICE_AUDIENCES.gan), false);
});

for (const [name, change] of [
  ["account", { accountId: "qa-account-b" }],
  ["session", { sessionId: "qa-session-b" }],
  ["installation", { installationId: "qa-installation-b" }],
  ["audience", { audience: "com.other.app" }],
  ["nonce", { nonce: "b".repeat(64) }]
]) test(`signature is bound to ${name}`, () => {
  assert.equal(verifyQaDeviceProof({ ...expected, ...change }, signed(), 1_000, QA_DEVICE_AUDIENCES.gan), false);
});

test("expiry, revocation, consumption and missing context fail closed", () => {
  assert.equal(verifyQaDeviceProof(expected, signed(), 1_010, QA_DEVICE_AUDIENCES.gan), false);
  assert.equal(verifyQaDeviceProof({ ...expected, revokedAt: 999 }, signed(), 1_000, QA_DEVICE_AUDIENCES.gan), false);
  assert.equal(verifyQaDeviceProof({ ...expected, consumedAt: 999 }, signed(), 1_000, QA_DEVICE_AUDIENCES.gan), false);
  assert.equal(verifyQaDeviceProof({ ...expected, sessionId: "" }, signed(), 1_000, QA_DEVICE_AUDIENCES.gan), false);
  assert.equal(verifyQaDeviceProof({ ...expected, expiresAt: 70_000 }, signed(), 1_000, QA_DEVICE_AUDIENCES.gan), false);
  assert.equal(verifyQaDeviceProof({ ...expected, nonce: "short" }, signed(), 1_000, QA_DEVICE_AUDIENCES.gan), false);
});

test("malformed and wrong-curve public keys are denied", () => {
  const wrongCurve = generateKeyPairSync("ec", { namedCurve: "secp384r1" });
  assert.equal(verifyQaDeviceProof({ ...expected, publicKeySpkiBase64: "bad" }, signed(), 1_000, QA_DEVICE_AUDIENCES.gan), false);
  assert.equal(verifyQaDeviceProof({ ...expected,
    publicKeySpkiBase64: wrongCurve.publicKey.export({ type: "spki", format: "der" }).toString("base64")
  }, signed(wrongCurve.privateKey), 1_000, QA_DEVICE_AUDIENCES.gan), false);
});

test("Observer proof requires its exact audience, installation and session", () => {
  const observer = { ...expected, audience: QA_DEVICE_AUDIENCES.observer,
    sessionId: "observer-session", installationId: "observer-installation" };
  const observerSignature = signed(approved.privateKey, observer);
  assert.equal(verifyQaDeviceProof(observer, observerSignature, 1_000, QA_DEVICE_AUDIENCES.observer), true);
  assert.equal(verifyQaDeviceProof(observer, observerSignature, 1_000, QA_DEVICE_AUDIENCES.gan), false);
  assert.equal(verifyQaDeviceProof(observer, signed(), 1_000, QA_DEVICE_AUDIENCES.observer), false);
  assert.equal(verifyQaDeviceProof({ ...observer, sessionId: expected.sessionId }, observerSignature, 1_000, QA_DEVICE_AUDIENCES.observer), false);
  assert.equal(verifyQaDeviceProof({ ...observer, installationId: expected.installationId }, observerSignature, 1_000, QA_DEVICE_AUDIENCES.observer), false);
  assert.equal(verifyQaDeviceProof(observer, observerSignature, 1_000), false);
  assert.throws(() => qaDeviceProofMessage({ ...observer, audience: "unknown.qa" }), /Invalid QA device challenge context/);
});
