// Register the immutable AWS-signed Connector RTSP-session remediation in the
// isolated PUSH 38 qualification database. Registration is exact-device and
// DRAFT-only; activation remains a separate pinned operation.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, lstatSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl } from "../../services/video-gateway/edge-release-object.mjs";
import { loadPinnedEdgeReleaseKeys,
  PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY
} from "../../services/video-gateway/push38-home-qa-connector-rtsp-session.mjs";
import { PUSH38_CONNECTOR_HOST_CONTINUITY_RECOVERY
} from "../../services/video-gateway/push38-home-qa-connector-host-continuity.mjs";
import { PUSH38_CONNECTOR_DEVICE_SESSION_RECOVERY
} from "../../services/video-gateway/push38-home-qa-connector-device-session.mjs";
import { PUSH38_CONNECTOR_LIVENESS_CONTINUITY
} from "../../services/video-gateway/push38-home-qa-connector-liveness-continuity.mjs";
import { PUSH38_CONNECTOR_RELAY_BACKOFF_RECOVERY
} from "../../services/video-gateway/push38-home-qa-connector-relay-backoff.mjs";

const apply = process.argv.includes("--apply");
const hostContinuity = process.argv.includes("--host-continuity");
const deviceSession = process.argv.includes("--device-session");
const livenessContinuity = process.argv.includes("--liveness-continuity");
const relayBackoff = process.argv.includes("--relay-backoff");
if ([hostContinuity, deviceSession, livenessContinuity, relayBackoff].filter(Boolean).length > 1)
  throw new Error("P38_HOME_QA_RTSP_SESSION_MODE_INVALID");
const item = relayBackoff ? PUSH38_CONNECTOR_RELAY_BACKOFF_RECOVERY :
  livenessContinuity ? PUSH38_CONNECTOR_LIVENESS_CONTINUITY :
  deviceSession ? PUSH38_CONNECTOR_DEVICE_SESSION_RECOVERY :
  hostContinuity ? PUSH38_CONNECTOR_HOST_CONTINUITY_RECOVERY :
  PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY;
const restrictedRoot = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted";
const bundleValue = process.argv.find(value => value.startsWith("--bundle="))?.slice(9);
if (!bundleValue) throw new Error("P38_HOME_QA_RTSP_SESSION_BUNDLE_REQUIRED");
const bundle = resolve(bundleValue);
const artifact = relayBackoff
  ? `${restrictedRoot}/push38-connector-relay-backoff-4cc211b8/connector-remediation.tar.gz`
  : livenessContinuity
  ? `${restrictedRoot}/push38-connector-liveness-continuity-2840a593/connector-remediation.tar.gz`
  : deviceSession
  ? `${restrictedRoot}/push38-connector-device-session-005319bf/connector-remediation.tar.gz`
  : hostContinuity
  ? `${restrictedRoot}/push38-connector-host-continuity-e0f07860/connector-remediation.tar.gz`
  : `${restrictedRoot}/push38-connector-remediation-38671545/connector-remediation.tar.gz`;
const publication = relayBackoff
  ? `${restrictedRoot}/push38-connector-relay-backoff-4cc211b8/r2-publication.json`
  : livenessContinuity
  ? `${restrictedRoot}/push38-connector-liveness-continuity-2840a593/r2-publication.json`
  : deviceSession
  ? `${restrictedRoot}/push38-connector-device-session-005319bf/r2-publication.json`
  : hostContinuity
  ? `${restrictedRoot}/push38-connector-host-continuity-e0f07860/r2-publication.json`
  : `${restrictedRoot}/push38-connector-remediation-38671545/r2-publication.json`;
const predecessorReleaseId = (hostContinuity || deviceSession || livenessContinuity || relayBackoff) ? item.supersedesReleaseId : item.rollbackReleaseId;
const bundleName = relayBackoff ? "connector_remediation_relay_backoff.json" :
  livenessContinuity ? "connector_remediation_liveness_continuity.json" :
  deviceSession ? "connector_remediation_device_session.json" :
  hostContinuity ? "connector_remediation_host_continuity.json" :
  "connector_remediation_rtsp_session.json";
