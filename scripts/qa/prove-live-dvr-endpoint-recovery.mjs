// Read-only real-Home proof for the identity-bound private-DVR endpoint
// recovery contract. Endpoint values and credentials never enter the report.
import { createHash } from "node:crypto";
import { chmodSync, existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { discoverAuthorizedPrivateNvrEndpoint, parsePrivateNvrIdentityBinding,
  PRIVATE_NVR_IDENTITY_BINDING_ACCOUNT } from
  "../../services/video-gateway/private-nvr-endpoint-recovery.mjs";

const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const output = resolve(option("output") || ".");
const previousEvidencePath = resolve(option("previous-profile-evidence") || ".");
const restrictedRoot = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
if (!output.startsWith(restrictedRoot) || !previousEvidencePath.startsWith(restrictedRoot)
  || existsSync(output)) throw new Error("P38_DVR_ENDPOINT_RECOVERY_EVIDENCE_PATH_INVALID");

const previousEvidence = JSON.parse(readFileSync(previousEvidencePath, "utf8"));
if (previousEvidence?.protocol !== "observer-push38-live-dvr-endpoint-reconciliation-v1"
  || previousEvidence?.mode !== "PREWRITE_BACKUP"
  || !previousEvidence.profile_before?.endpoint || !previousEvidence.profile_before?.username) {
  throw new Error("P38_DVR_PREVIOUS_PROFILE_EVIDENCE_INVALID");
}

const store = createEdgeSecretStoreSync({ keychainService: "com.ganbatuach.video-gateway.runtime" });
const rawCurrentProfile = store.read("dvr_profile_json");
const password = store.read("dvr_password");
const rawBinding = store.read(PRIVATE_NVR_IDENTITY_BINDING_ACCOUNT);
if (!rawCurrentProfile || !password || !rawBinding) throw new Error("P38_DVR_RECOVERY_INPUT_UNAVAILABLE");
const currentProfile = JSON.parse(rawCurrentProfile);
const binding = parsePrivateNvrIdentityBinding(rawBinding);
const previousProfile = { ...previousEvidence.profile_before };
if (previousProfile.endpoint === currentProfile.endpoint) {
  throw new Error("P38_DVR_PREVIOUS_ENDPOINT_IS_NOT_STALE");
}

const startedAt = Date.now();
const current = await discoverAuthorizedPrivateNvrEndpoint({ profile: currentProfile, password, binding });
const stale = await discoverAuthorizedPrivateNvrEndpoint({ profile: previousProfile, password, binding });
if (current.status !== "CURRENT" || stale.status !== "CHANGED"
  || current.identity?.fingerprint_sha256 !== binding.fingerprint_sha256
  || stale.identity?.fingerprint_sha256 !== binding.fingerprint_sha256) {
  throw new Error("P38_DVR_ENDPOINT_RECOVERY_LIVE_PROOF_FAILED");
}
const evidence = {
  contract: "observer-push38-live-dvr-endpoint-recovery-proof-v1",
  observed_at: new Date().toISOString(),
  duration_ms: Date.now() - startedAt,
  current_endpoint_identity: "PASS",
  stale_endpoint_recovery: "PASS",
  same_authorized_recorder: true,
  bounded_private_subnet: true,
  read_only: true,
  endpoint_exposed: false,
  credentials_exposed: false,
  source_identity_changed: false,
  binding_sha256: createHash("sha256").update(rawBinding).digest("hex"),
  current_profile_sha256: createHash("sha256").update(rawCurrentProfile).digest("hex"),
  previous_profile_sha256: createHash("sha256").update(JSON.stringify(previousProfile)).digest("hex")
};
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
chmodSync(output, 0o600);
console.log(JSON.stringify({ status: "PASS", ...evidence }));
