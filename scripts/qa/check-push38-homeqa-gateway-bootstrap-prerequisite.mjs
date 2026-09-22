import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const command = readFileSync("scripts/qa/run-push38-homeqa-gateway-bootstrap.mjs", "utf8");

test("Gateway bootstrap requires the exact recovered Connector release", () => {
  assert.match(command, /qa-p38-health-connector-startup-d44b7e4262f9/);
  assert.match(command, /d44b7e4262f9a7c9051a8c3e15258c612791546b1bfeaddf6f95c04ee706d388/);
  assert.doesNotMatch(command,
    /connectorCurrent\.release_id !== "qa-p38-health-connector-pidfix-1b9e9499ffa7"/);
});

test("Gateway bootstrap fails closed unless CURRENT and KNOWN_GOOD are pinned and healthy", () => {
  assert.match(command, /connectorCurrent\.artifact_sha256 !== requiredConnector\.artifact_sha256/);
  assert.match(command, /connectorKnownGood\.find/);
  assert.match(command, /item\.trusted === true/);
  assert.match(command, /connectorState\.release_id !== requiredConnector\.release_id/);
  assert.match(command, /connectorState\.state !== "HEALTHY"/);
  assert.match(command, /progressingRelays !== 1/);
  assert.match(command, /stalledRelays !== 0/);
});
