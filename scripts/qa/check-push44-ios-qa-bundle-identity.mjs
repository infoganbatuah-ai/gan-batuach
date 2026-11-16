import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { qaDeviceProofMessage, verifyQaDeviceProof } from "../../lib/domain/digital-observer/qa-device-proof-server.ts";

const native = readFileSync(new URL("../../ios/App/App/AppDelegate.swift", import.meta.url), "utf8");
const start = native.indexOf("private struct QaBundleIdentity: Equatable {");
const end = native.indexOf("// Local, default-off primitive.", start);
assert(start >= 0 && end > start, "actual native identity implementation must be present");
const implementation = native.slice(start, end);

test("actual Swift bundle resolver separates Observer and Gan key/callback identities", () => {
  const program = `import Foundation\n${implementation}\n` + `
private let gan = QaBundleIdentity.resolve("com.ganbatuach.app.qa")!
private let observer = QaBundleIdentity.resolve("com.digitalobserver.app.qa")!
print([gan.audience, gan.callbackScheme, String(data: gan.keyTag, encoding: .utf8)!,
       observer.audience, observer.callbackScheme, String(data: observer.keyTag, encoding: .utf8)!,
       String(QaBundleIdentity.resolve("com.digitalobserver.app") == nil),
       String(QaBundleIdentity.resolve("com.ganbatuach.app") == nil),
       String(QaBundleIdentity.resolve(nil) == nil)].joined(separator: "|"))
`;
  const moduleCache = new URL("../../.dev-cache/tmp/push44-observer-signed-20261116/SwiftModuleCache", import.meta.url).pathname;
  const output = execFileSync("swift", ["-module-cache-path", moduleCache, "-e", program], { encoding: "utf8", timeout: 60_000 }).trim();
  assert.equal(output, [
    "com.ganbatuach.app.qa", "observerqa", "com.ganbatuach.app.qa.device-proof.v1",
    "com.digitalobserver.app.qa", "observerqaapp", "com.digitalobserver.app.qa.device-proof.v1",
    "true", "true", "true"
  ].join("|"));
});

test("native proof and both return gates use resolved bundle identity but remain disabled", () => {
  assert.match(native, /enum QaAccessReturnGate \{\s*static let enabled = false/);
  assert.match(native, /enum QaAsWebAuthReturn \{\s*static let enabled = false/);
  assert.match(native, /pending = \(state, account, installation, bundle\.audience/);
  assert.match(native, /bundle\.audience == expected\.audience/);
  assert.match(native, /callbackURLScheme: bundle\.callbackScheme/);
  assert.match(native, /QaBundleIdentity\.current\(\) == bundle/);
  assert.match(native, /kSecAttrApplicationTag as String: bundle\.keyTag/g);
  assert.match(native, /guard let bundle = QaBundleIdentity\.current\(\) else \{ throw ProofError\.unavailable \}/);
  assert.match(native, /installationId,\s*bundle\.audience, expiresAtMs/);
  assert.doesNotMatch(native, /private static let tag = Data\("com\.ganbatuach\.app\.qa\.device-proof/);
});

test("standalone Observer QA config retains its exact identity and callback scheme", () => {
  const config = JSON.parse(readFileSync(new URL("../../ios/qa-observer/capacitor.config.json", import.meta.url), "utf8"));
  const infoPath = new URL("../../ios/qa-observer/Info.plist", import.meta.url).pathname;
  const scheme = execFileSync("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleURLTypes:0:CFBundleURLSchemes:0", infoPath], { encoding: "utf8" }).trim();
  assert.equal(config.appId, "com.digitalobserver.app.qa");
  assert.equal(scheme, "observerqaapp");
  assert.equal(config.server.url, "https://observer-qa.example.invalid/digital-observer/dashboard");
});

test("a Gan proof cannot be relabeled as standalone Observer; server migration is still required", () => {
  const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const challenge = {
    nonce: "a".repeat(64), accountId: "account-a", sessionId: "session-a",
    installationId: "installation-a", audience: "com.ganbatuach.app.qa",
    issuedAt: 990, expiresAt: 1_010, consumedAt: null, revokedAt: null,
    publicKeySpkiBase64: keys.publicKey.export({ type: "spki", format: "der" }).toString("base64")
  };
  const signature = sign("sha256", qaDeviceProofMessage(challenge), keys.privateKey).toString("base64");
  assert.equal(verifyQaDeviceProof(challenge, signature, 1_000, "com.ganbatuach.app.qa"), true);
  assert.equal(verifyQaDeviceProof({ ...challenge, audience: "com.digitalobserver.app.qa" }, signature, 1_000, "com.digitalobserver.app.qa"), false);
});
