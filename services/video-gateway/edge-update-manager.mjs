import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  EDGE_UPDATE_STATES, assertAuthorizedUpdateDirection, evaluateEdgeUpdateEligibility,
  verifyEdgeArtifact, verifyEdgeUpdateManifest
} from "./edge-update-contract.mjs";

function fail(code) { throw Object.assign(new Error(code), { code }); }
const allowedTransitions = Object.freeze({
  IDLE: ["IDLE", "UPDATE_AVAILABLE"], HEALTHY: ["UPDATE_AVAILABLE"], ROLLED_BACK: ["UPDATE_AVAILABLE"], UPDATE_FAILED: ["UPDATE_AVAILABLE"],
  UPDATE_AVAILABLE: ["DOWNLOADING", "UPDATE_FAILED"], DOWNLOADING: ["VERIFYING", "UPDATE_FAILED"],
  VERIFYING: ["STAGED", "UPDATE_FAILED"], STAGED: ["INSTALLING", "UPDATE_FAILED"],
  INSTALLING: ["RESTARTING", "ROLLBACK_REQUIRED", "UPDATE_FAILED"], RESTARTING: ["VERIFYING_HEALTH", "ROLLBACK_REQUIRED"],
  VERIFYING_HEALTH: ["HEALTHY", "ROLLBACK_REQUIRED"], ROLLBACK_REQUIRED: ["ROLLING_BACK"],
  ROLLING_BACK: ["ROLLED_BACK", "UPDATE_FAILED"]
});
function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  renameSync(temporary, path);
}
function safeVersion(value) { if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value)) fail("EDGE_UPDATE_VERSION_INVALID"); return value; }

export function edgeHealthGate(input) {
  if (!input || typeof input !== "object") return { healthy: false, reason: "EDGE_UPDATE_HEALTH_UNKNOWN" };
  const required = ["process_running", "device_authenticated", "heartbeat", "config_retrieved", "cloud_reachable", "no_crash_loop"];
  const missing = required.filter((key) => input[key] !== true);
  if (missing.length) return { healthy: false, reason: `EDGE_UPDATE_HEALTH_${missing[0].toUpperCase()}_FAILED` };
  const expected = Number(input.expected_physical_cameras || 0), progressing = Number(input.progressing_physical_cameras || 0);
  const emptySlots = Number(input.empty_slots || 0), stalled = Number(input.stalled_streams || 0);
  if (![expected, progressing, emptySlots, stalled].every((value) => Number.isInteger(value) && value >= 0)) return { healthy: false, reason: "EDGE_UPDATE_HEALTH_COUNTS_INVALID" };
  if (progressing < expected || stalled > 0) return { healthy: false, reason: "EDGE_UPDATE_CAMERA_PROGRESSION_FAILED" };
  return { healthy: true, reason: "EDGE_UPDATE_HEALTHY", expected_physical_cameras: expected, progressing_physical_cameras: progressing, empty_slots_ignored: emptySlots };
}

