import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const renew = readFileSync("scripts/qa/renew-push38-homeqa-legacy-proofs.mjs", "utf8");
const download = readFileSync("scripts/qa/prove-push38-homeqa-legacy-download.mjs", "utf8");

test("legacy proof renewal skips an already verified managed component", () => {
  assert.match(renew, /row\.identity_phase === "MANAGED_IDENTITY_VERIFIED"/);
  assert.match(renew, /row\.managed_identity_proof_matches_home_qa !== true/);
  assert.match(renew, /managed_devices_skipped/);
  assert.doesNotMatch(renew, /row\.profile === "SOFTWARE_CONNECTOR" && row\.legacy_transition_proof_matches_home_qa/);
});

test("staging proof can be scoped to the remaining exact legacy Gateway", () => {
  assert.match(download, /--profile=/);
  assert.match(download, /PHYSICAL_GATEWAY/);
  assert.match(download, /\.filter\(spec => !profileOption \|\| spec\.profile === profileOption\)/);
  assert.match(download, /pinnedTransitionProof/);
  assert.doesNotMatch(download, /const connectorTransitionProof/);
});
