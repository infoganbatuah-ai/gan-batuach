// Enable only the exact legacy Connector transition and Gateway bootstrap
// download. Connector remediation stays DRAFT until signed transition and
// managed Ed25519 identity are both proven.
import { execFileSync } from "node:child_process";

const bundle = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-signed-manifests-35482295860.zip";
const verified = JSON.parse(execFileSync(process.execPath,
  ["scripts/qa/register-push38-homeqa-releases.mjs", `--bundle=${bundle}`],
  { encoding: "utf8", timeout: 90_000, stdio: ["ignore", "pipe", "pipe"] }));
if (verified.status !== "VERIFIED_NOT_REGISTERED" || !verified.exact_device_targeting ||
  !verified.trusted_aws_signer || !verified.artifact_hashes || verified.releases?.length !== 3)
  throw new Error("P38_HOME_QA_SIGNED_RELEASES_NOT_VERIFIED");
const context = "colima-push38t", project = "gan-batuach-push38t", container = `supabase_db_${project}`;
const docker = args => execFileSync("docker", ["--context", context, ...args],
  { encoding: "utf8", timeout: 45_000, stdio: ["ignore", "pipe", "pipe"] });
const labels = JSON.parse(docker(["inspect", "--format", "{{json .Config.Labels}}", container]));
if (labels["com.supabase.cli.project"] !== project) throw new Error("P38_HOME_QA_WRONG_DATABASE");
const network = docker(["network", "inspect", "push38t-loopback", "--format",
  "{{index .Options \"com.docker.network.bridge.host_binding_ipv4\"}}"]).trim();
if (network !== "127.0.0.1") throw new Error("P38_HOME_QA_DATABASE_NOT_LOOPBACK");
const sql = `begin;
do $$ begin
  if (select count(*) from public.video_gateway_device_enrollments where status='pending'
       and identity_scheme='LEGACY_HMAC' and credential_version=0
       and metadata->>'home_qa_phase'='LEGACY_VERIFIED_FOR_TRANSITION'
       and metadata->>'home_qa_legacy_public_key_spki' is not null
       and (metadata->>'home_qa_legacy_proof_expires_at')::timestamptz > now()) <> 2 or
     (select count(*) from public.video_gateway_device_enrollments) <> 2 or
     (select count(*) from public.observer_edge_releases where channel='HOME_QA') <> 3 or
     (select count(*) from public.observer_edge_rollouts) <> 3 or
     exists(select 1 from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
       where o.stage<>'INTERNAL_QA' or o.cohort_percent<>0 or
         o.target_filters->'explicit_device_ids' is distinct from r.signed_manifest->'rollout'->'explicit_device_ids')
  then raise exception 'P38_HOME_QA_ROLLOUT_PRECHECK_FAILED'; end if;
end $$;
update public.observer_edge_rollouts o set status='ACTIVE',updated_at=now()
from public.observer_edge_releases r where r.id=o.release_id and o.status='DRAFT'
  and r.release_id in ('qa-connector-legacy-transition-v2-6e7988808b05',
                       'qa-p38-health-gateway-6c9d08327ec6');
do $$ begin
  if (select count(*) from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
      where o.status='ACTIVE' and o.cohort_percent=0 and r.release_id in
        ('qa-connector-legacy-transition-v2-6e7988808b05','qa-p38-health-gateway-6c9d08327ec6')) <> 2 or
     (select count(*) from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
      where r.release_id='qa-p38-health-connector-1b076f596574' and o.status='DRAFT') <> 1 or
     (select count(*) from public.observer_edge_rollouts where cohort_percent>0) <> 0
  then raise exception 'P38_HOME_QA_ROLLOUT_STATE_INVALID'; end if;
end $$;
commit;`;
if (!process.argv.includes("--apply")) {
  const state = docker(["exec", container, "psql", "-X", "-A", "-t", "-U", "postgres", "-d", "postgres", "-c",
    "select count(*) from public.video_gateway_device_enrollments where metadata->>'home_qa_phase'='LEGACY_VERIFIED_FOR_TRANSITION';"]).trim();
  console.log(JSON.stringify({ status: "VERIFIED_NOT_ACTIVATED", legacy_devices: Number(state),
    signed_releases: 3, desired_active_rollouts: 2, remediation_pretransition: "DRAFT" }));
  process.exit(0);
}
execFileSync("docker", ["--context", context, "exec", "-i", container, "psql", "-X", "-q",
  "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
{ input: sql, encoding: "utf8", timeout: 45_000, stdio: ["pipe", "pipe", "pipe"] });
console.log(JSON.stringify({ status: "EXACT_LEGACY_ROLLOUTS_ACTIVE", connector_transition: "ACTIVE",
  connector_remediation: "DRAFT", gateway_download: "ACTIVE", broad_cohort_percent: 0,
  production_writes: 0, runtime_writes: 0 }));
