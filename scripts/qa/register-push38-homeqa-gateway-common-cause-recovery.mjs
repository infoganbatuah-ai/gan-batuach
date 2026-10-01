// Register the immutable AWS-signed Gateway common-cause recovery remediation in
// the isolated PUSH 38 qualification database. Registration is exact-device
// and DRAFT-only; activation remains a separate pinned operation.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, lstatSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl } from "../../services/video-gateway/edge-release-object.mjs";
import { loadPinnedEdgeReleaseKeys,
  PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY,
} from "../../services/video-gateway/push38-home-qa-gateway-common-cause-recovery.mjs";
import { PUSH38_GATEWAY_FINITE_STREAM_HANDOFF
} from "../../services/video-gateway/push38-home-qa-gateway-finite-stream-handoff.mjs";
import { PUSH38_GATEWAY_SUPERVISOR_RECOVERY
} from "../../services/video-gateway/push38-home-qa-gateway-supervisor-recovery.mjs";
import { PUSH38_GATEWAY_STABLE_HANDOFF
} from "../../services/video-gateway/push38-home-qa-gateway-stable-handoff.mjs";
import { PUSH38_GATEWAY_MEDIA_CADENCE
} from "../../services/video-gateway/push38-home-qa-gateway-media-cadence.mjs";
import { PUSH38_GATEWAY_MAINTENANCE_ISOLATION
} from "../../services/video-gateway/push38-home-qa-gateway-maintenance-isolation.mjs";
import { PUSH38_GATEWAY_SESSION_SWEEP
} from "../../services/video-gateway/push38-home-qa-gateway-session-sweep.mjs";
import { PUSH38_GATEWAY_HEARTBEAT_LOGIN
} from "../../services/video-gateway/push38-home-qa-gateway-heartbeat-login.mjs";
import { PUSH38_GATEWAY_IDLE_HANDOFF
} from "../../services/video-gateway/push38-home-qa-gateway-idle-handoff.mjs";
import { PUSH38_GATEWAY_BUFFERED_OUTPUT
} from "../../services/video-gateway/push38-home-qa-gateway-buffered-output.mjs";
import { PUSH38_GATEWAY_OUTPUT_RESCUE
} from "../../services/video-gateway/push38-home-qa-gateway-output-rescue.mjs";
import { PUSH38_GATEWAY_CONFIRMED_HANDOFF
} from "../../services/video-gateway/push38-home-qa-gateway-confirmed-handoff.mjs";
import { PUSH38_GATEWAY_STARTUP_WINDOW
} from "../../services/video-gateway/push38-home-qa-gateway-startup-window.mjs";
import { PUSH38_GATEWAY_HANDOFF_PROBATION
} from "../../services/video-gateway/push38-home-qa-gateway-handoff-probation.mjs";
import { PUSH38_GATEWAY_RETAINED_FALLBACK
} from "../../services/video-gateway/push38-home-qa-gateway-retained-fallback.mjs";
import { PUSH38_GATEWAY_CONTINUOUS_HANDOFF
} from "../../services/video-gateway/push38-home-qa-gateway-continuous-handoff.mjs";
import { PUSH38_GATEWAY_ROUTINE_PROVISIONAL
} from "../../services/video-gateway/push38-home-qa-gateway-routine-provisional.mjs";
import { PUSH38_GATEWAY_PROBATION_BUDGET
} from "../../services/video-gateway/push38-home-qa-gateway-probation-budget.mjs";
import { PUSH38_GATEWAY_RESCUE_CAPACITY
} from "../../services/video-gateway/push38-home-qa-gateway-rescue-capacity.mjs";
import { PUSH38_GATEWAY_CODEC_PRESERVATION
} from "../../services/video-gateway/push38-home-qa-gateway-codec-preservation.mjs";
import { PUSH38_GATEWAY_HANDOFF_HARDWARE
} from "../../services/video-gateway/push38-home-qa-gateway-handoff-hardware.mjs";
import { PUSH38_GATEWAY_RELAY_HANDOFF_REMEDIATION
} from "../../services/video-gateway/push38-home-qa-gateway-relay-handoff-remediation.mjs";
import { PUSH38_GATEWAY_HANDOFF_CONTINUITY
} from "../../services/video-gateway/push38-home-qa-gateway-handoff-continuity.mjs";
import { PUSH38_GATEWAY_HANDOFF_OWNER_CONTINUITY
} from "../../services/video-gateway/push38-home-qa-gateway-handoff-owner-continuity.mjs";
import { PUSH38_GATEWAY_SWEEP_DEADLINE
} from "../../services/video-gateway/push38-home-qa-gateway-sweep-deadline.mjs";
import { PUSH38_GATEWAY_DEADLINE_BUDGET
} from "../../services/video-gateway/push38-home-qa-gateway-deadline-budget.mjs";
import { PUSH38_GATEWAY_RECOVERY_CONTINUITY
} from "../../services/video-gateway/push38-home-qa-gateway-recovery-continuity.mjs";
import { PUSH38_GATEWAY_ROUTINE_CONFIRMATION
} from "../../services/video-gateway/push38-home-qa-gateway-routine-confirmation.mjs";

