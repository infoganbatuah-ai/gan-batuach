// Reconcile the dedicated HOME_QA enrollment with the already-installed
// Software Connector runtime identity. This is qualification metadata only:
// Product/Production, camera sources and all private keys remain untouched.
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEVICE_ID = "db267b52-6282-4944-bcee-5d4857698fb0";
const ENROLLMENT_ID = "d7ee3c9f-0b2e-4943-947b-c410c6bc2a41";
const SITE_ID = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const PROFILE = "SOFTWARE_CONNECTOR";
const apply = process.argv.includes("--apply");
const connectorSecrets = join(homedir(),
  "Library/Application Support/Digital Observer/Tapo Connector/secrets");
const connectorConfigPath = join(homedir(),
  "Library/Application Support/Digital Observer/Tapo Connector/connector-config.json");

function installedValue(account) {
  const root = realpathSync(connectorSecrets);
  const path = join(root, account);
  if (!existsSync(path)) throw new Error(`P38_CONNECTOR_RUNTIME_${account.toUpperCase()}_MISSING`);
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0)
    throw new Error("P38_CONNECTOR_RUNTIME_METADATA_STORE_UNSAFE");
  return readFileSync(path, "utf8").trim();
}

const installedDeviceId = installedValue("device_gateway_id");
const installedSiteId = installedValue("device_observer_site_id");
const installationId = installedValue("device_installation_id");
const configInfo = lstatSync(connectorConfigPath);
if (!configInfo.isFile() || configInfo.isSymbolicLink() || (configInfo.mode & 0o077) !== 0)
  throw new Error("P38_CONNECTOR_RUNTIME_CONFIG_UNSAFE");
const installedConfig = JSON.parse(readFileSync(connectorConfigPath, "utf8"));
const connectorConfigVersion = Number(installedConfig.version);
if (installedDeviceId !== DEVICE_ID || installedSiteId !== SITE_ID ||
  !/^edge-[a-f0-9]{32}$/.test(installationId) ||
  !Number.isSafeInteger(connectorConfigVersion) || connectorConfigVersion < 1)
  throw new Error("P38_CONNECTOR_RUNTIME_METADATA_IDENTITY_CONFLICT");

const docker = (args, input) => execFileSync("docker", ["--context", "colima-push38t", ...args], {
  encoding: "utf8", timeout: 45_000, input,
  stdio: [input ? "pipe" : "ignore", "pipe", "pipe"]
});
const container = "supabase_db_gan-batuach-push38t";
const labels = JSON.parse(docker(["inspect", "--format", "{{json .Config.Labels}}", container]));
if (labels["com.supabase.cli.project"] !== "gan-batuach-push38t" ||
  docker(["network", "inspect", "push38t-loopback", "--format",
    "{{index .Options \"com.docker.network.bridge.host_binding_ipv4\"}}" ]).trim() !== "127.0.0.1")
  throw new Error("P38_HOME_QA_DATABASE_NOT_ISOLATED");

const sql = `begin;
create temp table p38_source_snapshot on commit drop as
  select count(*)::integer as source_count,
    md5(coalesce(string_agg(id::text||':'||observer_site_id::text||':'||coalesce(connector_type,''),
      ',' order by id),'')) as fingerprint
  from public.digital_observer_camera_sources;
do $$ begin
  if (select count(*) from public.video_gateway_device_enrollments) <> 2 or
    (select source_count from p38_source_snapshot) <> 17 or
    not exists(
      select 1 from public.video_gateway_device_enrollments e
      join public.observer_managed_device_credentials c
        on c.enrollment_id=e.id and c.credential_version=e.credential_version
      where e.id='${ENROLLMENT_ID}' and e.gateway_id='${DEVICE_ID}'
        and e.observer_site_id='${SITE_ID}' and e.tenant_id='${SITE_ID}'
        and e.deployment_profile='${PROFILE}' and e.status='delivered'
        and e.lifecycle_state='ACTIVE' and e.identity_scheme='ED25519_V1'
        and e.credential_version=1 and c.credential_state='ACTIVE'
        and c.revoked_at is null and e.active_runtime_instance_id is not null
        and e.metadata->>'home_qa_phase'='MANAGED_IDENTITY_VERIFIED'
        and coalesce(e.metadata->>'device_type','${PROFILE}')='${PROFILE}'
        and coalesce(e.metadata->>'installation_id','${installationId}')='${installationId}'
        and coalesce((e.metadata->>'connector_config_version')::integer,${connectorConfigVersion})=${connectorConfigVersion}
    )
  then raise exception 'P38_CONNECTOR_RUNTIME_METADATA_PRECONDITION_FAILED'; end if;
end $$;
${apply ? `update public.video_gateway_device_enrollments
  set metadata=metadata||jsonb_build_object(
    'device_type','${PROFILE}',
    'installation_id','${installationId}',
    'connector_config_version',${connectorConfigVersion},
    'home_qa_runtime_metadata_reconciled_at',now()::text)
  where id='${ENROLLMENT_ID}' and gateway_id='${DEVICE_ID}';` : ""}
do $$ begin
  if ${apply ? "not" : "false and not"} exists(
    select 1 from public.video_gateway_device_enrollments
    where id='${ENROLLMENT_ID}' and gateway_id='${DEVICE_ID}'
      and metadata->>'device_type'='${PROFILE}'
      and metadata->>'installation_id'='${installationId}'
      and (metadata->>'connector_config_version')::integer=${connectorConfigVersion}
  ) then raise exception 'P38_CONNECTOR_RUNTIME_METADATA_VERIFY_FAILED'; end if;
  if not exists(
    select 1 from p38_source_snapshot s cross join lateral (
      select count(*)::integer as source_count,
        md5(coalesce(string_agg(id::text||':'||observer_site_id::text||':'||coalesce(connector_type,''),
          ',' order by id),'')) as fingerprint
      from public.digital_observer_camera_sources
    ) a where a.source_count=s.source_count and a.fingerprint=s.fingerprint
  ) then raise exception 'P38_CONNECTOR_RUNTIME_METADATA_SOURCE_INTEGRITY_FAILED'; end if;
end $$;
${apply ? "commit;" : "rollback;"}`;
docker(["exec", "-i", container, "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1",
  "-U", "postgres", "-d", "postgres"], sql);

console.log(JSON.stringify({
  status: apply ? "HOME_QA_CONNECTOR_RUNTIME_METADATA_RECONCILED" : "HOME_QA_CONNECTOR_RUNTIME_METADATA_PLAN_PASS",
  device_id: DEVICE_ID,
  site_id: SITE_ID,
  profile: PROFILE,
  installation_id: installationId,
  connector_config_version: connectorConfigVersion,
  production_writes: 0,
  camera_source_writes: 0,
  private_key_reads: 0
}));
