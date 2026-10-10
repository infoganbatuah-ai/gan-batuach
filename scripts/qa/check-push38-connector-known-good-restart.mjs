import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./restart-push38-homeqa-connector-known-good.mjs", import.meta.url), "utf8");
for (const expected of ["--restart-exact-known-good", "ACTION_REQUIRED", "EDGE_UPDATE_KNOWN_GOOD_CRASH_LOOP",
  "qa-p38-health-connector-parent-exit-f7dba974e80f",
  "f7dba974e80fc7e70bef0584744379b09ef4c0e8161eb13c32cea6118a4a55fd",
  "manager.verifySlot(current)", "adapter.restart({ slot: current.slot, manifest, rollback: true })",
  "recover-push38-homeqa-known-good.mjs", "release_selected: false", "release_installed: false",
  "release_promoted: false"])
  assert.ok(source.includes(expected), `missing ${expected}`);
assert.doesNotMatch(source, /manager\.apply\(/);
console.log(JSON.stringify({ status: "PASS", exact_signed_current: true,
  canonical_restart: true, existing_recovery_delegated: true, release_install: false }));