const apply = process.argv.includes("--apply");
const finiteHandoff = process.argv.includes("--finite-stream-handoff");
const supervisorRecovery = process.argv.includes("--supervisor-recovery");
const stableHandoff = process.argv.includes("--stable-handoff");
const mediaCadence = process.argv.includes("--media-cadence");
const maintenanceIsolation = process.argv.includes("--maintenance-isolation");
const sessionSweep = process.argv.includes("--session-sweep");
const heartbeatLogin = process.argv.includes("--heartbeat-login");
const idleHandoff = process.argv.includes("--idle-handoff");
const bufferedOutput = process.argv.includes("--buffered-output");
const outputRescue = process.argv.includes("--output-rescue");
const confirmedHandoff = process.argv.includes("--confirmed-handoff");
const startupWindow = process.argv.includes("--startup-window");
const handoffProbation = process.argv.includes("--handoff-probation");
const retainedFallback = process.argv.includes("--retained-fallback");
const continuousHandoff = process.argv.includes("--continuous-handoff");
const routineProvisional = process.argv.includes("--routine-provisional");
const probationBudget = process.argv.includes("--probation-budget");
const rescueCapacity = process.argv.includes("--rescue-capacity");
const codecPreservation = process.argv.includes("--gateway-codec-preservation");
const handoffHardware = process.argv.includes("--gateway-handoff-hardware");
const relayHandoff = process.argv.includes("--gateway-relay-handoff");
const handoffContinuity = process.argv.includes("--gateway-handoff-continuity");
const handoffOwnerContinuity = process.argv.includes("--gateway-handoff-owner-continuity");
const sweepDeadline = process.argv.includes("--gateway-sweep-deadline");
const deadlineBudget = process.argv.includes("--gateway-deadline-budget");
const recoveryContinuity = process.argv.includes("--gateway-recovery-continuity");
const routineConfirmation = process.argv.includes("--gateway-routine-confirmation");
if ([finiteHandoff, supervisorRecovery, stableHandoff, mediaCadence, maintenanceIsolation, sessionSweep,
  heartbeatLogin, idleHandoff, bufferedOutput, outputRescue, confirmedHandoff, startupWindow,
  handoffProbation, retainedFallback, continuousHandoff, routineProvisional, probationBudget,
  rescueCapacity, codecPreservation, handoffHardware, relayHandoff, handoffContinuity,
  handoffOwnerContinuity, sweepDeadline, deadlineBudget, recoveryContinuity, routineConfirmation]
  .filter(Boolean).length > 1)
  throw new Error("P38_GATEWAY_COMMON_CAUSE_HOME_QA_MODE_INVALID");
