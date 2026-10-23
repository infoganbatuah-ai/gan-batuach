// Mirror only the two verified legacy component identities into the isolated
// qualification database. This is not managed Ed25519 enrollment and never
// grants a device a managed UPDATE_READ token.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

const evidencePath = process.argv.find(arg => arg.startsWith("--evidence="))?.slice(11);
const expectedDigest = process.argv.find(arg => arg.startsWith("--sha256="))?.slice(9);
const apply = process.argv.includes("--apply");
if (!evidencePath || !/^[a-f0-9]{64}$/.test(expectedDigest || ""))
  throw new Error("P38_HOME_QA_PINNED_IDENTITY_EVIDENCE_REQUIRED");
const restricted = realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted") + sep;
const path = realpathSync(resolve(evidencePath));
if (!path.startsWith(restricted) || (statSync(path).mode & 0o077) !== 0)
  throw new Error("P38_HOME_QA_IDENTITY_EVIDENCE_NOT_RESTRICTED");
const raw = readFileSync(path);
const digest = createHash("sha256").update(raw).digest("hex");
if (digest !== expectedDigest) throw new Error("P38_HOME_QA_IDENTITY_EVIDENCE_CHANGED");
const evidence = JSON.parse(raw.toString("utf8"));
const site = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const devices = [
  { id: "62df97e2-3c0b-427f-9108-bde029bc10e7", enrollment: "1c450dca-38a8-4e49-853f-c613ca498c27", profile: "PHYSICAL_GATEWAY",
    baseline: "91bf6814075f74e703cbc0b85d30673237531247ec46633c54576d5a4627144d" },
  { id: "db267b52-6282-4944-bcee-5d4857698fb0", enrollment: "d7ee3c9f-0b2e-4943-947b-c410c6bc2a41", profile: "SOFTWARE_CONNECTOR",
    baseline: "ee82c20a77acb7fd8caf692682569ad53581e9c057b11724845c6d947c5a982a" }
];
if (evidence.protocol !== "observer-push38-home-identity-reconciliation-v1" ||
  evidence.product_database_access !== "AUTHORIZED_READ_ONLY" ||
  evidence.production_writes !== 0 || evidence.installed_runtime_writes !== 0 ||
  evidence.site?.id !== site || evidence.site?.tenant_id !== site ||
  !Array.isArray(evidence.devices) || evidence.devices.length !== 2 ||
  !Array.isArray(evidence.dvr?.assigned) || evidence.dvr.assigned.length !== 10 ||
  !Array.isArray(evidence.dvr?.empty) || evidence.dvr.empty.length !== 6 ||
  !evidence.tapo?.installed_source_match ||
  Date.now() - Date.parse(evidence.observed_at) > 30 * 60_000 ||
  Date.parse(evidence.observed_at) > Date.now() + 60_000)
  throw new Error("P38_HOME_QA_IDENTITY_EVIDENCE_INVALID_OR_STALE");
