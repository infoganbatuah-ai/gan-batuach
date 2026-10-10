// Register the paired exact-device managed-auth continuity releases in the
// isolated PUSH 38 qualification database. Registration is DRAFT-only.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, lstatSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl } from "../../services/video-gateway/edge-release-object.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from
  "../../services/video-gateway/edge-release-trust.mjs";
import { PUSH38_MANAGED_AUTH_CONTINUITY } from
  "../../services/video-gateway/push38-home-qa-managed-auth-continuity.mjs";

const restrictedRoot = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted";
const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const apply = process.argv.includes("--apply");
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const signedDir = resolve(option("signed-dir") || "");
const requestedComponent = option("component");
const components = requestedComponent ? [requestedComponent] : ["connector", "gateway"];
if (components.some(component => !PUSH38_MANAGED_AUTH_CONTINUITY[component]))
  throw new Error("P38_MANAGED_AUTH_REGISTRATION_COMPONENT_INVALID");
const allPaths = {
  connector: { manifest: join(signedDir, "connector_managed_auth_continuity.json"),
    artifact: resolve(option("connector-artifact") || ""),
    publication: resolve(option("connector-publication") || "") },
  gateway: { manifest: join(signedDir, "gateway_managed_auth_continuity.json"),
    artifact: resolve(option("gateway-artifact") || ""),
    publication: resolve(option("gateway-publication") || "") }
};
const paths = Object.fromEntries(components.map(component => [component, allPaths[component]]));

for (const path of [signedDir, ...Object.values(paths).flatMap(value => Object.values(value))]) {
  const scoped = relative(restrictedRoot, path);
  if (!scoped || scoped === ".." || scoped.startsWith(`..${sep}`) || isAbsolute(scoped) ||
    !existsSync(path) || lstatSync(path).isSymbolicLink() ||
    (path === signedDir ? !lstatSync(path).isDirectory() : !lstatSync(path).isFile()))
    throw new Error("P38_MANAGED_AUTH_REGISTRATION_INPUT_SCOPE_INVALID");
}

