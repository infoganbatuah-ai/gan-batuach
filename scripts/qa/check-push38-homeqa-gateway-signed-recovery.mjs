import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./authorize-push38-homeqa-gateway-signed-recovery.mjs", import.meta.url), "utf8");
assert.match(source, /P38_GATEWAY_SIGNED_RECOVERY_EXPLICIT_MODE_REQUIRED/);
assert.match(source, /verifyEdgeUpdateManifest\(manifest, trustedPublicKeys\)/);
assert.match(source, /available_channel_stream_proof\?\.passed !== 8/);
assert.match(source, /checkpoints\?\.some/);
assert.match(source, /status='DRAFT'/);
assert.match(source, /other_gateway_unpaused/);
assert.match(source, /manager\.verifySlot\(current\)/);
assert.match(source, /manager\.quarantineRelease\(failedManifest, state\.failure_category\)/);
assert.match(source, /manager\.transition\("ROLLED_BACK"/);
assert.match(source, /runtime_restarted: false/);
assert.match(source, /release_installed: false/);
assert.match(source, /release_promoted: false/);
assert.doesNotMatch(source, /adapter\.restart/);
assert.doesNotMatch(source, /restoreLegacy/);
console.log(JSON.stringify({ status: "PASS", exact_signed_recovery_authorization: true,
  normal_managed_ota_installation_retained: true, direct_runtime_mutation: false }));
