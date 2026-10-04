// Renew only the bounded HOME_QA legacy-transition proof window after a fresh
// pinned identity/source reconciliation. Public keys must already match the
// two exact QA records; this script never creates or replaces an identity.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createKeychainStore } from "../../services/video-gateway/keychain-store.mjs";
import { deriveHomeQaLegacyProofKey } from "../../services/video-gateway/home-qa-legacy-proof.mjs";

const mode = process.argv.includes("--apply") ? "APPLY" : process.argv.includes("--dry-run") ? "DRY_RUN" : "";
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const evidencePath = realpathSync(resolve(option("identity") || "."));
const expectedSha = option("sha256");
if (!mode || !evidencePath.startsWith(restricted) || (statSync(evidencePath).mode & 0o077) !== 0 ||
  !/^[a-f0-9]{64}$/.test(expectedSha)) throw new Error("P38_LEGACY_PROOF_RENEWAL_INPUT_INVALID");
const bytes = readFileSync(evidencePath);
if (createHash("sha256").update(bytes).digest("hex") !== expectedSha)
  throw new Error("P38_LEGACY_PROOF_RENEWAL_EVIDENCE_CHANGED");
const evidence = JSON.parse(bytes.toString("utf8"));
if (evidence.protocol !== "observer-push38-home-identity-reconciliation-v1" ||
  evidence.devices?.length !== 2 || evidence.dvr?.assigned?.length !== 10 ||
  evidence.dvr?.source_available?.length !== 8 || evidence.dvr?.upstream_unavailable?.length !== 2 ||
  evidence.dvr?.empty?.length !== 6 || Date.now() - Date.parse(evidence.observed_at) > 60 * 60_000)
  throw new Error("P38_LEGACY_PROOF_RENEWAL_EVIDENCE_INVALID");
const connectorRoot = join(homedir(), "Library/Application Support/Digital Observer/Tapo Connector/secrets");
const gatewayStore = createKeychainStore({ service: "com.ganbatuach.video-gateway.runtime" });
const readSecret = async (profile, name) => profile === "PHYSICAL_GATEWAY"
  ? gatewayStore.read(name) : readFileSync(join(connectorRoot, name), "utf8").trim();
const bindings = [];
for (const row of evidence.devices) {
  if (row.identity_phase === "MANAGED_IDENTITY_VERIFIED") {
    if (row.managed_identity_proof_matches_home_qa !== true)
      throw new Error("P38_LEGACY_PROOF_RENEWAL_MANAGED_DEVICE_INVALID");
    continue;
  }
  const acceptableProof = row.installed_credential_matches_product_verifier === true ||
    (row.legacy_transition_proof_matches_home_qa === true &&
      row.legacy_refresh_state === "ORPHANED_ROTATION_REQUIRES_MANAGED_BOOTSTRAP");
  if (!acceptableProof || row.identity_phase !== "LEGACY_VERIFIED_FOR_TRANSITION")
    throw new Error("P38_LEGACY_PROOF_RENEWAL_DEVICE_EVIDENCE_INVALID");
  const localSigningSecret = await readSecret(row.profile, "gateway_signing_secret");
  const pair = deriveHomeQaLegacyProofKey({ localSigningSecret, device_id: row.device_id,
    enrollment_id: row.enrollment_id, site_id: row.site_id, tenant_id: row.tenant_id,
    profile: row.profile });
  bindings.push({ enrollment_id: row.enrollment_id, device_id: row.device_id, profile: row.profile,
    public_key_sha256: createHash("sha256").update(Buffer.from(pair.publicKeySpki, "base64url")).digest("hex") });
}
const run = (args, input) => execFileSync("docker", ["--context", "colima-push38t", ...args], {
  encoding: "utf8", timeout: 45_000, stdio: [input ? "pipe" : "ignore", "pipe", "pipe"], input });
