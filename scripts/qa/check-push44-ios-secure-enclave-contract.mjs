import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { qaDeviceProofMessage, verifyQaDeviceProof } from "../../lib/domain/digital-observer/qa-device-proof-server.ts";

const appDelegate = readFileSync(new URL("../../ios/App/App/AppDelegate.swift", import.meta.url), "utf8");
const spkiPrefix = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex");

test("QA-only native primitive requests a non-exportable Secure Enclave key and fails closed", () => {
  assert.match(appDelegate, /#if PERSONAL_TEAM_QA[\s\S]*enum QaSecureEnclaveProof/);
  assert.match(appDelegate, /kSecAttrTokenIDSecureEnclave/);
  assert.match(appDelegate, /kSecAttrAccessibleWhenUnlockedThisDeviceOnly/);
  assert.match(appDelegate, /SecKeyCreateRandomKey/);
  assert.match(appDelegate, /SecKeyCreateSignature/);
  assert.match(appDelegate, /ecdsaSignatureMessageX962SHA256/);
  assert.match(appDelegate, /com\.ganbatuach\.app\.qa/);
  assert.doesNotMatch(appDelegate, /SecKeyCopyExternalRepresentation\(privateKey/);
});

test("X9.63 public-key wrapping and canonical challenge produce a server-verifiable fixture", () => {
  const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const spki = keys.publicKey.export({ type: "spki", format: "der" });
  const x963 = spki.subarray(spkiPrefix.length);
  assert.equal(x963.length, 65);
  assert.equal(x963[0], 4);
  assert.deepEqual(Buffer.concat([spkiPrefix, x963]), spki);
  const challenge = {
    nonce: "a".repeat(64), accountId: "account-a", sessionId: "session-a",
    installationId: "installation-a", audience: "com.ganbatuach.app.qa",
    issuedAt: 990, expiresAt: 1_010, consumedAt: null, revokedAt: null,
    publicKeySpkiBase64: spki.toString("base64")
  };
  const signature = sign("sha256", qaDeviceProofMessage(challenge), keys.privateKey).toString("base64");
  assert.equal(verifyQaDeviceProof(challenge, signature, 1_000, "com.ganbatuach.app.qa"), true);
  assert.equal(verifyQaDeviceProof({ ...challenge, audience: "other.app" }, signature, 1_000, "com.ganbatuach.app.qa"), false);
});
