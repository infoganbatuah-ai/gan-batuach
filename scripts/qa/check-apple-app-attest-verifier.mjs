import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, X509Certificate } from "node:crypto";
import { decodeAttestationObject, getCertificateInfo, isoCBOR } from "@simplewebauthn/server/helpers";
import { verifyAppleAppAttestObject, verifyPushRegistrationAppAttest } from "../../lib/domain/apple-app-attest-verifier.mjs";

const fixture = readFileSync(new URL("./fixtures/apple-app-attest-official-2026.txt", import.meta.url), "utf8")
  .split("\n").filter((line) => !line.startsWith("#")).join("");
const sample = Buffer.from(fixture, "base64");
const decoded = decodeAttestationObject(sample);
const statement = decoded.get("attStmt");
const auth = Buffer.from(decoded.get("authData"));
const leaf = new X509Certificate(Buffer.from(statement.get("x5c")[0]));
const intermediate = new X509Certificate(Buffer.from(statement.get("x5c")[1]));
const nonceExtension = getCertificateInfo(leaf.raw).parsedCertificate.tbsCertificate.extensions
  .find((entry) => entry.extnID === "1.2.840.113635.100.8.2");
const certNonce = Buffer.from(nonceExtension.extnValue.buffer).subarray(6);
const hash = (bytes) => createHash("sha256").update(bytes).digest();
const challenge = Buffer.from("example_server_challenge");
const keyIdBase64 = "zgSY9YSD+7TaDXssY6WlOPVS1K3Lmk+pFhlcSWE+ZV0=";
const source = readFileSync(new URL("../../lib/domain/apple-app-attest-verifier.mjs", import.meta.url), "utf8");
const rootDerBase64 = source.match(/APPLE_ROOT_DER_BASE64 = "([^"]+)"/)?.[1];
assert.ok(rootDerBase64);
const root = new X509Certificate(Buffer.from(rootDerBase64, "base64"));
const input = {
  attestationObject: sample, serverChallenge: challenge, keyIdBase64,
  teamId: "1234567890", bundleId: "com.example.myapp", environment: "production",
  nowMs: Date.parse("2026-04-21T00:00:00Z"),
  consumeChallengeOnce: async () => { throw Error("must_not_consume_invalid_attestation"); }
};

assert.equal(hash(root.raw).toString("hex"),
  "1cb9823ba28ba6ad2d33a006941de2ae4f513ef1d4e831b9f7e0fa7b6242c932");
assert.equal(root.verify(root.publicKey), true);
assert.equal(intermediate.checkIssued(root), true);
assert.equal(intermediate.verify(root.publicKey), true);
assert.equal(leaf.checkIssued(intermediate), true);
assert.equal(leaf.verify(intermediate.publicKey), true);
assert.equal(auth.subarray(0, 32).toString("hex"),
  hash(Buffer.from("1234567890.com.example.myapp")).toString("hex"));
assert.equal(auth[32], 0x40);
assert.equal(auth.readUInt32BE(33), 0);
assert.equal(auth.subarray(37, 53).toString("hex"),
  Buffer.concat([Buffer.from("appattest"), Buffer.alloc(7)]).toString("hex"));
assert.equal(auth.subarray(55, 87).toString("base64"), keyIdBase64);
const cose = isoCBOR.decodeFirst(auth.subarray(87));
const point = Buffer.concat([Buffer.from([4]),
  Buffer.from(cose.get(-2)), Buffer.from(cose.get(-3))]);
assert.equal(hash(point).toString("base64"), keyIdBase64);
const certKey = leaf.publicKey.export({ format: "jwk" });
assert.equal(point.toString("hex"),
  Buffer.concat([Buffer.from([4]), Buffer.from(certKey.x, "base64url"),
    Buffer.from(certKey.y, "base64url")]).toString("hex"));
assert.equal(certNonce.toString("hex"), hash(Buffer.concat([auth, challenge])).toString("hex"));
assert.notEqual(certNonce.toString("hex"),
  hash(Buffer.concat([auth, hash(challenge)])).toString("hex"));
assert.equal(await verifyAppleAppAttestObject(input), null);
assert.equal(await verifyAppleAppAttestObject({ ...input, teamId: "0000000000" }), null);
assert.equal(await verifyAppleAppAttestObject({ ...input, bundleId: "com.other.app" }), null);
assert.equal(await verifyAppleAppAttestObject({ ...input, environment: "development" }), null);
assert.equal(await verifyAppleAppAttestObject({ ...input, keyIdBase64: Buffer.alloc(32).toString("base64") }), null);
assert.equal(await verifyAppleAppAttestObject({ ...input, nowMs: Date.parse("2026-11-16T00:00:00Z") }), null);
assert.equal(await verifyAppleAppAttestObject({ ...input, consumeChallengeOnce: undefined }), null);
assert.equal(await verifyAppleAppAttestObject({ ...input, attestationObject: Buffer.from([0]) }), null);
assert.equal(await verifyPushRegistrationAppAttest({ ...input, challenge: {} }), null);
const forged = new Map(decoded);
const forgedStatement = new Map(statement);
forgedStatement.set("x5c", [Buffer.from(statement.get("x5c")[0]).fill(0, 10, 11), statement.get("x5c")[1]]);
forged.set("attStmt", forgedStatement);
assert.equal(await verifyAppleAppAttestObject({ ...input, attestationObject: Buffer.from(isoCBOR.encode(forged)) }), null);
console.log("App Attest negative and official-sample incompatibility checks: PASS; positive signed vector: NOT AVAILABLE");
