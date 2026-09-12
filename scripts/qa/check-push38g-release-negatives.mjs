import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertAuthorizedUpdateDirection, evaluateEdgeUpdateEligibility, verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";

const [baselineStore, releaseStore] = process.argv.slice(2);
if (!baselineStore || !releaseStore) throw new Error("QA_RELEASE_STORES_REQUIRED");
const trust = JSON.parse(readFileSync(join(baselineStore, "qa-trust-registry.json"))).trustedPublicKeys;
const cases = [
  ["PHYSICAL_GATEWAY", "qa-p38g-gateway-06a65267dffa", "gateway-runtime.tar.gz"],
  ["SOFTWARE_CONNECTOR", "qa-p38g-connector-06a65267dffa", "connector-remediation.tar.gz"]
];
const results = [];
for (const [profile, id, name] of cases) {
  const dir = join(releaseStore, id), manifest = JSON.parse(readFileSync(join(dir, "release.json")));
  const bytes = readFileSync(join(dir, name));
  assert.equal(verifyEdgeUpdateManifest(manifest, trust).ok, true);
  assert.equal(verifyEdgeArtifact(bytes, manifest).ok, true);
  assert.equal(verifyEdgeUpdateManifest({ ...manifest, signature: "" }, trust).ok, false, "unsigned");
  assert.equal(verifyEdgeUpdateManifest(manifest, {}).reason, "EDGE_UPDATE_SIGNING_KEY_UNTRUSTED", "wrong/revoked key");
  assert.equal(verifyEdgeUpdateManifest({ ...manifest, version: "9.9.9" }, trust).reason, "EDGE_UPDATE_SIGNATURE_INVALID", "tampered manifest");
  const tampered = Buffer.from(bytes); tampered[tampered.length - 1] ^= 1;
  assert.equal(verifyEdgeArtifact(tampered, manifest).reason, "EDGE_UPDATE_ARTIFACT_TAMPERED", "tampered artifact");
  const device = { deviceId: "qa-device-1", profile, platform: "darwin", architecture: "arm64", channel: "INTERNAL",
    currentVersion: "0.1.0-legacy", configVersion: 1, revoked: false };
  assert.equal(evaluateEdgeUpdateEligibility(manifest, { ...device, profile: profile === "PHYSICAL_GATEWAY" ? "SOFTWARE_CONNECTOR" : "PHYSICAL_GATEWAY" }).reason, "EDGE_UPDATE_PROFILE_MISMATCH");
  assert.equal(evaluateEdgeUpdateEligibility(manifest, { ...device, architecture: "x64" }).reason, "EDGE_UPDATE_PLATFORM_MISMATCH");
  assert.throws(() => assertAuthorizedUpdateDirection({ currentVersion: manifest.version, targetVersion: "0.1.0-legacy",
    knownGoodVersions: ["0.1.0-legacy"], securityFloorVersion: "0.1.0-legacy", rollback: false }), /EDGE_UPDATE_DOWNGRADE_REJECTED/);
  if (profile === "SOFTWARE_CONNECTOR") {
    const temp = mkdtempSync(join(tmpdir(), "observer-p38g-sign-mutation-"));
    try {
      execFileSync("tar", ["-xzf", join(dir, name), "-C", temp]);
      const app = join(temp, "Digital Observer.app");
      execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", app]);
      const metadata = join(app, "Contents/Resources/runtime/edge-release-metadata.json");
      writeFileSync(metadata, `${readFileSync(metadata, "utf8")} `);
      let rejected = false;
      try { execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", app], { stdio: "ignore" }); }
      catch { rejected = true; }
      assert.equal(rejected, true, "post-sign mutation must fail strict signature");
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }
  results.push({ profile, release_id: id, sha256: createHash("sha256").update(bytes).digest("hex"),
    unsigned_rejected: true, untrusted_revoked_key_rejected: true, tampered_manifest_rejected: true,
    tampered_artifact_rejected: true, wrong_profile_rejected: true, wrong_arch_rejected: true,
    replay_downgrade_rejected: true, post_sign_mutation_rejected: profile === "SOFTWARE_CONNECTOR" });
}
console.log(JSON.stringify({ status: "PASS", results }));