const hash = path => new Promise((accept, reject) => {
  const stream = createReadStream(path), digest = createHash("sha256");
  stream.on("data", chunk => digest.update(chunk)); stream.on("error", reject);
  stream.on("end", () => accept(digest.digest("hex")));
});
const keys = loadPinnedEdgeReleaseKeys({
  registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const verified = {};
for (const component of components) {
  const item = PUSH38_MANAGED_AUTH_CONTINUITY[component];
  const input = paths[component];
  const manifest = JSON.parse(readFileSync(input.manifest, "utf8"));
  const publication = JSON.parse(readFileSync(input.publication, "utf8"));
  const expectedObject = `home-qa/${item.releaseId}/${item.digest}.tar.gz`;
  if (!verifyEdgeUpdateManifest(manifest, keys).ok || manifest.release_id !== item.releaseId ||
    manifest.version !== item.version || manifest.build_sha !== item.buildSha ||
    manifest.artifact_sha256 !== item.digest || manifest.artifact_size !== item.size ||
    manifest.signing_key_id !== "observer-kms-release-v1" || manifest.profile !== item.profile ||
    manifest.channel !== "HOME_QA" || manifest.rollout?.stage !== "INTERNAL_QA" ||
    manifest.rollout?.cohort_percent !== 0 ||
    JSON.stringify(manifest.rollout?.explicit_device_ids) !== JSON.stringify([item.deviceId]) ||
    manifest.compatibility?.minimum_current_version !== item.rollbackVersion ||
    manifest.compatibility?.maximum_current_version !== item.rollbackVersion ||
    manifest.compatibility?.security_floor_version !== item.rollbackVersion ||
    assertEdgeReleaseObjectUrl(manifest, origin) !== expectedObject ||
    statSync(input.artifact).size !== item.size || await hash(input.artifact) !== item.digest ||
    publication.release_id !== item.releaseId || publication.object_key !== expectedObject ||
    publication.artifact_sha256 !== item.digest || publication.bytes !== item.size ||
    publication.round_trip !== "PASS" || publication.anonymous_access_denied !== true ||
    publication.runtime_activation !== false)
    throw new Error(`P38_MANAGED_AUTH_REGISTRATION_${component.toUpperCase()}_VERIFICATION_FAILED`);
  verified[component] = { item, manifest,
    payload: Buffer.from(JSON.stringify(manifest), "utf8").toString("hex") };
}

if (!apply) {
  console.log(JSON.stringify({ status: "VERIFIED_NOT_REGISTERED", releases: Object.values(verified)
    .map(({ item }) => item.releaseId), exact_devices: 2, broad_cohort: "DISABLED",
  live_trust: "PASS", r2_round_trip: "PASS", runtime_writes: 0 }));
  process.exit(0);
}

const context = "colima-push38t", container = "supabase_db_gan-batuach-push38t";
const docker = args => execFileSync("docker", ["--context", context, ...args],
  { encoding: "utf8", timeout: 45_000, stdio: ["ignore", "pipe", "pipe"] });
const labels = JSON.parse(docker(["inspect", "--format", "{{json .Config.Labels}}", container]));
if (labels["com.supabase.cli.project"] !== "gan-batuach-push38t" ||
  docker(["network", "inspect", "push38t-loopback", "--format",
    "{{index .Options \"com.docker.network.bridge.host_binding_ipv4\"}}" ]).trim() !== "127.0.0.1")
  throw new Error("P38_MANAGED_AUTH_REGISTRATION_DATABASE_NOT_ISOLATED");

const releaseSql = Object.values(verified).map(({ item, payload }) => `
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
  then raise exception 'P38_MANAGED_AUTH_RELEASE_CONFLICT'; end if;
end $$;
insert into public.observer_edge_rollouts (release_id,stage,status,cohort_percent,target_filters)
select id,'INTERNAL_QA','DRAFT',0,jsonb_build_object('explicit_device_ids',jsonb_build_array('${item.deviceId}'))
from public.observer_edge_releases r where r.release_id='${item.releaseId}'
and not exists(select 1 from public.observer_edge_rollouts existing where existing.release_id=r.id);
update public.observer_edge_rollouts set status='DRAFT',paused_reason=null,updated_at=now()
where release_id=(select id from public.observer_edge_releases where release_id='${item.releaseId}')
  and status='PAUSED' and cohort_percent=0
  and target_filters->'explicit_device_ids'=jsonb_build_array('${item.deviceId}');
update public.observer_edge_rollouts set status='PAUSED',updated_at=now()
where release_id in (select id from public.observer_edge_releases
  where deployment_profile='${item.profile}' and release_id<>'${item.releaseId}')
  and status in ('DRAFT','ACTIVE');`).join("\n");
const prerequisites = Object.values(verified).map(({ item }) => `
    not exists(select 1 from public.video_gateway_device_enrollments e
      join public.observer_managed_device_credentials c
        on c.enrollment_id=e.id and c.credential_version=e.credential_version
      where e.gateway_id='${item.deviceId}' and e.deployment_profile='${item.profile}'
        and e.lifecycle_state='ACTIVE' and e.status='delivered'
        and e.identity_scheme='ED25519_V1'
        and e.metadata->>'home_qa_phase'='MANAGED_IDENTITY_VERIFIED'
        and e.active_runtime_instance_id is not null)`).join(" or");
const reconciled = Object.values(verified).map(({ item }) => `
    not exists(select 1 from public.observer_edge_rollouts o
      join public.observer_edge_releases r on r.id=o.release_id
      where r.release_id='${item.releaseId}' and o.status='DRAFT' and o.cohort_percent=0
        and o.target_filters->'explicit_device_ids'=jsonb_build_array('${item.deviceId}'))`).join(" or");
const rollbackChecks = Object.values(verified).map(({ item }) => `
    not exists(select 1 from public.observer_edge_releases
      where release_id='${item.rollbackReleaseId}' and channel='HOME_QA')`).join(" or");
const sql = `begin;
do $$ begin
  if (select count(*) from public.video_gateway_device_enrollments) <> 2 or${prerequisites} or${rollbackChecks}
  then raise exception 'P38_MANAGED_AUTH_REGISTRATION_PREREQUISITE_MISSING'; end if;
end $$;
${releaseSql}
do $$ begin
  if${reconciled} or exists(select 1 from public.observer_edge_rollouts where cohort_percent<>0)
  then raise exception 'P38_MANAGED_AUTH_REGISTRATION_RECONCILIATION_FAILED'; end if;
end $$;
commit;`;
execFileSync("docker", ["--context", context, "exec", "-i", container, "psql", "-X", "-q",
  "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
{ input: sql, encoding: "utf8", timeout: 45_000, stdio: ["pipe", "pipe", "pipe"] });
console.log(JSON.stringify({ status: "MANAGED_AUTH_CONTINUITY_REGISTERED_DRAFT",
  releases: Object.values(verified).map(({ item }) => item.releaseId), exact_devices: 2,
  broad_cohort: "DISABLED", r2_round_trip: "PASS", live_trust: "PASS",
  production_writes: 0, runtime_writes: 0 }));