export class EdgeUpdateManager {
  constructor({ root, trustedPublicKeys, device, adapter, healthCheck, now = () => Date.now() }) {
    this.root = resolve(root); this.trustedPublicKeys = trustedPublicKeys; this.device = Object.freeze({ ...device });
    this.adapter = adapter; this.healthCheck = healthCheck; this.now = now;
    this.statePath = join(this.root, "update-state.json"); this.currentPath = join(this.root, "current.json");
    this.knownGoodPath = join(this.root, "known-good.json"); this.quarantinePath = join(this.root, "quarantined-releases.json");
    mkdirSync(join(this.root, "slots"), { recursive: true, mode: 0o700 });
  }
  readJson(path, fallback) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; } }
  current() { return this.readJson(this.currentPath, { version: this.device.currentVersion, slot: null, build_sha: this.device.buildSha || "unknown" }); }
  knownGood() { return this.readJson(this.knownGoodPath, [this.current()]); }
  quarantine() { return this.readJson(this.quarantinePath, []); }
  status() { return this.readJson(this.statePath, { state: "IDLE", current_version: this.current().version, known_good_version: this.knownGood().at(-1)?.version || this.current().version, history: [] }); }
  transition(state, details = {}) {
    if (!EDGE_UPDATE_STATES.includes(state)) fail("EDGE_UPDATE_STATE_INVALID");
    const previous = this.status();
    if (!(allowedTransitions[previous.state] || []).includes(state)) fail("EDGE_UPDATE_TRANSITION_INVALID");
    const next = { ...previous, state, current_version: this.current().version, known_good_version: this.knownGood().at(-1)?.version || this.current().version,
      updated_at: new Date(this.now()).toISOString(), ...details,
      history: [...(previous.history || []).slice(-99), { state, at: new Date(this.now()).toISOString(), category: details.failure_category || null }] };
    atomicJson(this.statePath, next); return next;
  }
  initializeKnownGood(version = this.device.currentVersion, buildSha = this.device.buildSha || "unknown") {
    const slot = join(this.root, "slots", safeVersion(version)); mkdirSync(slot, { recursive: true, mode: 0o700 });
    const pointer = { version, build_sha: buildSha, slot, promoted_at: new Date(this.now()).toISOString(), trusted: true };
    atomicJson(this.currentPath, pointer); atomicJson(this.knownGoodPath, [pointer]); this.transition("IDLE"); return pointer;
  }
  quarantineRelease(manifest, reason) {
    const current = this.quarantine();
    if (!current.some((item) => item.release_id === manifest.release_id)) current.push({ release_id: manifest.release_id, version: manifest.version, reason, at: new Date(this.now()).toISOString() });
    atomicJson(this.quarantinePath, current.slice(-100));
  }
  async apply({ manifest: input, artifactBytes, interruptAt = null }) {
    const verified = verifyEdgeUpdateManifest(input, this.trustedPublicKeys);
    if (!verified.ok) fail(verified.reason);
    const manifest = verified.manifest;
    if (this.quarantine().some((item) => item.release_id === manifest.release_id)) fail("EDGE_UPDATE_RELEASE_QUARANTINED");
    const eligibility = evaluateEdgeUpdateEligibility(manifest, { ...this.device, currentVersion: this.current().version });
    if (!eligibility.eligible) fail(eligibility.reason);
    assertAuthorizedUpdateDirection({ currentVersion: this.current().version, targetVersion: manifest.version,
      knownGoodVersions: this.knownGood().map((item) => item.version), securityFloorVersion: manifest.compatibility.security_floor_version, rollback: false });
    const previous = this.current();
    const staging = join(this.root, "slots", `.${safeVersion(manifest.version)}.${randomUUID()}.staging`);
    let switched = false;
    try {
      this.transition("UPDATE_AVAILABLE", { target_version: manifest.version, release_id: manifest.release_id });
      this.transition("DOWNLOADING"); if (interruptAt === "DOWNLOADING") fail("EDGE_UPDATE_INTERRUPTED_DOWNLOAD");
      const bytes = Buffer.from(artifactBytes);
      this.transition("VERIFYING"); const artifact = verifyEdgeArtifact(bytes, manifest); if (!artifact.ok) fail(artifact.reason);
      mkdirSync(staging, { recursive: true, mode: 0o700 });
      const artifactPath = join(staging, "artifact.bin"); writeFileSync(artifactPath, bytes, { mode: 0o600, flag: "wx" });
      atomicJson(join(staging, "release.json"), { release_id: manifest.release_id, version: manifest.version, build_sha: manifest.build_sha,
        artifact_sha256: manifest.artifact_sha256, profile: manifest.profile, platform: manifest.platform, architecture: manifest.architecture });
      this.transition("STAGED"); if (interruptAt === "STAGED") fail("EDGE_UPDATE_INTERRUPTED_STAGING");
      this.transition("INSTALLING"); await this.adapter.install({ artifactPath, staging, manifest });
      const finalSlot = join(this.root, "slots", manifest.version); if (existsSync(finalSlot)) fail("EDGE_UPDATE_SLOT_ALREADY_EXISTS");
      renameSync(staging, finalSlot);
      atomicJson(this.currentPath, { version: manifest.version, build_sha: manifest.build_sha, slot: finalSlot, release_id: manifest.release_id, trusted: true });
      switched = true; if (interruptAt === "INSTALLING") fail("EDGE_UPDATE_INTERRUPTED_INSTALL");
      this.transition("RESTARTING"); await this.adapter.restart({ slot: finalSlot, manifest });
      this.transition("VERIFYING_HEALTH"); const health = edgeHealthGate(await this.healthCheck({ version: manifest.version, manifest }));
      if (!health.healthy) fail(health.reason);
      const knownGood = this.knownGood(); knownGood.push({ ...this.current(), promoted_at: new Date(this.now()).toISOString(), health });
      atomicJson(this.knownGoodPath, knownGood.slice(-3));
      return this.transition("HEALTHY", { target_version: manifest.version, release_id: manifest.release_id, health });
    } catch (error) {
      const reason = error.code || "EDGE_UPDATE_FAILED";
      if (switched) {
        this.transition("ROLLBACK_REQUIRED", { failure_category: reason, target_version: manifest.version });
        this.transition("ROLLING_BACK", { failure_category: reason });
        assertAuthorizedUpdateDirection({ currentVersion: manifest.version, targetVersion: previous.version,
          knownGoodVersions: this.knownGood().map((item) => item.version), securityFloorVersion: manifest.compatibility.security_floor_version, rollback: true });
        atomicJson(this.currentPath, previous); await this.adapter.restart({ slot: previous.slot, manifest: null, rollback: true });
        const recovered = edgeHealthGate(await this.healthCheck({ version: previous.version, rollback: true }));
        if (!recovered.healthy) { this.transition("UPDATE_FAILED", { failure_category: "EDGE_UPDATE_ROLLBACK_HEALTH_FAILED" }); throw Object.assign(error, { rollback: "FAILED" }); }
        this.quarantineRelease(manifest, reason);
        this.transition("ROLLED_BACK", { failure_category: reason, failed_version: manifest.version, recovered_version: previous.version, recovery_health: recovered });
        return this.status();
      }
      rmSync(staging, { recursive: true, force: true });
      this.transition("UPDATE_FAILED", { failure_category: reason, target_version: manifest.version, current_unchanged: true });
      throw error;
    }
  }
}

