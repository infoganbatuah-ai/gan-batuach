// Promote an existing, exactly-bound QA mirror only after the signed installed
// baseline is current. The Ed25519 private key stays in an OTA-only local store;
// Product's legacy Gateway/Connector credential stores are never edited.
import { execFileSync } from "node:child_process";
import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { generateManagedDeviceKeyPair } from "../../services/video-gateway/managed-device-auth.mjs";
import { verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";

const specs = Object.freeze({
  SOFTWARE_CONNECTOR: { id: "db267b52-6282-4944-bcee-5d4857698fb0",
    enrollment: "d7ee3c9f-0b2e-4943-947b-c410c6bc2a41",
    baseline: "qa-connector-legacy-transition-v2-6e7988808b05", rootName: "observer-connector" },
  PHYSICAL_GATEWAY: { id: "62df97e2-3c0b-427f-9108-bde029bc10e7",
    enrollment: "1c450dca-38a8-4e49-853f-c613ca498c27",
    baseline: "qa-legacy-gateway-91bf6814075f", rootName: "observer-gateway" }
});
const profile = process.argv.find(arg => arg.startsWith("--profile="))?.slice(10);
const mode = process.argv.includes("--prepare") ? "PREPARE" : process.argv.includes("--verify") ? "VERIFY" : "PLAN";
if (!Object.hasOwn(specs, profile) || (process.argv.includes("--prepare") && process.argv.includes("--verify")))
  throw new Error("P38_HOME_QA_MANAGED_SCOPE_INVALID");
const spec = specs[profile];
const root = join(homedir(), "Library/Application Support/Digital Observer", spec.rootName, "ota");
const secretDir = join(root, "home-qa-device-secrets");
const pin = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH });
const bootstrapPath = join(root, "installed-bootstrap.json");
if (!existsSync(bootstrapPath) || lstatSync(bootstrapPath).isSymbolicLink())
  throw new Error("P38_HOME_QA_SIGNED_BOOTSTRAP_NOT_COMPLETE");
const bootstrap = JSON.parse(readFileSync(bootstrapPath, "utf8"));
const pointer = bootstrap.pointer;
if (pointer?.release_id !== spec.baseline || !pointer.slot ||
  !realpathSync(pointer.slot).startsWith(`${realpathSync(join(root, "slots"))}/`))
  throw new Error("P38_HOME_QA_KNOWN_GOOD_NOT_PINNED");
const manifestPath = join(pointer.slot, "release.json"), artifactPath = join(pointer.slot, "artifact.bin");
if (lstatSync(manifestPath).isSymbolicLink() || lstatSync(artifactPath).isSymbolicLink())
  throw new Error("P38_HOME_QA_KNOWN_GOOD_SYMLINK_FORBIDDEN");
const slotManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const slotArtifact = readFileSync(artifactPath);
if (slotManifest.release_id !== spec.baseline || slotManifest.profile !== profile ||
  slotManifest.artifact_sha256 !== pointer.artifact_sha256 ||
  !verifyEdgeUpdateManifest(slotManifest, pin.trustedPublicKeys).ok ||
  !verifyEdgeArtifact(slotArtifact, slotManifest).ok)
  throw new Error("P38_HOME_QA_KNOWN_GOOD_UNTRUSTED");
if (profile === "SOFTWARE_CONNECTOR") {
  const journal = JSON.parse(readFileSync(join(root, "legacy-transition.json"), "utf8"));
  if (journal.state !== "RETIRED" || journal.transition_release_id !== spec.baseline ||
    journal.device_id !== spec.id) throw new Error("P38_HOME_QA_CONNECTOR_TRANSITION_NOT_PROMOTED");
}
const run = (args, input) => execFileSync("docker", ["--context", "colima-push38t", ...args],
  { encoding: "utf8", timeout: 45_000, stdio: [input ? "pipe" : "ignore", "pipe", "pipe"], input });
const container = "supabase_db_gan-batuach-push38t";
const labels = JSON.parse(run(["inspect", "--format", "{{json .Config.Labels}}", container]));
if (labels["com.supabase.cli.project"] !== "gan-batuach-push38t" ||
  run(["network", "inspect", "push38t-loopback", "--format",
    "{{index .Options \"com.docker.network.bridge.host_binding_ipv4\"}}"]).trim() !== "127.0.0.1")
  throw new Error("P38_HOME_QA_DATABASE_NOT_ISOLATED");