const item = routineConfirmation ? PUSH38_GATEWAY_ROUTINE_CONFIRMATION :
  recoveryContinuity ? PUSH38_GATEWAY_RECOVERY_CONTINUITY :
  deadlineBudget ? PUSH38_GATEWAY_DEADLINE_BUDGET :
  sweepDeadline ? PUSH38_GATEWAY_SWEEP_DEADLINE :
  handoffOwnerContinuity ? PUSH38_GATEWAY_HANDOFF_OWNER_CONTINUITY :
  handoffContinuity ? PUSH38_GATEWAY_HANDOFF_CONTINUITY :
  relayHandoff ? PUSH38_GATEWAY_RELAY_HANDOFF_REMEDIATION :
  handoffHardware ? PUSH38_GATEWAY_HANDOFF_HARDWARE :
  codecPreservation ? PUSH38_GATEWAY_CODEC_PRESERVATION :
  rescueCapacity ? PUSH38_GATEWAY_RESCUE_CAPACITY :
  probationBudget ? PUSH38_GATEWAY_PROBATION_BUDGET :
  routineProvisional ? PUSH38_GATEWAY_ROUTINE_PROVISIONAL :
  continuousHandoff ? PUSH38_GATEWAY_CONTINUOUS_HANDOFF :
  retainedFallback ? PUSH38_GATEWAY_RETAINED_FALLBACK :
  handoffProbation ? PUSH38_GATEWAY_HANDOFF_PROBATION :
  startupWindow ? PUSH38_GATEWAY_STARTUP_WINDOW :
  confirmedHandoff ? PUSH38_GATEWAY_CONFIRMED_HANDOFF :
  outputRescue ? PUSH38_GATEWAY_OUTPUT_RESCUE :
  bufferedOutput ? PUSH38_GATEWAY_BUFFERED_OUTPUT :
  idleHandoff ? PUSH38_GATEWAY_IDLE_HANDOFF :
  heartbeatLogin ? PUSH38_GATEWAY_HEARTBEAT_LOGIN :
  sessionSweep ? PUSH38_GATEWAY_SESSION_SWEEP :
  maintenanceIsolation ? PUSH38_GATEWAY_MAINTENANCE_ISOLATION :
  mediaCadence ? PUSH38_GATEWAY_MEDIA_CADENCE :
  stableHandoff ? PUSH38_GATEWAY_STABLE_HANDOFF :
  supervisorRecovery ? PUSH38_GATEWAY_SUPERVISOR_RECOVERY :
  finiteHandoff ? PUSH38_GATEWAY_FINITE_STREAM_HANDOFF : PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY;