export async function downloadEdgeUpdateArtifact({ url, destination, expectedSize, expectedSha256, fetchImpl = fetch, maxBytes = 2 * 1024 * 1024 * 1024 }) {
  const parsed = new URL(url); if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) fail("EDGE_UPDATE_ARTIFACT_TRANSPORT_INVALID");
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > maxBytes) fail("EDGE_UPDATE_ARTIFACT_SIZE_INVALID");
  const temporary = `${destination}.${process.pid}.${randomUUID()}.partial`; mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
  let handle;
  try {
    const response = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(120_000) });
    if (!response.ok || !response.body) fail("EDGE_UPDATE_DOWNLOAD_FAILED");
    handle = openSync(temporary, "wx", 0o600); closeSync(handle); handle = null;
    const chunks = []; let total = 0;
    for await (const chunk of response.body) { total += chunk.byteLength; if (total > expectedSize || total > maxBytes) fail("EDGE_UPDATE_DOWNLOAD_SIZE_EXCEEDED"); chunks.push(Buffer.from(chunk)); }
    const bytes = Buffer.concat(chunks); if (bytes.length !== expectedSize || createHash("sha256").update(bytes).digest("hex") !== expectedSha256) fail("EDGE_UPDATE_ARTIFACT_TAMPERED");
    writeFileSync(temporary, bytes, { mode: 0o600 }); renameSync(temporary, destination); return { path: destination, bytes: bytes.length };
  } catch (error) { if (handle !== undefined && handle !== null) try { closeSync(handle); } catch {} rmSync(temporary, { force: true }); throw error; }
}
