// Isolated QA: actual captured baseline bytes, fake identity/config/queue and
// controlled synthetic bad update. Never addresses the live Home services.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, createPrivateKey, sign } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalEdgeUpdateManifest, verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";

const args = Object.fromEntries(process.argv.slice(2).map(value => { const equal = value.indexOf("="); return [value.slice(0, equal), value.slice(equal + 1)]; }));
if (!args["--store"] || !args["--qa-private-key"]) throw new Error("QA_RELEASE_INPUT_REQUIRED");
const trust = JSON.parse(readFileSync(join(args["--store"], "qa-trust-registry.json"))).trustedPublicKeys;
const privateKey = createPrivateKey(readFileSync(args["--qa-private-key"]));
const results = [];
for (const [profile, id, archive, member, expected] of [
  ["PHYSICAL_GATEWAY", "qa-legacy-gateway-aa57572e8736", "gateway-runtime.tar.gz", "services/video-gateway/server.mjs", 10],
  ["SOFTWARE_CONNECTOR", "qa-legacy-connector-ee82c20a77ac", "connector-app.tar.gz", "Digital Observer.app/Contents/Resources/runtime/services/video-gateway/server.mjs", 1]
]) {
  const releaseDir = join(args["--store"], id);
  const manifest = JSON.parse(readFileSync(join(releaseDir, "release.json")));
  const bytes = readFileSync(join(releaseDir, archive));
  assert.equal(verifyEdgeUpdateManifest(manifest, trust).ok, true);
  assert.equal(verifyEdgeArtifact(bytes, manifest).ok, true);
  const root = mkdtempSync(join(tmpdir(), `observer-p38f-${profile.toLowerCase()}-`));
  const installed = join(root, "installed"); mkdirSync(installed, { recursive: true, mode: 0o700 });
  execFileSync("tar", ["-xzf", join(releaseDir, archive), "-C", installed]);
  const outside = join(root, "persistent"); mkdirSync(outside, { mode: 0o700 });
  for (const name of ["identity", "config", "queue", "source-mapping"]) writeFileSync(join(outside, name), `QA-${profile}-${name}`, { mode: 0o600 });
  const adapter = {
    async verifyInstalled({ artifactPath }) {
      const expectedServer = execFileSync("tar", ["-xOzf", artifactPath, member]);
      return readFileSync(join(installed, member)).equals(expectedServer);
    },
    async stageBaseline({ artifactPath, staging }) {
      const runtime = join(staging, "runtime"); mkdirSync(runtime, { mode: 0o700 });
      execFileSync("tar", ["-xzf", artifactPath, "-C", runtime]);
    },
    async install({ staging }) {
      const runtime = join(staging, "runtime"); mkdirSync(runtime, { mode: 0o700 });
      writeFileSync(join(runtime, "server.mjs"), "export const qa = true;\n", { mode: 0o600 });
    },
    async restart({ slot, rollback }) {
      const path = rollback || slot.includes("legacy") ? join(slot, "runtime", member) : join(slot, "runtime/server.mjs");
      assert.equal(existsSync(path), true);
      execFileSync(process.execPath, ["--check", path]);
    }
  };
  let failNewHealth = false;
  const healthCheck = async ({ rollback }) => ({ process_running: true, device_authenticated: true, heartbeat: true,
    config_retrieved: true, cloud_reachable: true, no_crash_loop: true, expected_physical_cameras: expected,
    progressing_physical_cameras: failNewHealth && !rollback ? 0 : expected, empty_slots: profile === "PHYSICAL_GATEWAY" ? 6 : 0, stalled_streams: 0 });
  const manager = new EdgeUpdateManager({ root: join(root, "ota"), trustedPublicKeys: trust,
    device: { deviceId: `qa-${profile.toLowerCase()}-device`, profile, platform: "darwin", architecture: "arm64",
      channel: "INTERNAL", currentVersion: "0.1.0-legacy", configVersion: 1 }, adapter, healthCheck });
  const pointer = await manager.bootstrapInstalled({ manifest, artifactBytes: bytes });
  assert.equal(pointer.release_id, id);
  assert.equal((await manager.bootstrapInstalled({ manifest, artifactBytes: bytes })).slot, pointer.slot);
  manager.verifySlot(pointer);
  const badBytes = Buffer.from("controlled QA bad update; no camera runtime\n");
  const bad = { ...manifest, release_id: `qa-bad-${profile.toLowerCase()}`, version: "0.2.0-qa",
    build_sha: createHash("sha256").update(badBytes).digest("hex"), artifact_sha256: createHash("sha256").update(badBytes).digest("hex"),
    artifact_size: badBytes.length, released_at: new Date().toISOString(),
    rollout: { ...manifest.rollout, cohort_percent: 100 }, signature: "" };
  bad.signature = sign(null, Buffer.from(canonicalEdgeUpdateManifest(bad)), privateKey).toString("base64url");
  failNewHealth = true;
  const rollback = await manager.apply({ manifest: bad, artifactBytes: badBytes });
  assert.equal(rollback.state, "ROLLED_BACK");
  assert.equal(manager.current().release_id, id);
  manager.verifySlot(manager.current());
  for (const name of ["identity", "config", "queue", "source-mapping"])
    assert.equal(readFileSync(join(outside, name), "utf8"), `QA-${profile}-${name}`);
  assert.equal(verifyEdgeUpdateManifest({ ...manifest, version: "0.1.1" }, trust).ok, false);
  assert.equal(verifyEdgeUpdateManifest(manifest, {}).reason, "EDGE_UPDATE_SIGNING_KEY_UNTRUSTED");
  assert.equal(verifyEdgeArtifact(Buffer.from("tampered"), manifest).ok, false);
  results.push({ profile, baseline_release: id, baseline_sha256: manifest.artifact_sha256,
    bootstrap: "PASS", idempotency: "PASS", bad_update_rollback: "PASS", baseline_content_parse: "PASS",
    persistent_fixture_preserved: true, service_manager_start: "NOT_TESTED", real_identity: "NOT_COPIED" });
  rmSync(root, { recursive: true, force: true });
}
console.log(JSON.stringify({ status: "ISOLATED_QA_PASS", results }));