const query = sql => run(["exec", container, "psql", "-X", "-A", "-t", "-U", "postgres", "-d", "postgres", "-c", sql]).trim();
const state = query(`select status||'|'||identity_scheme||'|'||credential_version||'|'||coalesce(metadata->>'home_qa_phase','')
  from public.video_gateway_device_enrollments where id='${spec.enrollment}' and gateway_id='${spec.id}'
  and deployment_profile='${profile}' and observer_site_id='cc1673b8-3eb0-4785-a12c-1fb88f425a41'
  and tenant_id='cc1673b8-3eb0-4785-a12c-1fb88f425a41' and lifecycle_state='ACTIVE'`);
if (!state) throw new Error("P38_HOME_QA_EXACT_DEVICE_NOT_FOUND");
if (mode === "PLAN") {
  console.log(JSON.stringify({ status: "SIGNED_BASELINE_VERIFIED", profile, release_id: spec.baseline,
    qa_state: state, writes: 0 }));
  process.exit(0);
}
if (mode === "PREPARE") {
  if (state !== "pending|LEGACY_HMAC|0|LEGACY_VERIFIED_FOR_TRANSITION" &&
    state !== "delivered|ED25519_V1|1|MANAGED_IDENTITY_PENDING_PROOF")
    throw new Error("P38_HOME_QA_MANAGED_PREPARE_PHASE_INVALID");
  const store = createEdgeSecretStoreSync({ secretDir });
  let privateKey = store.read("device_private_key_pkcs8");
  if (!privateKey) {
    privateKey = generateManagedDeviceKeyPair().privateKeyPkcs8;
    store.write("device_private_key_pkcs8", privateKey);
  }
  const publicKey = createPublicKey(createPrivateKey({ key: Buffer.from(privateKey, "base64url"),
    format: "der", type: "pkcs8" })).export({ format: "der", type: "spki" }).toString("base64url");
  const publicFingerprint = createHash("sha256").update(Buffer.from(publicKey, "base64url")).digest("hex");
  const fields = { device_gateway_id: spec.id,
    device_observer_site_id: "cc1673b8-3eb0-4785-a12c-1fb88f425a41",
    device_credential_version: "1", device_cloud_base_url: "https://127.0.0.1:3101" };
  for (const [name, value] of Object.entries(fields)) {
    const prior = store.read(name);
    if (prior && prior !== value) throw new Error("P38_HOME_QA_OTA_ONLY_STORE_CONFLICT");
    if (!prior) store.write(name, value);
  }
  const payload = Buffer.from(JSON.stringify({ publicKey, publicFingerprint }), "utf8").toString("hex");
  const sql = `begin;
    create temp table p38_key on commit drop as select * from jsonb_to_record(convert_from(decode('${payload}','hex'),'UTF8')::jsonb)
      as x("publicKey" text,"publicFingerprint" text);
    do $$ begin
      if (select count(*) from public.video_gateway_device_enrollments) <> 2 or
        (select count(*) from public.digital_observer_camera_sources) <> 0 or
        not exists(select 1 from public.video_gateway_device_enrollments e where e.id='${spec.enrollment}'
          and e.gateway_id='${spec.id}' and e.lifecycle_state='ACTIVE' and
          ((e.status='pending' and e.identity_scheme='LEGACY_HMAC' and e.credential_version=0 and
             e.metadata->>'home_qa_phase'='LEGACY_VERIFIED_FOR_TRANSITION') or
           (e.status='delivered' and e.identity_scheme='ED25519_V1' and e.credential_version=1 and
             e.metadata->>'home_qa_phase'='MANAGED_IDENTITY_PENDING_PROOF')))
      then raise exception 'P38_HOME_QA_MANAGED_PREPARE_CONFLICT'; end if;
    end $$;
    insert into public.observer_managed_device_credentials
      (id,enrollment_id,credential_version,algorithm,public_key_spki,credential_state,activated_at)
      select gen_random_uuid(),'${spec.enrollment}',1,'Ed25519',"publicKey",'ACTIVE',now() from p38_key
      on conflict (enrollment_id,credential_version) do nothing;
    update public.video_gateway_device_enrollments set status='delivered', delivered_at=coalesce(delivered_at,now()),
      identity_scheme='ED25519_V1',credential_version=1,hardened_at=coalesce(hardened_at,now()),
      metadata=metadata||jsonb_build_object('home_qa_phase','MANAGED_IDENTITY_PENDING_PROOF',
        'home_qa_known_good_release_id','${spec.baseline}',
        'home_qa_key_prepared_at',coalesce(metadata->>'home_qa_key_prepared_at',now()::text),
        'home_qa_public_key_sha256',(select "publicFingerprint" from p38_key))
      where id='${spec.enrollment}';
    do $$ begin
      if not exists(select 1 from public.video_gateway_device_enrollments e
        join public.observer_managed_device_credentials c on c.enrollment_id=e.id
        cross join p38_key k where e.id='${spec.enrollment}' and e.gateway_id='${spec.id}'
        and e.status='delivered' and e.identity_scheme='ED25519_V1' and e.credential_version=1
        and e.metadata->>'home_qa_phase'='MANAGED_IDENTITY_PENDING_PROOF'
        and c.credential_state='ACTIVE' and c.public_key_spki=k."publicKey")
      then raise exception 'P38_HOME_QA_MANAGED_PREPARE_VERIFY_FAILED'; end if;
    end $$; commit;`;
  try { run(["exec", "-i", container, "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], sql); }
  catch { throw new Error("P38_HOME_QA_MANAGED_PREPARE_DATABASE_FAILED"); }
  console.log(JSON.stringify({ status: "MANAGED_IDENTITY_PENDING_PROOF", profile,
    public_key_sha256: publicFingerprint, ota_only_store: secretDir, production_writes: 0 }));
} else {
  if (state !== "delivered|ED25519_V1|1|MANAGED_IDENTITY_PENDING_PROOF" &&
    state !== "delivered|ED25519_V1|1|MANAGED_IDENTITY_VERIFIED")
    throw new Error("P38_HOME_QA_MANAGED_PROOF_PHASE_INVALID");
  const sql = `begin;
    do $$ begin
      if not exists(select 1 from public.video_gateway_device_enrollments e
        join public.observer_managed_device_credentials c on c.enrollment_id=e.id
        join public.observer_managed_device_auth_nonces n on n.enrollment_id=e.id
          and n.credential_version=c.credential_version
        where e.id='${spec.enrollment}' and e.gateway_id='${spec.id}' and c.credential_state='ACTIVE'
          and e.active_runtime_instance_id is not null and e.last_seen_at>= (e.metadata->>'home_qa_key_prepared_at')::timestamptz
          and n.observed_at>= (e.metadata->>'home_qa_key_prepared_at')::timestamptz)
      then raise exception 'P38_HOME_QA_REAL_COMPONENT_PROOF_MISSING'; end if;
    end $$;
    update public.video_gateway_device_enrollments e set metadata=e.metadata||jsonb_build_object(
      'home_qa_phase','MANAGED_IDENTITY_VERIFIED',
      'home_qa_proof_sha256',(select encode(digest(c.public_key_spki||n.nonce_hash,'sha256'),'hex')
       from public.observer_managed_device_credentials c
       join public.observer_managed_device_auth_nonces n on n.enrollment_id=c.enrollment_id
       where c.enrollment_id=e.id and c.credential_state='ACTIVE'
       order by n.observed_at desc limit 1)) where e.id='${spec.enrollment}';
    ${profile === "SOFTWARE_CONNECTOR" ? `update public.observer_edge_rollouts set status='PAUSED'
      where status='ACTIVE' and release_id=(select id from public.observer_edge_releases
        where release_id='qa-connector-legacy-transition-v2-6e7988808b05');
      update public.observer_edge_rollouts set status='ACTIVE'
      where status='DRAFT' and release_id=(select id from public.observer_edge_releases
        where release_id='qa-p38-health-connector-1b076f596574');` : ""}
    commit;`;
  try { run(["exec", "-i", container, "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], sql); }
  catch { throw new Error("P38_HOME_QA_MANAGED_PROOF_DATABASE_FAILED"); }
  console.log(JSON.stringify({ status: "MANAGED_IDENTITY_VERIFIED", profile,
    exact_rollout: profile === "SOFTWARE_CONNECTOR" ? "REMEDIATION_ACTIVE" : "GATEWAY_PREBOOTSTRAP_ACTIVE",
    production_writes: 0 }));
}
