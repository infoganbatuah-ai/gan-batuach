// Authorize one exact signed Gateway recovery candidate after the already
// restored signed known-good runtime is itself unavailable. This changes only
// the OTA manager state from ACTION_REQUIRED to ROLLED_BACK; it does not
// install, restart, or promote a release. The normal managed OTA path remains
// the sole owner of candidate installation and health-gated promotion.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { PUSH38_GATEWAY_AUTH_RECOVERY } from "../../services/video-gateway/push38-home-qa-gateway-auth-recovery.mjs";

const apply = process.argv.includes("--apply"), dryRun = process.argv.includes("--dry-run");
if (apply === dryRun) throw new Error("P38_GATEWAY_SIGNED_RECOVERY_EXPLICIT_MODE_REQUIRED");
const restrictedRoot = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted";
const bundle = resolve(process.argv.find(value => value.startsWith("--bundle="))?.slice(9) ||
  join(restrictedRoot, "push38-homeqa-gateway-auth.zip"));
const evidence = Object.freeze([
  { path: join(restrictedRoot, "push38-dvr-physical-ground-truth-shadow-summary-20260922.json"),
    sha256: "d7f273e150d0e6947251995f16c2632b0d1e8d26e62cc3f91374de3d0907e38c" },
  { path: join(restrictedRoot, "push38-live-gateway-dvr-truth-20260922.json"),
    sha256: "846ce1502ef087bd70eca9d5639fa473df145fa11ce7342a45355b1e92edb0ac" }
]);
for (const path of [bundle, ...evidence.map(item => item.path)]) {
  const scoped = relative(restrictedRoot, path);
  if (!scoped || scoped === ".." || scoped.startsWith(`..${sep}`) || isAbsolute(scoped) ||
    !existsSync(path) || lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile())
    throw new Error("P38_GATEWAY_SIGNED_RECOVERY_INPUT_SCOPE_INVALID");
}
const hash = path => createHash("sha256").update(readFileSync(path)).digest("hex");
for (const item of evidence) if (hash(item.path) !== item.sha256)
  throw new Error("P38_GATEWAY_SIGNED_RECOVERY_EVIDENCE_CHANGED");
const shadow = JSON.parse(readFileSync(evidence[0].path, "utf8"));
const live = JSON.parse(readFileSync(evidence[1].path, "utf8"));
if (shadow.shadow?.available_channel_stream_proof?.passed !== 8 ||
  shadow.shadow?.available_channel_stream_proof?.failed !== 0 ||
  shadow.shadow?.parallel_full_ten_channel_shadow !== "NOT_RUN_PROHIBITED" ||
  shadow.writes?.gateway_or_connector_runtime !== 0 || shadow.writes?.production !== 0 ||
  live.expected_physical !== 10 || live.source_available?.length !== 8 ||
  live.upstream_unavailable?.length !== 2 || live.empty?.length !== 6 ||
  live.checkpoints?.some(checkpoint => checkpoint.health?.media?.progressing !== 8 ||
    checkpoint.health?.media?.stalled !== 0))
  throw new Error("P38_GATEWAY_SIGNED_RECOVERY_EVIDENCE_INSUFFICIENT");

const manifest = JSON.parse(execFileSync("unzip", ["-p", bundle, "gateway_remediation_auth.json"],
  { encoding: "utf8", timeout: 15_000, maxBuffer: 8192 }));
const trustedPublicKeys = loadPinnedEdgeReleaseKeys({
  registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH
}).trustedPublicKeys;
const item = PUSH38_GATEWAY_AUTH_RECOVERY;
if (!verifyEdgeUpdateManifest(manifest, trustedPublicKeys).ok || manifest.release_id !== item.releaseId ||
  manifest.artifact_sha256 !== item.digest || manifest.artifact_size !== item.size ||
  manifest.profile !== "PHYSICAL_GATEWAY" || manifest.channel !== "HOME_QA" ||
  manifest.signing_key_id !== "observer-kms-release-v1" || manifest.rollout?.cohort_percent !== 0 ||
  JSON.stringify(manifest.rollout?.explicit_device_ids) !== JSON.stringify([item.deviceId]))
  throw new Error("P38_GATEWAY_SIGNED_RECOVERY_MANIFEST_INVALID");

