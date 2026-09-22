// Registers the immutable, AWS-signed Connector PID-ownership correction in
// the isolated PUSH 38 qualification database. The superseded remediation is
// retained as history but cannot become active.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, statSync } from "node:fs";
import { resolve } from "node:path";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl } from "../../services/video-gateway/edge-release-object.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";

const apply = process.argv.includes("--apply");
const bundle = resolve(process.argv.find(value => value.startsWith("--bundle="))?.slice(9) ||
  "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-connector-pidfix-35704990843.zip");
const artifact = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-connector-remediation-c3408497/connector-remediation.tar.gz";
const releaseId = "qa-p38-health-connector-pidfix-1b9e9499ffa7";
const supersededReleaseId = "qa-p38-health-connector-1b076f596574";
const deviceId = "db267b52-6282-4944-bcee-5d4857698fb0";
const accountId = "693f824a750afcc264fe6ee58c8a86ab";
const origin = `https://${accountId}.r2.cloudflarestorage.com`;
const hash = path => new Promise((accept, reject) => {
  const stream = createReadStream(path), digest = createHash("sha256");
  stream.on("data", chunk => digest.update(chunk)); stream.on("error", reject);
  stream.on("end", () => accept(digest.digest("hex")));
});
const document = JSON.parse(execFileSync("unzip", ["-p", bundle, "connector_remediation_pidfix.json"],
  { encoding: "utf8", timeout: 15_000, maxBuffer: 8192 }));
const keys = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
if (!verifyEdgeUpdateManifest(document, keys).ok || document.release_id !== releaseId ||
  document.signing_key_id !== "observer-kms-release-v1" || document.profile !== "SOFTWARE_CONNECTOR" ||
  document.channel !== "HOME_QA" || document.rollout?.stage !== "INTERNAL_QA" ||
  document.rollout?.cohort_percent !== 0 ||
  JSON.stringify(document.rollout?.explicit_device_ids) !== JSON.stringify([deviceId]) ||
  assertEdgeReleaseObjectUrl(document, origin) !== `home-qa/${releaseId}/${document.artifact_sha256}.tar.gz` ||
  statSync(artifact).size !== document.artifact_size || await hash(artifact) !== document.artifact_sha256)
  throw new Error("P38_HOME_QA_PIDFIX_RELEASE_VERIFICATION_FAILED");
if (!apply) {
  console.log(JSON.stringify({ status: "VERIFIED_NOT_REGISTERED", release_id: releaseId,
    signer: document.signing_key_id, exact_device: true, cohort_percent: 0, runtime_writes: 0 }));
  process.exit(0);
}
const context = "colima-push38t", container = "supabase_db_gan-batuach-push38t";
const docker = args => execFileSync("docker", ["--context", context, ...args],
  { encoding: "utf8", timeout: 45_000, stdio: ["ignore", "pipe", "pipe"] });
const labels = JSON.parse(docker(["inspect", "--format", "{{json .Config.Labels}}", container]));
if (labels["com.supabase.cli.project"] !== "gan-batuach-push38t" ||
  docker(["network", "inspect", "push38t-loopback", "--format",
    "{{index .Options \"com.docker.network.bridge.host_binding_ipv4\"}}"]).trim() !== "127.0.0.1")
  throw new Error("P38_HOME_QA_PIDFIX_DATABASE_NOT_ISOLATED");
const payload = Buffer.from(JSON.stringify(document), "utf8").toString("hex");
const sql = `begin;
do $$ begin
  if (select count(*) from public.video_gateway_device_enrollments) <> 2 or
     not exists(select 1 from public.video_gateway_device_enrollments where gateway_id='${deviceId}'
       and deployment_profile='SOFTWARE_CONNECTOR' and lifecycle_state='ACTIVE') or
     not exists(select 1 from public.observer_edge_releases where release_id='${supersededReleaseId}'
       and channel='HOME_QA')
  then raise exception 'P38_HOME_QA_PIDFIX_PREREQUISITE_MISSING'; end if;
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
  if not exists(select 1 from public.observer_edge_releases where release_id='${releaseId}'
    and signed_manifest=convert_from(decode('${payload}','hex'),'UTF8')::jsonb
    and artifact_sha256='${document.artifact_sha256}' and release_state='PUBLISHED')
  then raise exception 'P38_HOME_QA_PIDFIX_RELEASE_CONFLICT'; end if;
end $$;
insert into public.observer_edge_rollouts (release_id,stage,status,cohort_percent,target_filters)
select id,'INTERNAL_QA','DRAFT',0,jsonb_build_object('explicit_device_ids',jsonb_build_array('${deviceId}'))
from public.observer_edge_releases r where r.release_id='${releaseId}'
and not exists(select 1 from public.observer_edge_rollouts existing where existing.release_id=r.id);
update public.observer_edge_rollouts set status='PAUSED'
where release_id=(select id from public.observer_edge_releases where release_id='${supersededReleaseId}')
  and status in ('DRAFT','ACTIVE');
do $$ begin
  if (select count(*) from public.observer_edge_releases where channel='HOME_QA') <> 4 or
     not exists(select 1 from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
       where r.release_id='${releaseId}' and o.status='DRAFT' and o.cohort_percent=0
       and o.target_filters->'explicit_device_ids'=jsonb_build_array('${deviceId}')) or
     exists(select 1 from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
       where r.release_id='${supersededReleaseId}' and o.status<>'PAUSED') or
     exists(select 1 from public.observer_edge_rollouts where cohort_percent<>0)
  then raise exception 'P38_HOME_QA_PIDFIX_RECONCILIATION_FAILED'; end if;
end $$;
commit;`;
execFileSync("docker", ["--context", context, "exec", "-i", container, "psql", "-X", "-q",
  "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
{ input: sql, encoding: "utf8", timeout: 45_000, stdio: ["pipe", "pipe", "pipe"] });
console.log(JSON.stringify({ status: "PIDFIX_RELEASE_REGISTERED_DRAFT", release_id: releaseId,
  superseded_release: "PAUSED", exact_device: true, broad_cohort: "DISABLED", production_writes: 0 }));