const restrictedRoot = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted";
const bundleValue = process.argv.find(value => value.startsWith("--bundle="))?.slice(9);
if (!bundleValue) throw new Error("P38_GATEWAY_COMMON_CAUSE_HOME_QA_BUNDLE_REQUIRED");
const bundle = resolve(bundleValue);
const artifact = routineConfirmation
  ? `${restrictedRoot}/push38-gateway-prestale-rescue-4c53a317/gateway-runtime.tar.gz`
  : recoveryContinuity
  ? `${restrictedRoot}/push38-gateway-recovery-continuity-a49a37aa/gateway-runtime.tar.gz`
  : deadlineBudget
  ? `${restrictedRoot}/push38-gateway-deadline-budget-72b25159/gateway-runtime.tar.gz`
  : sweepDeadline
  ? `${restrictedRoot}/push38-gateway-deadline-sweep-29ca4057/gateway-runtime.tar.gz`
  : handoffOwnerContinuity
  ? `${restrictedRoot}/push38-gateway-owner-continuity-dcda36fc/gateway-runtime.tar.gz`
  : handoffContinuity
  ? `${restrictedRoot}/push38-gateway-handoff-continuity-1fc10896/gateway-runtime.tar.gz`
  : relayHandoff
  ? `${restrictedRoot}/push38-gateway-relay-handoff-d9497224/gateway-runtime.tar.gz`
  : handoffHardware
  ? `${restrictedRoot}/push38-gateway-handoff-hardware-5d29b3a9/gateway-runtime.tar.gz`
  : codecPreservation
  ? `${restrictedRoot}/push38-gateway-codec-preservation-22f852d2/gateway-runtime.tar.gz`
  : rescueCapacity
  ? `${restrictedRoot}/push38-gateway-rescue-capacity-cedab840/gateway-runtime.tar.gz`
  : probationBudget
  ? `${restrictedRoot}/push38-gateway-probation-budget-0028df7f/gateway-runtime.tar.gz`
  : routineProvisional
  ? `${restrictedRoot}/push38-gateway-routine-rebased-167ad231/gateway-runtime.tar.gz`
  : continuousHandoff
  ? `${restrictedRoot}/push38-gateway-continuous-handoff-4a63f881/gateway-runtime.tar.gz`
  : retainedFallback
  ? `${restrictedRoot}/push38-gateway-retained-fallback-8f380af2/gateway-runtime.tar.gz`
  : handoffProbation
  ? `${restrictedRoot}/push38-gateway-handoff-probation-06038e9a/gateway-runtime.tar.gz`
  : startupWindow
  ? `${restrictedRoot}/push38-gateway-startup-window-4a3d3e39/gateway-runtime.tar.gz`
  : confirmedHandoff
  ? `${restrictedRoot}/push38-gateway-confirmed-handoff-ab855c89/gateway-runtime.tar.gz`
  : outputRescue
  ? `${restrictedRoot}/push38-gateway-output-rescue-9658853d/gateway-runtime.tar.gz`
  : bufferedOutput
  ? `${restrictedRoot}/push38-gateway-buffered-output-fcd1ee80/gateway-runtime.tar.gz`
  : idleHandoff
  ? `${restrictedRoot}/push38-gateway-idle-handoff-d63a53bd/gateway-runtime.tar.gz`
  : heartbeatLogin
  ? `${restrictedRoot}/push38-gateway-heartbeat-login-6d515326/gateway-runtime.tar.gz`
  : sessionSweep
  ? `${restrictedRoot}/push38-gateway-session-drain-6bf33d4b/gateway-runtime.tar.gz`
  : maintenanceIsolation
  ? `${restrictedRoot}/push38-gateway-maintenance-isolation-04c58f24/gateway-runtime.tar.gz`
  : mediaCadence
  ? `${restrictedRoot}/push38-gateway-media-cadence-f41715f9/gateway-runtime.tar.gz`
  : stableHandoff
  ? `${restrictedRoot}/push38-gateway-stable-handoff-a7bd4c75/gateway-runtime.tar.gz`
  : supervisorRecovery
  ? `${restrictedRoot}/push38-gateway-supervisor-recovery-4324fa11/gateway-runtime.tar.gz`
  : finiteHandoff
  ? `${restrictedRoot}/push38-gateway-finite-handoff-e085c30f/gateway-runtime.tar.gz`
  : `${restrictedRoot}/push38-gateway-common-cause-f7d237bf/gateway-runtime.tar.gz`;