const context = "colima-push38t", container = "supabase_db_gan-batuach-push38t";
const sql = `select jsonb_build_object(
  'candidate',count(*) filter(where r.release_id='${item.releaseId}' and o.status='DRAFT'
    and o.cohort_percent=0 and o.target_filters->'explicit_device_ids'=jsonb_build_array('${item.deviceId}')),
  'other_gateway_unpaused',count(*) filter(where r.deployment_profile='PHYSICAL_GATEWAY'
    and r.release_id<>'${item.releaseId}' and o.status<>'PAUSED'),
  'broad',count(*) filter(where o.cohort_percent<>0))
from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id;`;
const qa = JSON.parse(execFileSync("docker", ["--context", context, "exec", container, "psql", "-X", "-A", "-t",
  "-U", "postgres", "-d", "postgres", "-c", sql],
{ encoding: "utf8", timeout: 45_000, stdio: ["ignore", "pipe", "pipe"] }).trim());
if (Number(qa.candidate) !== 1 || Number(qa.other_gateway_unpaused) !== 0 || Number(qa.broad) !== 0)
  throw new Error("P38_GATEWAY_SIGNED_RECOVERY_ROLLOUT_STATE_INVALID");

const root = join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota");
const manager = new EdgeUpdateManager({ root, trustedPublicKeys,
  device: { deviceId: item.deviceId, profile: "PHYSICAL_GATEWAY", platform: "darwin",
    architecture: process.arch, channel: "HOME_QA", currentVersion: "0.1.0-legacy", configVersion: 1,
    revoked: false }, adapter: {}, healthCheck: async () => ({}) });
const state = manager.status(), current = manager.current(), knownGood = manager.knownGood();
if (state.state !== "ACTION_REQUIRED" || state.failure_category !== "EDGE_UPDATE_KNOWN_GOOD_UNHEALTHY" ||
  state.release_id !== "qa-p38-health-gateway-6c9d08327ec6" ||
  current.release_id !== "qa-legacy-gateway-91bf6814075f" ||
  current.artifact_sha256 !== "91bf6814075f74e703cbc0b85d30673237531247ec46633c54576d5a4627144d" ||
  !knownGood.some(entry => entry.release_id === current.release_id &&
    entry.artifact_sha256 === current.artifact_sha256))
  throw new Error("P38_GATEWAY_SIGNED_RECOVERY_STATE_MISMATCH");
manager.verifySlot(current);
const failedSlot = join(root, "slots", state.target_version);
const failedManifest = JSON.parse(readFileSync(join(failedSlot, "release.json"), "utf8"));
manager.verifySlot({ version: failedManifest.version, slot: failedSlot, release_id: failedManifest.release_id,
  artifact_sha256: failedManifest.artifact_sha256 });
if (failedManifest.release_id !== state.release_id)
  throw new Error("P38_GATEWAY_SIGNED_RECOVERY_FAILED_RELEASE_MISMATCH");

if (dryRun) {
  console.log(JSON.stringify({ status: "PASS", mode: "DRY_RUN", current_release: current.release_id,
    failed_release: failedManifest.release_id, recovery_release: manifest.release_id,
    signed_candidate: true, exact_device: true, cohort_percent: 0, runtime_writes: 0,
    source_or_identity_mutation: false }));
  process.exit(0);
}
manager.quarantineRelease(failedManifest, state.failure_category);
const authorized = manager.transition("ROLLED_BACK", { failure_category: state.failure_category,
  failed_version: failedManifest.version, recovered_version: current.version,
  recovery_category: "EDGE_UPDATE_SIGNED_RECOVERY_FROM_UNHEALTHY_KNOWN_GOOD_AUTHORIZED",
  recovery_release_id: manifest.release_id,
  recovery_evidence_sha256: evidence.map(entry => entry.sha256) });
console.log(JSON.stringify({ status: "PASS", mode: "APPLY", update_state: authorized.state,
  current_release: manager.current().release_id, failed_release_quarantined: failedManifest.release_id,
  recovery_release: manifest.release_id, runtime_restarted: false, release_installed: false,
  release_promoted: false, source_or_identity_mutation: false }));
