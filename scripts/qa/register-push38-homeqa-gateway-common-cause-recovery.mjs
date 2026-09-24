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

const apply = process.argv.includes("--apply");
const finiteHandoff = process.argv.includes("--finite-stream-handoff");
const supervisorRecovery = process.argv.includes("--supervisor-recovery");
if (finiteHandoff && supervisorRecovery) throw new Error("P38_GATEWAY_COMMON_CAUSE_HOME_QA_MODE_INVALID");
const item = supervisorRecovery ? PUSH38_GATEWAY_SUPERVISOR_RECOVERY :
  finiteHandoff ? PUSH38_GATEWAY_FINITE_STREAM_HANDOFF : PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY;
const restrictedRoot = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted";
const bundleValue = process.argv.find(value => value.startsWith("--bundle="))?.slice(9);
if (!bundleValue) throw new Error("P38_GATEWAY_COMMON_CAUSE_HOME_QA_BUNDLE_REQUIRED");
const bundle = resolve(bundleValue);
const artifact = supervisorRecovery
  ? `${restrictedRoot}/push38-gateway-supervisor-recovery-4324fa11/gateway-runtime.tar.gz`
  : finiteHandoff
  ? `${restrictedRoot}/push38-gateway-finite-handoff-e085c30f/gateway-runtime.tar.gz`
  : `${restrictedRoot}/push38-gateway-common-cause-f7d237bf/gateway-runtime.tar.gz`;
const publication = supervisorRecovery
  ? `${restrictedRoot}/push38-gateway-supervisor-recovery-4324fa11/r2-publication.json`
  : finiteHandoff
  ? `${restrictedRoot}/push38-gateway-finite-handoff-e085c30f/r2-publication.json`
  : `${restrictedRoot}/push38-gateway-common-cause-f7d237bf/r2-publication.json`;
const bundleName = supervisorRecovery ? "gateway_remediation_supervisor_recovery.json"
  : finiteHandoff ? "gateway_remediation_finite_stream_handoff.json"
  : "gateway_remediation_common_cause_recovery.json";
const expectedBefore = supervisorRecovery ? 16 : finiteHandoff ? 12 : 11;
const expectedAfter = expectedBefore + 1;
const predecessorReleaseId = (finiteHandoff || supervisorRecovery) ? item.supersedesReleaseId : item.rollbackReleaseId;
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
       and channel='HOME_QA') or
     (select count(*) from public.observer_edge_releases where channel='HOME_QA') <> ${expectedBefore}
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
  if (select count(*) from public.observer_edge_releases where channel='HOME_QA') <> ${expectedAfter} or
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
console.log(JSON.stringify({ status: "GATEWAY_COMMON_CAUSE_RECOVERY_REGISTERED_DRAFT",
  release_id: item.releaseId, predecessor_release_id: predecessorReleaseId,
  predecessor_release: "PAUSED", exact_device: true,
  broad_cohort: "DISABLED", r2_round_trip: "PASS", live_trust: "PASS",
  production_writes: 0, runtime_writes: 0 }));
