import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/qa/reconcile-live-tapo-endpoint.mjs", "utf8");

test("reconciliation is an explicit preflight/apply/rollback command", () => {
  assert.match(source, /--preflight/);
  assert.match(source, /--apply/);
  assert.match(source, /--rollback/);
  assert.match(source, /P38_TAPO_BACKUP_PIN_MISMATCH/);
  assert.match(source, /P38_TAPO_PREWRITE_BACKUP_STALE/);
});

test("public C211 identity is required before existing credentials are used", () => {
  const discovery = source.indexOf("const host = await discoverC211()");
  const media = source.indexOf("const media = verifyMedia(host)", discovery);
  assert(discovery >= 0 && media > discovery);
  assert.match(source, /candidates\.size !== 1/);
  assert.match(source, /ONVIF-advertised C211/);
  assert.match(source, /P38_TAPO_PUBLIC_PORT_CONTRACT_FAILED/);
});

test("only cached endpoint fields are changed and exact source is preserved", () => {
  assert.match(source, /EXPECTED_SOURCE_ID = "7465c0f2-ba57-4299-b22e-f20cedb91c23"/);
  assert.match(source, /store\.write\(PROFILES_ACCOUNT/);
  assert.match(source, /store\.write\(LEGACY_PROFILE_ACCOUNT/);
  assert.doesNotMatch(source, /store\.write\([^\n]*(?:device_gateway_id|device_observer_site_id|connector_camera_source_id)/);
  assert.doesNotMatch(source, /supabase|Production|camera_sources|insert\(/i);
  assert.match(source, /credentials_changed: false/);
  assert.match(source, /source_id_preserved/);
});

test("failed health automatically restores both exact prior profiles", () => {
  assert.match(source, /catch \(error\)/);
  assert.match(source, /store\.write\(PROFILES_ACCOUNT, backup\.profiles_raw\)/);
  assert.match(source, /store\.write\(LEGACY_PROFILE_ACCOUNT, backup\.legacy_profile_raw\)/);
  assert.match(source, /P38_TAPO_RECONCILIATION_FAILED_AUTO_ROLLBACK/);
});

test("post-restart gate requires one progressing non-stalled source", () => {
  assert.match(source, /last\.discovery\?\.connected === 1/);
  assert.match(source, /last\.media\?\.progressing === 1/);
  assert.match(source, /last\.media\?\.stalled === 0/);
});
