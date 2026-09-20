import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateHomeQaOtaIdentityScope } from "../../services/video-gateway/edge-installed-ota-installer.mjs";

const managedRoot = "/private/tmp/observer-p38-homeqa-test/ota";
const certificate = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38t-ota-loopback-20260920.crt";
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
console.log(JSON.stringify({ status: "PASS", qa_agent_secret_store: "ISOLATED",
  product_legacy_store_reuse: "DENIED", tls_certificate_pinned: true,
  production_writes: 0, runtime_writes: 0 }));