const publication = routineConfirmation
  ? `${restrictedRoot}/push38-gateway-prestale-rescue-4c53a317/r2-publication.json`
  : recoveryContinuity
  ? `${restrictedRoot}/push38-gateway-recovery-continuity-a49a37aa/r2-publication.json`
  : deadlineBudget
  ? `${restrictedRoot}/push38-gateway-deadline-budget-72b25159/r2-publication.json`
  : sweepDeadline
  ? `${restrictedRoot}/push38-gateway-deadline-sweep-29ca4057/r2-publication.json`
  : handoffOwnerContinuity
  ? `${restrictedRoot}/push38-gateway-owner-continuity-dcda36fc/r2-publication.json`
  : handoffContinuity
  ? `${restrictedRoot}/push38-gateway-handoff-continuity-1fc10896/r2-publication.json`
  : relayHandoff
  ? `${restrictedRoot}/push38-gateway-relay-handoff-d9497224/r2-publication.json`
  : handoffHardware
  ? `${restrictedRoot}/push38-gateway-handoff-hardware-5d29b3a9/r2-publication.json`
  : codecPreservation
  ? `${restrictedRoot}/push38-gateway-codec-preservation-22f852d2/r2-publication.json`
  : rescueCapacity
  ? `${restrictedRoot}/push38-gateway-rescue-capacity-cedab840/r2-publication.json`
  : probationBudget
  ? `${restrictedRoot}/push38-gateway-probation-budget-0028df7f/r2-publication.json`
  : routineProvisional
  ? `${restrictedRoot}/push38-gateway-routine-rebased-167ad231/r2-publication.json`
  : continuousHandoff
  ? `${restrictedRoot}/push38-gateway-continuous-handoff-4a63f881/r2-publication.json`
  : retainedFallback
  ? `${restrictedRoot}/push38-gateway-retained-fallback-8f380af2/r2-publication.json`
  : handoffProbation
  ? `${restrictedRoot}/push38-gateway-handoff-probation-06038e9a/r2-publication.json`
  : startupWindow
  ? `${restrictedRoot}/push38-gateway-startup-window-4a3d3e39/r2-publication.json`
  : confirmedHandoff
  ? `${restrictedRoot}/push38-gateway-confirmed-handoff-ab855c89/r2-publication.json`
  : outputRescue
  ? `${restrictedRoot}/push38-gateway-output-rescue-9658853d/r2-publication.json`
  : bufferedOutput
  ? `${restrictedRoot}/push38-gateway-buffered-output-fcd1ee80/r2-publication.json`
  : idleHandoff
  ? `${restrictedRoot}/push38-gateway-idle-handoff-d63a53bd/r2-publication.json`
  : heartbeatLogin
  ? `${restrictedRoot}/push38-gateway-heartbeat-login-6d515326/r2-publication.json`
  : sessionSweep
  ? `${restrictedRoot}/push38-gateway-session-drain-6bf33d4b/r2-publication.json`
  : maintenanceIsolation
  ? `${restrictedRoot}/push38-gateway-maintenance-isolation-04c58f24/r2-publication.json`
  : mediaCadence
  ? `${restrictedRoot}/push38-gateway-media-cadence-f41715f9/r2-publication.json`
  : stableHandoff
  ? `${restrictedRoot}/push38-gateway-stable-handoff-a7bd4c75/r2-publication.json`
  : supervisorRecovery
  ? `${restrictedRoot}/push38-gateway-supervisor-recovery-4324fa11/r2-publication.json`
  : finiteHandoff
  ? `${restrictedRoot}/push38-gateway-finite-handoff-e085c30f/r2-publication.json`
  : `${restrictedRoot}/push38-gateway-common-cause-f7d237bf/r2-publication.json`;
const bundleName = routineConfirmation ? "gateway_remediation_routine_confirmation.json"
  : recoveryContinuity ? "gateway_remediation_recovery_continuity.json"
  : deadlineBudget ? "gateway_remediation_deadline_budget.json"
  : sweepDeadline ? "gateway_remediation_sweep_deadline.json"
  : handoffOwnerContinuity ? "gateway_remediation_handoff_owner_continuity.json"
  : handoffContinuity ? "gateway_remediation_handoff_continuity.json"
  : relayHandoff ? "gateway_remediation_relay_handoff.json"
  : handoffHardware ? "gateway_remediation_handoff_hardware.json"
  : codecPreservation ? "gateway_remediation_codec_preservation.json"
  : rescueCapacity ? "gateway_remediation_rescue_capacity.json"
  : probationBudget ? "gateway_remediation_probation_budget.json"
  : routineProvisional ? "gateway_remediation_routine_provisional.json"
  : continuousHandoff ? "gateway_remediation_continuous_handoff.json"
  : retainedFallback ? "gateway_remediation_retained_fallback.json"
  : handoffProbation ? "gateway_remediation_handoff_probation.json"
  : startupWindow ? "gateway_remediation_startup_window.json"
  : confirmedHandoff ? "gateway_remediation_confirmed_handoff.json"
  : outputRescue ? "gateway_remediation_output_rescue.json"
  : bufferedOutput ? "gateway_remediation_buffered_output.json"
  : idleHandoff ? "gateway_remediation_idle_handoff.json"
  : heartbeatLogin ? "gateway_remediation_heartbeat_login.json"
  : sessionSweep ? "gateway_remediation_session_sweep.json"
  : maintenanceIsolation ? "gateway_remediation_maintenance_isolation.json"
  : mediaCadence ? "gateway_remediation_media_cadence.json"
  : stableHandoff ? "gateway_remediation_stable_handoff.json"
  : supervisorRecovery ? "gateway_remediation_supervisor_recovery.json"
  : finiteHandoff ? "gateway_remediation_finite_stream_handoff.json"
  : "gateway_remediation_common_cause_recovery.json";