const container = "supabase_db_gan-batuach-push38t";
const labels = JSON.parse(run(["inspect", "--format", "{{json .Config.Labels}}", container]));
if (labels["com.supabase.cli.project"] !== "gan-batuach-push38t" ||
  run(["network", "inspect", "push38t-loopback", "--format",
    "{{index .Options \"com.docker.network.bridge.host_binding_ipv4\"}}"]).trim() !== "127.0.0.1")
  throw new Error("P38_LEGACY_PROOF_RENEWAL_DATABASE_NOT_ISOLATED");
const payload = Buffer.from(JSON.stringify(bindings), "utf8").toString("hex");
const update = mode === "APPLY" ? `update public.video_gateway_device_enrollments e set metadata=e.metadata ||
  jsonb_build_object('identity_evidence_sha256','${expectedSha}',
    'home_qa_legacy_proof_bound_at',now()::text,
    'home_qa_legacy_proof_expires_at',(now()+interval '2 hours')::text)
  from p38_bindings b where e.id=b.enrollment_id;` : "";
const sql = `begin;
create temp table p38_bindings on commit drop as
  select * from jsonb_to_recordset(convert_from(decode('${payload}','hex'),'UTF8')::jsonb)
  as x(enrollment_id uuid,device_id uuid,profile text,public_key_sha256 text);
do $$ begin
  if (select count(*) from p38_bindings)<>${bindings.length} or
    (select count(*) from p38_bindings)<>1 or
    (select count(*) from public.video_gateway_device_enrollments)<>2 or
    (select count(*) from public.observer_edge_rollouts where status='ACTIVE')<>2 or
    exists(select 1 from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0) or
    exists(select 1 from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
      where o.status='ACTIVE' and (r.release_id,o.target_filters->'explicit_device_ids') not in (
        ('qa-p38-health-connector-startup-d44b7e4262f9','["db267b52-6282-4944-bcee-5d4857698fb0"]'::jsonb),
        ('qa-p38-health-gateway-6c9d08327ec6','["62df97e2-3c0b-427f-9108-bde029bc10e7"]'::jsonb))) or
    exists(select 1 from p38_bindings b left join public.video_gateway_device_enrollments e on e.id=b.enrollment_id
      where e.gateway_id is distinct from b.device_id or e.deployment_profile is distinct from b.profile or
      e.status<>'pending' or e.lifecycle_state<>'ACTIVE' or e.identity_scheme<>'LEGACY_HMAC' or
      e.credential_version<>0 or e.metadata->>'home_qa_phase'<>'LEGACY_VERIFIED_FOR_TRANSITION' or
      e.metadata->>'home_qa_legacy_public_key_sha256' is distinct from b.public_key_sha256)
  then raise exception 'P38_LEGACY_PROOF_RENEWAL_STATE_CONFLICT'; end if;
end $$;
${update}
${mode === "APPLY" ? `do $$ begin
  if exists(select 1 from p38_bindings b join public.video_gateway_device_enrollments e on e.id=b.enrollment_id
    where (e.metadata->>'home_qa_legacy_proof_expires_at')::timestamptz <= now()+interval '110 minutes' or
      e.metadata->>'identity_evidence_sha256'<>'${expectedSha}')
  then raise exception 'P38_LEGACY_PROOF_RENEWAL_VERIFY_FAILED'; end if;
end $$;` : ""}
${mode === "APPLY" ? "commit;" : "rollback;"}`;
run(["exec", "-i", container, "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1",
  "-U", "postgres", "-d", "postgres"], sql);
console.log(JSON.stringify({ status: mode === "APPLY" ? "PROOF_WINDOW_RENEWED" : "DRY_RUN_PASS",
  legacy_devices_renewed: bindings.length, managed_devices_skipped: evidence.devices.length - bindings.length,
  active_exact_rollouts: 2, broad_cohort: 0, public_keys_replaced: false,
  private_keys_exported: false, production_writes: 0, runtime_writes: 0,
  proof_window_minutes: mode === "APPLY" ? 120 : 0 }));