for (const expected of devices) {
  const match = evidence.devices.filter(row => row.device_id === expected.id &&
    row.enrollment_id === expected.enrollment && row.profile === expected.profile &&
    row.site_id === site && row.tenant_id === site &&
    row.identity_phase === "LEGACY_VERIFIED_FOR_TRANSITION" &&
    row.installed_credential_matches_product_verifier === true &&
    Number.isInteger(row.config_version) && row.config_version > 0);
  if (match.length !== 1) throw new Error(`P38_HOME_QA_${expected.profile}_IDENTITY_CONFLICT`);
}
const sourceDigest = createHash("sha256").update(JSON.stringify({ dvr: evidence.dvr, tapo: evidence.tapo })).digest("hex");
if (!apply) {
  console.log(JSON.stringify({ status: "VERIFIED_NOT_REGISTERED", devices: 2, phase: "LEGACY_VERIFIED_FOR_TRANSITION",
    evidence_sha256: digest, source_inventory_sha256: sourceDigest, production_writes: 0, runtime_writes: 0 }));
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
const rows = devices.map(item => ({ ...item, config_version: evidence.devices.find(row => row.device_id === item.id).config_version,
  site_id: site, tenant_id: site, evidence_sha256: digest, source_inventory_sha256: sourceDigest }));
const payload = Buffer.from(JSON.stringify(rows), "utf8").toString("hex");
const sql = `begin;
create temp table p38_home_devices on commit drop as
  select * from jsonb_to_recordset(convert_from(decode('${payload}','hex'),'UTF8')::jsonb)
  as x(id uuid,enrollment uuid,profile text,baseline text,config_version integer,
    site_id uuid,tenant_id uuid,evidence_sha256 text,source_inventory_sha256 text);
do $$ begin
  if (select count(*) from auth.users) <> 0 or (select count(*) from p38_home_devices) <> 2 or
     (select count(*) from public.observer_sites where id <> '${site}') <> 0 or
     (select count(*) from public.video_gateway_device_enrollments
       where id not in (select enrollment from p38_home_devices)) <> 0 or
     (select count(*) from public.observer_edge_releases where channel='HOME_QA') <> 3 or
     (select count(*) from public.observer_edge_rollouts where status='ACTIVE') <> 0
  then raise exception 'P38_HOME_QA_UNEXPECTED_EXISTING_STATE'; end if;
end $$;
insert into public.observer_sites(id,name,site_type,active,metadata)
  values('${site}','Owned Home QA qualification mirror','home',true,
    jsonb_build_object('qualification_only',true,'product_site_id','${site}'))
  on conflict (id) do nothing;
insert into public.video_gateway_device_enrollments
  (id,status,device_name,device_platform,poll_token_hash,observer_site_id,gateway_id,
   expires_at,metadata,identity_scheme,deployment_profile,tenant_id,credential_version,
   lifecycle_state,config_version)
select enrollment,'pending',profile||' HOME_QA legacy qualification','darwin',
  encode(digest(gen_random_uuid()::text,'sha256'),'hex'),site_id,id,
  now()+interval '7 days',
  jsonb_build_object('qualification_only',true,'home_qa_phase','LEGACY_VERIFIED_FOR_TRANSITION',
    'product_enrollment_id',enrollment,'authorized_baseline_sha256',baseline,
    'identity_evidence_sha256',evidence_sha256,'source_inventory_sha256',source_inventory_sha256),
  'LEGACY_HMAC',profile,tenant_id,0,'ACTIVE',config_version
from p38_home_devices on conflict (id) do nothing;
do $$ begin
  if (select count(*) from public.observer_sites) <> 1 or
     (select count(*) from public.video_gateway_device_enrollments) <> 2 or
     (select count(*) from public.observer_managed_device_credentials) <> 0 or
     exists(select 1 from p38_home_devices x left join public.video_gateway_device_enrollments e
       on e.id=x.enrollment where e.gateway_id is distinct from x.id or
       e.observer_site_id is distinct from x.site_id or e.tenant_id is distinct from x.tenant_id or
       e.deployment_profile is distinct from x.profile or e.identity_scheme <> 'LEGACY_HMAC' or
       e.status <> 'pending' or e.credential_version <> 0 or e.refresh_token_hash is not null or
       e.metadata->>'home_qa_phase' <> 'LEGACY_VERIFIED_FOR_TRANSITION' or
       e.metadata->>'authorized_baseline_sha256' <> x.baseline or
       e.metadata->>'identity_evidence_sha256' <> x.evidence_sha256)
  then raise exception 'P38_HOME_QA_LEGACY_RECONCILIATION_FAILED'; end if;
end $$;
commit;`;
execFileSync("docker", ["--context", context, "exec", "-i", container, "psql", "-X", "-q",
  "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
{ input: sql, encoding: "utf8", timeout: 45_000, stdio: ["pipe", "pipe", "pipe"] });
console.log(JSON.stringify({ status: "TWO_LEGACY_QUALIFICATION_RECORDS_REGISTERED", devices: 2,
  phase: "LEGACY_VERIFIED_FOR_TRANSITION", managed_credentials: 0,
  active_rollouts: 0, production_writes: 0, runtime_writes: 0 }));