const predecessorReleaseId = (routineConfirmation || recoveryContinuity || deadlineBudget || sweepDeadline || handoffOwnerContinuity) ? item.supersedesReleaseId :
  handoffContinuity ? item.rolloutPredecessorReleaseId :
  (finiteHandoff || supervisorRecovery || stableHandoff || mediaCadence || maintenanceIsolation || sessionSweep || heartbeatLogin || idleHandoff || bufferedOutput || outputRescue || confirmedHandoff || startupWindow || handoffProbation || retainedFallback || continuousHandoff || routineProvisional || probationBudget || rescueCapacity || codecPreservation || handoffHardware || relayHandoff)
  ? item.supersedesReleaseId : item.rollbackReleaseId;
const accountId = "693f824a750afcc264fe6ee58c8a86ab";
const origin = `https://${accountId}.r2.cloudflarestorage.com`;
for (const path of [bundle, artifact, publication]) {
  const scoped = relative(restrictedRoot, path);
  if (!scoped || scoped === ".." || scoped.startsWith(`..${sep}`) || isAbsolute(scoped) ||
    !existsSync(path) || lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() ||
    (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_GATEWAY_COMMON_CAUSE_HOME_QA_INPUT_SCOPE_INVALID");
}
const hash = path => new Promise((accept, reject) => {
  const stream = createReadStream(path), digest = createHash("sha256");
  stream.on("data", chunk => digest.update(chunk)); stream.on("error", reject);
  stream.on("end", () => accept(digest.digest("hex")));
});
const document = JSON.parse(execFileSync("unzip", ["-p", bundle, bundleName],
  { encoding: "utf8", timeout: 15_000, maxBuffer: 8192 }));
const r2 = JSON.parse(readFileSync(publication, "utf8"));
const keys = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const expectedObjectKey = `home-qa/${item.releaseId}/${item.digest}.tar.gz`;
if (!verifyEdgeUpdateManifest(document, keys).ok || document.release_id !== item.releaseId ||
  document.version !== item.version || document.build_sha !== item.buildSha ||
  document.artifact_sha256 !== item.digest || document.artifact_size !== item.size ||
  document.signing_key_id !== "observer-kms-release-v1" || document.profile !== item.profile ||
  document.channel !== "HOME_QA" || document.rollout?.stage !== "INTERNAL_QA" ||
  document.rollout?.cohort_percent !== 0 ||
  JSON.stringify(document.rollout?.explicit_device_ids) !== JSON.stringify([item.deviceId]) ||
  document.compatibility?.minimum_current_version !== item.rollbackVersion ||
  document.compatibility?.maximum_current_version !== item.rollbackVersion ||
  document.compatibility?.security_floor_version !== item.rollbackVersion ||
  assertEdgeReleaseObjectUrl(document, origin) !== expectedObjectKey ||
  statSync(artifact).size !== item.size || await hash(artifact) !== item.digest ||
  r2.release_id !== item.releaseId || r2.object_key !== expectedObjectKey ||
  r2.artifact_sha256 !== item.digest || r2.bytes !== item.size || r2.round_trip !== "PASS" ||
  r2.anonymous_access_denied !== true || r2.runtime_activation !== false)
  throw new Error("P38_GATEWAY_COMMON_CAUSE_HOME_QA_RELEASE_VERIFICATION_FAILED");
if (!apply) {
  console.log(JSON.stringify({ status: "VERIFIED_NOT_REGISTERED", release_id: item.releaseId,
    signer: document.signing_key_id, exact_device: true, cohort_percent: 0,
    r2_round_trip: "PASS", live_trust: "PASS", runtime_writes: 0 }));
  process.exit(0);
}
const context = "colima-push38t", container = "supabase_db_gan-batuach-push38t";
const docker = args => execFileSync("docker", ["--context", context, ...args],
  { encoding: "utf8", timeout: 45_000, stdio: ["ignore", "pipe", "pipe"] });
const labels = JSON.parse(docker(["inspect", "--format", "{{json .Config.Labels}}", container]));
if (labels["com.supabase.cli.project"] !== "gan-batuach-push38t" ||
  docker(["network", "inspect", "push38t-loopback", "--format",
    "{{index .Options \"com.docker.network.bridge.host_binding_ipv4\"}}"]).trim() !== "127.0.0.1")
  throw new Error("P38_GATEWAY_COMMON_CAUSE_HOME_QA_DATABASE_NOT_ISOLATED");
const payload = Buffer.from(JSON.stringify(document), "utf8").toString("hex");
const sql = `begin;
do $$ begin
  if (select count(*) from public.video_gateway_device_enrollments) <> 2 or
     not exists(select 1 from public.video_gateway_device_enrollments where gateway_id='${item.deviceId}'
       and deployment_profile='PHYSICAL_GATEWAY' and lifecycle_state='ACTIVE'
       and identity_scheme='ED25519_V1' and metadata->>'home_qa_phase'='MANAGED_IDENTITY_VERIFIED') or
     not exists(select 1 from public.observer_edge_releases where release_id='${item.rollbackReleaseId}'
       and channel='HOME_QA')
  then raise exception 'P38_GATEWAY_COMMON_CAUSE_HOME_QA_PREREQUISITE_MISSING'; end if;
end $$;
insert into public.observer_edge_releases
  (release_id,version,build_sha,channel,platform,architecture,deployment_profile,
   signed_manifest,artifact_sha256,signing_key_id,release_state)
select x.release_id,x.version,x.build_sha,x.channel,x.platform,x.architecture,x.profile,
  convert_from(decode('${payload}','hex'),'UTF8')::jsonb,x.artifact_sha256,x.signing_key_id,'PUBLISHED'
from jsonb_to_record(convert_from(decode('${payload}','hex'),'UTF8')::jsonb)
  as x(release_id text,version text,build_sha text,channel text,platform text,architecture text,
    profile text,artifact_sha256 text,signing_key_id text)
on conflict (release_id) do nothing;
do $$ begin
  if not exists(select 1 from public.observer_edge_releases where release_id='${item.releaseId}'
    and signed_manifest=convert_from(decode('${payload}','hex'),'UTF8')::jsonb
    and artifact_sha256='${item.digest}' and release_state='PUBLISHED')
  then raise exception 'P38_GATEWAY_COMMON_CAUSE_HOME_QA_RELEASE_CONFLICT'; end if;
end $$;
insert into public.observer_edge_rollouts (release_id,stage,status,cohort_percent,target_filters)
select id,'INTERNAL_QA','DRAFT',0,jsonb_build_object('explicit_device_ids',jsonb_build_array('${item.deviceId}'))
from public.observer_edge_releases r where r.release_id='${item.releaseId}'
and not exists(select 1 from public.observer_edge_rollouts existing where existing.release_id=r.id);
update public.observer_edge_rollouts set status='PAUSED',updated_at=now()
where release_id=(select id from public.observer_edge_releases where release_id='${predecessorReleaseId}')
  and status in ('DRAFT','ACTIVE');
do $$ begin
  if (select count(*) from public.observer_edge_releases where release_id='${item.releaseId}') <> 1 or
     not exists(select 1 from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
       where r.release_id='${item.releaseId}' and o.status='DRAFT' and o.cohort_percent=0
       and o.target_filters->'explicit_device_ids'=jsonb_build_array('${item.deviceId}')) or
     exists(select 1 from public.observer_edge_rollouts where cohort_percent<>0)
  then raise exception 'P38_GATEWAY_COMMON_CAUSE_HOME_QA_RECONCILIATION_FAILED'; end if;
end $$;
commit;`;
execFileSync("docker", ["--context", context, "exec", "-i", container, "psql", "-X", "-q",
  "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
{ input: sql, encoding: "utf8", timeout: 45_000, stdio: ["pipe", "pipe", "pipe"] });
console.log(JSON.stringify({ status: routineConfirmation ? "GATEWAY_ROUTINE_CONFIRMATION_REGISTERED_DRAFT" :
  recoveryContinuity ? "GATEWAY_RECOVERY_CONTINUITY_REGISTERED_DRAFT" :
  deadlineBudget ? "GATEWAY_DEADLINE_BUDGET_REGISTERED_DRAFT" :
  sweepDeadline ? "GATEWAY_SWEEP_DEADLINE_REGISTERED_DRAFT" :
  handoffOwnerContinuity ? "GATEWAY_HANDOFF_OWNER_CONTINUITY_REGISTERED_DRAFT" :
  handoffContinuity ? "GATEWAY_HANDOFF_CONTINUITY_REGISTERED_DRAFT" :
  relayHandoff ? "GATEWAY_RELAY_HANDOFF_REGISTERED_DRAFT" :
  handoffHardware ? "GATEWAY_HANDOFF_HARDWARE_REGISTERED_DRAFT" :
  codecPreservation ? "GATEWAY_CODEC_PRESERVATION_REGISTERED_DRAFT" :
  rescueCapacity ? "GATEWAY_RESCUE_CAPACITY_REGISTERED_DRAFT" :
  probationBudget ? "GATEWAY_PROBATION_BUDGET_REGISTERED_DRAFT" :
  routineProvisional ? "GATEWAY_ROUTINE_PROVISIONAL_REGISTERED_DRAFT" :
  continuousHandoff ? "GATEWAY_CONTINUOUS_HANDOFF_REGISTERED_DRAFT" :
  retainedFallback ? "GATEWAY_RETAINED_FALLBACK_REGISTERED_DRAFT" :
  handoffProbation ? "GATEWAY_HANDOFF_PROBATION_REGISTERED_DRAFT" :
  startupWindow ? "GATEWAY_STARTUP_WINDOW_REGISTERED_DRAFT" :
  confirmedHandoff ? "GATEWAY_CONFIRMED_HANDOFF_REGISTERED_DRAFT" :
  outputRescue ? "GATEWAY_OUTPUT_RESCUE_REGISTERED_DRAFT" :
  bufferedOutput ? "GATEWAY_BUFFERED_OUTPUT_REGISTERED_DRAFT" :
  idleHandoff ? "GATEWAY_IDLE_HANDOFF_REGISTERED_DRAFT" :
  heartbeatLogin ? "GATEWAY_HEARTBEAT_LOGIN_REGISTERED_DRAFT" :
  sessionSweep ? "GATEWAY_SESSION_SWEEP_REGISTERED_DRAFT" :
  maintenanceIsolation ? "GATEWAY_MAINTENANCE_ISOLATION_REGISTERED_DRAFT" :
  mediaCadence ? "GATEWAY_MEDIA_CADENCE_REGISTERED_DRAFT" :
  stableHandoff ? "GATEWAY_STABLE_HANDOFF_REGISTERED_DRAFT" :
  "GATEWAY_COMMON_CAUSE_RECOVERY_REGISTERED_DRAFT",
  release_id: item.releaseId, predecessor_release_id: predecessorReleaseId,
  predecessor_release: "PAUSED", exact_device: true,
  broad_cohort: "DISABLED", r2_round_trip: "PASS", live_trust: "PASS",
  production_writes: 0, runtime_writes: 0 }));