const expectedBefore = relayBackoff ? 17 : livenessContinuity ? 15 : deviceSession ? 14 : hostContinuity ? 13 : 9;
const expectedAfter = relayBackoff ? 18 : livenessContinuity ? 16 : deviceSession ? 15 : hostContinuity ? 14 : 10;
const accountId = "693f824a750afcc264fe6ee58c8a86ab";
const origin = `https://${accountId}.r2.cloudflarestorage.com`;
for (const path of [bundle, artifact, publication]) {
  const scoped = relative(restrictedRoot, path);
  if (!scoped || scoped === ".." || scoped.startsWith(`..${sep}`) || isAbsolute(scoped) ||
    !existsSync(path) || lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() ||
    (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_HOME_QA_RTSP_SESSION_INPUT_SCOPE_INVALID");
}
const hash = path => new Promise((accept, reject) => {
  const stream = createReadStream(path), digest = createHash("sha256");
  stream.on("data", chunk => digest.update(chunk)); stream.on("error", reject);
  stream.on("end", () => accept(digest.digest("hex")));
});
const document = JSON.parse(execFileSync("unzip", ["-p", bundle, bundleName],
  { encoding: "utf8", timeout: 15_000, maxBuffer: 8192 }));
const r2 = JSON.parse(readFileSync(publication, "utf8"));
const keys = loadPinnedEdgeReleaseKeys({
  registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
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
  throw new Error("P38_HOME_QA_RTSP_SESSION_RELEASE_VERIFICATION_FAILED");
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
  throw new Error("P38_HOME_QA_RTSP_SESSION_DATABASE_NOT_ISOLATED");
const payload = Buffer.from(JSON.stringify(document), "utf8").toString("hex");
const sql = `begin;
do $$ begin
  if (select count(*) from public.video_gateway_device_enrollments) <> 2 or
     not exists(select 1 from public.video_gateway_device_enrollments where gateway_id='${item.deviceId}'
       and deployment_profile='SOFTWARE_CONNECTOR' and lifecycle_state='ACTIVE'
       and identity_scheme='ED25519_V1' and metadata->>'home_qa_phase'='MANAGED_IDENTITY_VERIFIED') or
     not exists(select 1 from public.observer_edge_releases where release_id='${predecessorReleaseId}'
       and channel='HOME_QA') or
     (select count(*) from public.observer_edge_releases where channel='HOME_QA') <> ${expectedBefore}
  then raise exception 'P38_HOME_QA_RTSP_SESSION_PREREQUISITE_MISSING'; end if;
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
  then raise exception 'P38_HOME_QA_RTSP_SESSION_RELEASE_CONFLICT'; end if;
end $$;
insert into public.observer_edge_rollouts (release_id,stage,status,cohort_percent,target_filters)
select id,'INTERNAL_QA','DRAFT',0,jsonb_build_object('explicit_device_ids',jsonb_build_array('${item.deviceId}'))
from public.observer_edge_releases r where r.release_id='${item.releaseId}'
and not exists(select 1 from public.observer_edge_rollouts existing where existing.release_id=r.id);
update public.observer_edge_rollouts set status='PAUSED',updated_at=now()
where release_id=(select id from public.observer_edge_releases where release_id='${predecessorReleaseId}')
  and status in ('DRAFT','ACTIVE');
do $$ begin
  if (select count(*) from public.observer_edge_releases where channel='HOME_QA') <> ${expectedAfter} or
     not exists(select 1 from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
       where r.release_id='${item.releaseId}' and o.status='DRAFT' and o.cohort_percent=0
       and o.target_filters->'explicit_device_ids'=jsonb_build_array('${item.deviceId}')) or
     exists(select 1 from public.observer_edge_rollouts where cohort_percent<>0)
  then raise exception 'P38_HOME_QA_RTSP_SESSION_RECONCILIATION_FAILED'; end if;
end $$;
commit;`;
execFileSync("docker", ["--context", context, "exec", "-i", container, "psql", "-X", "-q",
  "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
{ input: sql, encoding: "utf8", timeout: 45_000, stdio: ["pipe", "pipe", "pipe"] });
console.log(JSON.stringify({ status: "RTSP_SESSION_RECOVERY_REGISTERED_DRAFT",
  release_id: item.releaseId, predecessor_release: "PAUSED", exact_device: true,
  broad_cohort: "DISABLED", r2_round_trip: "PASS", live_trust: "PASS",
  production_writes: 0, runtime_writes: 0 }));
