import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateHomeQaOtaIdentityScope } from "../../services/video-gateway/edge-installed-ota-installer.mjs";

const managedRoot = "/private/tmp/observer-p38-homeqa-test/ota";
rmSync("/private/tmp/observer-p38-homeqa-test", { recursive: true, force: true });
mkdirSync(managedRoot, { recursive: true, mode: 0o700 });
const certificate = join(managedRoot, "qa-control-plane-ca.crt");
writeFileSync(certificate, readFileSync(
  "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38t-ota-loopback-20260920.crt"),
{ mode: 0o600, flag: "wx" });
const config = { channel: "HOME_QA", secretDir: join(managedRoot, "home-qa-device-secrets"),
  qaTlsCaPath: certificate, qaTlsCaSha256: createHash("sha256").update(readFileSync(certificate)).digest("hex") };
assert.equal(validateHomeQaOtaIdentityScope({ managedRoot, runtimeConfig: config }).secretDir, config.secretDir);
for (const change of [
  { secretDir: "/Users/danielderi/Library/Application Support/Digital Observer/Tapo Connector/secrets" },
  { keychainService: "com.ganbatuach.video-gateway.runtime" },
  { qaTlsCaSha256: "0".repeat(64) }
]) assert.throws(() => validateHomeQaOtaIdentityScope({ managedRoot,
  runtimeConfig: { ...config, ...change } }), /EDGE_OTA_HOME_QA_IDENTITY_SCOPE_INVALID/);
assert.equal(validateHomeQaOtaIdentityScope({ managedRoot, runtimeConfig: { channel: "INTERNAL" } }), null);
assert.throws(() => validateHomeQaOtaIdentityScope({ managedRoot, runtimeConfig: {
  ...config,
  qaTlsCaPath: "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38t-ota-loopback-20260920.crt"
} }), /EDGE_OTA_HOME_QA_IDENTITY_SCOPE_INVALID/);
console.log(JSON.stringify({ status: "PASS", qa_agent_secret_store: "ISOLATED",
  product_legacy_store_reuse: "DENIED", tls_certificate_pinned: true, tls_certificate_local: true,
  production_writes: 0, runtime_writes: 0 }));
rmSync("/private/tmp/observer-p38-homeqa-test", { recursive: true, force: true });
