import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { qaDeviceProofMessage, verifyQaDeviceProof } from "../../lib/domain/digital-observer/qa-device-proof-server.ts";

const native = readFileSync(new URL("../../ios/App/App/AppDelegate.swift", import.meta.url), "utf8");
const sourceArray = native.match(/let message: \[Any\] = (\[[\s\S]*?expiresAtMs\])/);
const sourcePrefix = native.match(/private static let spkiPrefix = Data\(\[([\s\S]*?)\]\)/);
const externalCacheBase = (configured) => {
  const base = realpathSync(configured ?? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/.dev-cache/tmp");
  assert.ok(base.startsWith("/Volumes/DIGITAL_OBSERVER/"), "Swift cache must stay on the Development drive");
  return base;
};

test("missing drive path or internal cache path fails closed", () => {
  assert.throws(() => externalCacheBase("/Volumes/DIGITAL_OBSERVER/no-such-push44-cache"));
  assert.throws(() => externalCacheBase("/private/tmp"), /Development drive/);
});

test("actual Swift QA challenge expression serializes identically to the server contract", () => {
  assert.ok(sourceArray, "the native signing expression must remain extractable");
  assert.match(native, /SecKeyCreateSignature\(try privateKey\(\),\s*\.ecdsaSignatureMessageX962SHA256, bytes as CFData/);
  const challenge = {
    nonce: "a".repeat(64), accountId: "account-a", sessionId: "session-a",
    installationId: "installation-a", audience: "com.ganbatuach.app.qa",
    issuedAt: 990, expiresAt: 1_010, consumedAt: null, revokedAt: null
  };
  const code = `import Foundation
let nonce = ${JSON.stringify(challenge.nonce)}
let accountId = ${JSON.stringify(challenge.accountId)}
let sessionId = ${JSON.stringify(challenge.sessionId)}
let installationId = ${JSON.stringify(challenge.installationId)}
let expiresAtMs: Int64 = ${challenge.expiresAt}
${sourceArray[0]}
let bytes = try JSONSerialization.data(withJSONObject: message, options: [])
print(bytes.base64EncodedString())`;
  const cacheBase = externalCacheBase(process.env.PUSH44_QA_SWIFT_CACHE_BASE);
  const cache = mkdtempSync(join(cacheBase, "push44-swift-fixture-"));
  try {
    const output = execFileSync("swift", ["-module-cache-path", cache, "-e", code], { encoding: "utf8", timeout: 60_000 }).trim();
    const swiftBytes = Buffer.from(output, "base64");
    const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const publicKeySpkiBase64 = keys.publicKey.export({ type: "spki", format: "der" }).toString("base64");
    const expected = { ...challenge, publicKeySpkiBase64 };
    assert.deepEqual(swiftBytes, qaDeviceProofMessage(expected));
    const signature = sign("sha256", swiftBytes, keys.privateKey).toString("base64");
    assert.equal(verifyQaDeviceProof(expected, signature, 1_000), true);
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
});

test("actual native X9.63-to-SPKI prefix matches P-256 public-key encoding", () => {
  assert.ok(sourcePrefix);
  const bytes = sourcePrefix[1].match(/0x[0-9a-f]{2}/gi)?.map((value) => Number(value));
  assert.ok(bytes);
  const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const spki = keys.publicKey.export({ type: "spki", format: "der" });
  assert.deepEqual(Buffer.from(bytes), spki.subarray(0, bytes.length));
  assert.equal(spki[bytes.length], 0x04);
  assert.equal(spki.length - bytes.length, 65);
});
