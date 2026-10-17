// Transactional management bootstrap for an already-installed Edge runtime.
// The functional runtime is never replaced before the signed baseline is
// verified and staged. The service adapter owns the reversible handoff.
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { verifyEdgeArtifact, verifyEdgeUpdateManifest } from "./edge-update-contract.mjs";

function fail(code) { throw Object.assign(new Error(code), { code }); }
function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  renameSync(temporary, path);
}

export function createInstalledEdgeBootstrap({ root, manager, adapter, trust, inspect, verifyContinuity }) {
  if (!manager || !adapter?.restart || !adapter?.restoreLegacy || !trust?.verify || !inspect || !verifyContinuity)
    fail("EDGE_BOOTSTRAP_ADAPTER_INCOMPLETE");
  const journalPath = join(resolve(root), "bootstrap-journal.json");
  const read = () => existsSync(journalPath) ? JSON.parse(readFileSync(journalPath, "utf8")) : null;
  const save = (phase, manifest, extra = {}) => {
    const prior = read();
    const next = { protocol: "observer-edge-bootstrap-journal-v1", release_id: manifest.release_id,
      artifact_sha256: manifest.artifact_sha256, phase, updated_at: new Date().toISOString(),
      identity_fingerprint: prior?.identity_fingerprint || extra.identity_fingerprint || null,
      binding_fingerprint: prior?.binding_fingerprint || extra.binding_fingerprint || null,
      ...extra };
    atomicJson(journalPath, next); return next;
  };
  async function run({ manifest, artifactBytes, approvedSha256, interruptAfter = null }) {
    const verified = verifyEdgeUpdateManifest(manifest, manager.trustedPublicKeys);
    if (!verified.ok) fail(verified.reason);
    if (approvedSha256 !== manifest.artifact_sha256 || !verifyEdgeArtifact(artifactBytes, manifest).ok)
      fail("EDGE_BOOTSTRAP_BASELINE_MISMATCH");
    const prior = read();
    if (prior?.phase === "ABORTED") fail("EDGE_BOOTSTRAP_PREVIOUSLY_ABORTED");
    if (prior && (prior.release_id !== manifest.release_id || prior.artifact_sha256 !== manifest.artifact_sha256))
      fail("EDGE_BOOTSTRAP_JOURNAL_CONFLICT");
    if (["SUPERVISOR_HANDOFF", "HANDOFF_FAILED"].includes(prior?.phase)) await adapter.restoreLegacy();
    const before = await inspect();
    if (!before?.legacy_running && prior?.phase !== "COMPLETE") fail("EDGE_BOOTSTRAP_LEGACY_NOT_RUNNING");
    if (prior?.identity_fingerprint && prior.identity_fingerprint !== before.identity_fingerprint) fail("EDGE_BOOTSTRAP_IDENTITY_CHANGED");
    if (prior?.binding_fingerprint && prior.binding_fingerprint !== before.binding_fingerprint) fail("EDGE_BOOTSTRAP_BINDING_CHANGED");
    if (!prior) save("DISCOVERED", manifest, { identity_fingerprint: before.identity_fingerprint,
      binding_fingerprint: before.binding_fingerprint });
    if (interruptAfter === "DISCOVERED") fail("EDGE_BOOTSTRAP_TEST_INTERRUPTION");
    await trust.verify({ manifest });
    if (!manager.current().slot) {
      save("BASELINE_AUTHORIZED", manifest);
      if (interruptAfter === "BASELINE_AUTHORIZED") fail("EDGE_BOOTSTRAP_TEST_INTERRUPTION");
      save("TRUST_VERIFIED", manifest);
      if (interruptAfter === "TRUST_VERIFIED") fail("EDGE_BOOTSTRAP_TEST_INTERRUPTION");
      await manager.bootstrapInstalled({ manifest, artifactBytes });
      save("SLOT_REGISTERED", manifest);
    } else manager.verifySlot(manager.current());
    if (interruptAfter === "SLOT_REGISTERED") fail("EDGE_BOOTSTRAP_TEST_INTERRUPTION");
    const current = manager.current();
    if (current.release_id !== manifest.release_id || current.artifact_sha256 !== manifest.artifact_sha256)
      fail("EDGE_BOOTSTRAP_CURRENT_CONFLICT");
    if (read()?.phase !== "COMPLETE") {
      save("SUPERVISOR_HANDOFF", manifest);
      if (interruptAfter === "SUPERVISOR_HANDOFF") fail("EDGE_BOOTSTRAP_TEST_INTERRUPTION");
      try {
        await adapter.restart({ slot: current.slot, manifest, bootstrap: true });
        if (!await verifyContinuity({ before, manifest, current })) fail("EDGE_BOOTSTRAP_CONTINUITY_FAILED");
      } catch (error) {
        await adapter.restoreLegacy();
        save("HANDOFF_FAILED", manifest, { failure_category: error.code || "EDGE_BOOTSTRAP_HANDOFF_FAILED" });
        throw error;
      }
      save("COMPLETE", manifest);
    }
    return { state: "COMPLETE", current_release: manager.current().release_id,
      known_good_release: manager.knownGood().at(-1)?.release_id || null, journal: read() };
  }
  async function abort() {
    const prior = read();
    if (!prior || prior.phase === "ABORTED") return { state: "UNMANAGED", changed: false };
    await adapter.restoreLegacy();
    const after = await inspect();
    if (!after?.legacy_running || after.identity_fingerprint !== prior.identity_fingerprint ||
      after.binding_fingerprint !== prior.binding_fingerprint) fail("EDGE_BOOTSTRAP_ABORT_LEGACY_UNHEALTHY");
    const result = manager.abortInstalledBootstrap();
    save("ABORTED", { release_id: prior.release_id, artifact_sha256: prior.artifact_sha256 });
    return result;
  }
  return { run, abort, journal: read };
}
