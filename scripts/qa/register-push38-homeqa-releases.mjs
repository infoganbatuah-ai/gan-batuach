// Publishes immutable, already-signed metadata to the isolated PUSH 38 QA DB.
// Rollouts remain DRAFT until the two independently verified legacy bindings exist.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, statSync } from "node:fs";
import { resolve } from "node:path";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl } from "../../services/video-gateway/edge-release-object.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";

const bundle = process.argv.find(value => value.startsWith("--bundle="))?.slice(9);
const apply = process.argv.includes("--apply");
if (!bundle) throw new Error("P38_HOME_QA_SIGNED_BUNDLE_REQUIRED");
const accountId = "693f824a750afcc264fe6ee58c8a86ab";
const origin = `https://${accountId}.r2.cloudflarestorage.com`;
const expected = [
  { role: "connector_transition", release: "qa-connector-legacy-transition-v2-6e7988808b05",
    device: "db267b52-6282-4944-bcee-5d4857698fb0", profile: "SOFTWARE_CONNECTOR",
    path: "/Volumes/DIGITAL_OBSERVER/QA-Releases/PUSH-38L/qa-connector-legacy-transition-v2-6e7988808b05/connector-legacy-resigned.tar.gz" },
  { role: "connector_remediation", release: "qa-p38-health-connector-1b076f596574",
    device: "db267b52-6282-4944-bcee-5d4857698fb0", profile: "SOFTWARE_CONNECTOR",
    path: "/private/tmp/observer-p38-qa-fix.HPnHz4/connector/connector-remediation.tar.gz" },
  { role: "gateway_remediation", release: "qa-p38-health-gateway-6c9d08327ec6",
    device: "62df97e2-3c0b-427f-9108-bde029bc10e7", profile: "PHYSICAL_GATEWAY",
    path: "/private/tmp/observer-p38-qa-fix.HPnHz4/gateway/gateway-runtime.tar.gz" }
];
const hash = path => new Promise((accept, reject) => {
  const stream = createReadStream(path), digest = createHash("sha256");
  stream.on("data", chunk => digest.update(chunk));
  stream.on("error", reject);
  stream.on("end", () => accept(digest.digest("hex")));
});
const keys = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const rows = [];
for (const item of expected) {
  const document = JSON.parse(execFileSync("unzip", ["-p", resolve(bundle), `${item.role}.json`],
    { encoding: "utf8", timeout: 15_000, maxBuffer: 8192 }));
  const verified = verifyEdgeUpdateManifest(document, keys);
  if (!verified.ok || document.signing_key_id !== "observer-kms-release-v1" ||
    document.release_id !== item.release || document.profile !== item.profile ||
    document.channel !== "HOME_QA" || document.rollout.stage !== "INTERNAL_QA" ||
    document.rollout.cohort_percent !== 0 ||
    JSON.stringify(document.rollout.explicit_device_ids) !== JSON.stringify([item.device]) ||
    assertEdgeReleaseObjectUrl(document, origin) !== `home-qa/${item.release}/${document.artifact_sha256}.tar.gz` ||
    statSync(item.path).size !== document.artifact_size || await hash(item.path) !== document.artifact_sha256)
    throw new Error(`P38_HOME_QA_RELEASE_VERIFICATION_FAILED:${item.role}`);
  rows.push(document);
}
if (!apply) {
  console.log(JSON.stringify({ status: "VERIFIED_NOT_REGISTERED", releases: rows.map(row => row.release_id),
    trusted_aws_signer: true, exact_device_targeting: true, artifact_hashes: true, runtime_writes: 0 }));
  process.exit(0);
}
const project = "gan-batuach-push38t", context = "colima-push38t";
const container = `supabase_db_${project}`;
const docker = args => execFileSync("docker", ["--context", context, ...args],
  { encoding: "utf8", timeout: 45_000, stdio: ["ignore", "pipe", "pipe"] });
const labels = JSON.parse(docker(["inspect", "--format", "{{json .Config.Labels}}", container]));
if (labels["com.supabase.cli.project"] !== project) throw new Error("P38_HOME_QA_WRONG_DATABASE");
const network = docker(["network", "inspect", "push38t-loopback", "--format",
  "{{index .Options \"com.docker.network.bridge.host_binding_ipv4\"}}"]).trim();
if (network !== "127.0.0.1") throw new Error("P38_HOME_QA_DATABASE_NOT_LOOPBACK");
const payload = Buffer.from(JSON.stringify(rows), "utf8").toString("hex");
const sql = `begin;
create temp table p38_signed on commit drop as
  select * from jsonb_to_recordset(convert_from(decode('${payload}','hex'),'UTF8')::jsonb)
  as x(release_id text,version text,build_sha text,channel text,platform text,architecture text,
    profile text,artifact_sha256 text,signing_key_id text,rollout jsonb);
do $$ begin
  if (select count(*) from p38_signed) <> 3 or
     (select count(*) from public.video_gateway_device_enrollments) <> 0 or
     (select count(*) from public.observer_edge_rollouts where status='ACTIVE') <> 0
  then raise exception 'P38_HOME_QA_UNEXPECTED_EXISTING_STATE'; end if;
end $$;
insert into public.observer_edge_releases
  (release_id,version,build_sha,channel,platform,architecture,deployment_profile,
   signed_manifest,artifact_sha256,signing_key_id,release_state)
select x.release_id,x.version,x.build_sha,x.channel,x.platform,x.architecture,x.profile,
  source.document,x.artifact_sha256,x.signing_key_id,'PUBLISHED'
from jsonb_array_elements(convert_from(decode('${payload}','hex'),'UTF8')::jsonb) source(document)
join p38_signed x on x.release_id=source.document->>'release_id'
on conflict (release_id) do nothing;
do $$ begin
  if exists (select 1 from jsonb_array_elements(convert_from(decode('${payload}','hex'),'UTF8')::jsonb) source(document)
    left join public.observer_edge_releases r on r.release_id=source.document->>'release_id'
    where r.signed_manifest is distinct from source.document or r.release_state <> 'PUBLISHED')
  then raise exception 'P38_HOME_QA_PUBLISHED_RELEASE_CONFLICT'; end if;
end $$;
insert into public.observer_edge_rollouts (release_id,stage,status,cohort_percent,target_filters)
select r.id,'INTERNAL_QA','DRAFT',0,jsonb_build_object('explicit_device_ids',x.rollout->'explicit_device_ids')
from p38_signed x join public.observer_edge_releases r on r.release_id=x.release_id
where not exists (select 1 from public.observer_edge_rollouts existing where existing.release_id=r.id);
do $$ begin
  if (select count(*) from public.observer_edge_releases where channel='HOME_QA') <> 3 or
     (select count(*) from public.observer_edge_rollouts where status='DRAFT' and cohort_percent=0) <> 3 or
     (select count(*) from public.observer_edge_rollouts where status='ACTIVE') <> 0
  then raise exception 'P38_HOME_QA_RELEASE_RECONCILIATION_FAILED'; end if;
end $$;
commit;`;
execFileSync("docker", ["--context", context, "exec", "-i", container, "psql", "-X", "-q",
  "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
{ input: sql, encoding: "utf8", timeout: 45_000, stdio: ["pipe", "pipe", "pipe"] });
console.log(JSON.stringify({ status: "SIGNED_RELEASES_REGISTERED_DRAFT", releases: rows.length,
  active_rollouts: 0, runtime_writes: 0, production_access: false }));
