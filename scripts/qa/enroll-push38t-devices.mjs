import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { reconcileHomeQaEnrollment } from "../../services/video-gateway/home-qa-enrollment.mjs";

const project = "gan-batuach-push38t";
const context = "colima-push38t";
const container = `supabase_db_${project}`;
const evidenceDir = process.env.OBSERVER_QA_RESTRICTED_EVIDENCE_DIR;
if (!evidenceDir) throw new Error("OBSERVER_QA_RESTRICTED_EVIDENCE_DIR is required outside Git");
const restricted = realpathSync(resolve(evidenceDir)) + sep;
const sourceRoot = realpathSync(resolve(import.meta.dirname, "../..")) + sep;
if (restricted.startsWith(sourceRoot)) throw new Error("QA_ENROLLMENT_EVIDENCE_MUST_BE_OUTSIDE_GIT_WORKTREE");
const options = Object.fromEntries(process.argv.slice(2).filter(value => value.startsWith("--") && value.includes("="))
  .map(value => { const index = value.indexOf("="); return [value.slice(2, index), value.slice(index + 1)]; }));
const apply = process.argv.includes("--apply");
if (!options.capture || !options.approval) throw new Error("Two independent restricted public-key evidence files are required");
function loadRestricted(file) {
  const path = realpathSync(resolve(file));
  if (!path.startsWith(restricted) || !statSync(path).isFile() || (statSync(path).mode & 0o077) !== 0)
    throw new Error("QA_ENROLLMENT_EVIDENCE_NOT_RESTRICTED");
  return JSON.parse(readFileSync(path, "utf8"));
}
const rows = reconcileHomeQaEnrollment(loadRestricted(options.capture), loadRestricted(options.approval));
const runDocker = args => execFileSync("docker", ["--context", context, ...args], { encoding: "utf8",
  stdio: ["pipe", "pipe", "pipe"], timeout: 45_000 });
const labels = JSON.parse(runDocker(["inspect", "--format", "{{json .Config.Labels}}", container]));
if (labels["com.supabase.cli.project"] !== project) throw new Error("QA_ENROLLMENT_WRONG_DATABASE");
const network = runDocker(["network", "inspect", "push38t-loopback", "--format",
  "{{index .Options \"com.docker.network.bridge.host_binding_ipv4\"}}"]).trim();
if (network !== "127.0.0.1") throw new Error("QA_ENROLLMENT_NETWORK_NOT_LOOPBACK");

const digest = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
if (!apply) {
  console.log(JSON.stringify({ status: "VERIFIED_NOT_ENROLLED", profiles: rows.map(row => row.profile),
    evidence_digest: digest, productionAccess: false }));
  process.exit(0);
}
const hex = Buffer.from(JSON.stringify(rows), "utf8").toString("hex");
const sql = `BEGIN;
CREATE TEMP TABLE qa_home_devices ON COMMIT DROP AS
  SELECT * FROM jsonb_to_recordset(convert_from(decode('${hex}','hex'),'UTF8')::jsonb)
  AS x(enrollment_id uuid,device_id uuid,site_id uuid,tenant_id uuid,profile text,
       credential_version integer,config_version integer,public_key_spki text,public_key_sha256 text);
DO $$ BEGIN
  IF (SELECT count(*) FROM auth.users) <> 0 OR (SELECT count(*) FROM qa_home_devices) <> 2
  THEN RAISE EXCEPTION 'QA_DB_NOT_EMPTY_OR_WRONG_DEVICE_COUNT'; END IF;
  IF EXISTS (SELECT 1 FROM public.video_gateway_device_enrollments
    WHERE id NOT IN (SELECT enrollment_id FROM qa_home_devices))
  THEN RAISE EXCEPTION 'QA_DB_HAS_UNRELATED_DEVICE'; END IF;
END $$;
INSERT INTO public.observer_sites(id,name,site_type)
  SELECT DISTINCT site_id,'Owned Home QA qualification','home' FROM qa_home_devices
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.video_gateway_device_enrollments
  (id,status,device_name,device_platform,poll_token_hash,observer_site_id,gateway_id,
   expires_at,delivered_at,metadata,identity_scheme,deployment_profile,tenant_id,
   credential_version,lifecycle_state,config_version)
  SELECT enrollment_id,'delivered',profile||' HOME_QA','darwin',md5(gen_random_uuid()::text),
    site_id,device_id,now()+interval '30 days',now(),
    jsonb_build_object('qualification_only',true,'device_type',profile,'owner_witness_digest','${digest}'),
    'ED25519_V1',profile,tenant_id,credential_version,'ACTIVE',config_version
  FROM qa_home_devices ON CONFLICT (id) DO NOTHING;
INSERT INTO public.observer_managed_device_credentials
  (id,enrollment_id,credential_version,algorithm,public_key_spki,credential_state,activated_at)
  SELECT gen_random_uuid(),enrollment_id,credential_version,'Ed25519',public_key_spki,'ACTIVE',now()
  FROM qa_home_devices ON CONFLICT (enrollment_id,credential_version) DO NOTHING;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM qa_home_devices q LEFT JOIN public.video_gateway_device_enrollments e
      ON e.id=q.enrollment_id LEFT JOIN public.observer_managed_device_credentials c
      ON c.enrollment_id=q.enrollment_id AND c.credential_version=q.credential_version
      WHERE e.gateway_id IS DISTINCT FROM q.device_id OR e.tenant_id IS DISTINCT FROM q.tenant_id
      OR e.observer_site_id IS DISTINCT FROM q.site_id OR e.deployment_profile IS DISTINCT FROM q.profile
      OR e.identity_scheme <> 'ED25519_V1' OR e.lifecycle_state <> 'ACTIVE' OR e.status <> 'delivered'
      OR c.public_key_spki IS DISTINCT FROM q.public_key_spki OR c.credential_state <> 'ACTIVE')
  THEN RAISE EXCEPTION 'QA_ENROLLMENT_RECONCILIATION_FAILED'; END IF;
END $$;
COMMIT;`;
execFileSync("docker", ["--context", context, "exec", "-i", container, "psql", "-X", "-q",
  "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], {
  input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 45_000 });
console.log(JSON.stringify({ status: "ENROLLED_HOME_QA_ONLY", profiles: rows.map(row => row.profile),
  evidence_digest: digest, productionAccess: false }));
