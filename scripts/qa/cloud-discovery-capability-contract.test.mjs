import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const domainSource = readFileSync("lib/domain/video-gateway.ts", "utf8");
const runnerSource = readFileSync("scripts/run-persistent-home-gateway.mjs", "utf8");

test("cloud discovery accepts the bounded capability payload emitted by the Gateway", () => {
  for (const key of ["live", "playback", "audio_input", "audio_output", "talkback", "ptz", "relay", "siren", "light"]) {
    assert.match(domainSource, new RegExp(`\\b${key}:`));
  }
  assert.match(domainSource, /capabilities:\s*cloudDvrHardwareCapabilitiesSchema\.optional\(\)/);
  assert.match(domainSource, /controls_supported:\s*z\.boolean\(\)/);
  assert.match(runnerSource, /capabilities:\s*channel\.capabilities/);
  assert.match(domainSource, /hardware_evidence:\s*values\.hardwareCapabilities/);
});

test("capability reporting remains discovery-only and does not authorize commands", () => {
  assert.match(domainSource, /read_only:\s*z\.literal\(true\)/);
  assert.match(domainSource, /no_secrets_returned:\s*z\.literal\(true\)/);
  assert.doesNotMatch(domainSource, /controls_supported:\s*z\.literal\(true\)/);
});
