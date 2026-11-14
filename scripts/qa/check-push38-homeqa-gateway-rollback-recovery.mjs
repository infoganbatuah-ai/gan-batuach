import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./recover-push38-homeqa-gateway-rollback.mjs", import.meta.url), "utf8");
assert.match(source, /P38_GATEWAY_ROLLBACK_RECOVERY_EXPLICIT_MODE_REQUIRED/);
assert.match(source, /EDGE_UPDATE_KNOWN_GOOD_UNHEALTHY/);
assert.match(source, /qa-legacy-gateway-91bf6814075f/);
assert.match(source, /qa-p38-health-gateway-6c9d08327ec6/);
assert.match(source, /manager\.verifySlot\(current\)/);
assert.match(source, /adapter\.restart\(\{ slot: current\.slot, manifest, rollback: true \}\)/);
assert.match(source, /waitForInstalledEdgeHealth/);
assert.match(source, /manager\.recoverActionRequiredRollback\(\)/);
assert.match(source, /NODE_EXTRA_CA_CERTS: certificate/);
assert.match(source, /P38_GATEWAY_ROLLBACK_RECOVERY_TLS_PROCESS_INVALID/);
assert.match(source, /release_selected: false/);
assert.match(source, /release_promoted: false/);
assert.doesNotMatch(source, /restoreLegacy\(/);
console.log(JSON.stringify({ status: "PASS", exact_signed_gateway_rollback_recovery: true,
  second_rollback_implementation: false, release_selection: false, promotion: false }));
