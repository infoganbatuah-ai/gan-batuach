// Bind a one-time, domain-separated transition verification key to each exact
// QA record. Only PUBLIC keys reach the QA database. Product is read-only.
import { execFileSync } from "node:child_process";
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createKeychainStore } from "../../services/video-gateway/keychain-store.mjs";
import { deriveHomeQaLegacyProofKey } from "../../services/video-gateway/home-qa-legacy-proof.mjs";

const evidencePath = process.argv.find(arg => arg.startsWith("--evidence="))?.slice(11);
const expectedDigest = process.argv.find(arg => arg.startsWith("--sha256="))?.slice(9);
const apply = process.argv.includes("--apply");
if (!evidencePath || !/^[a-f0-9]{64}$/.test(expectedDigest || ""))
  throw new Error("P38_LEGACY_PROOF_PINNED_EVIDENCE_REQUIRED");
const restricted = realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted") + sep;
const path = realpathSync(resolve(evidencePath));
if (!path.startsWith(restricted) || (statSync(path).mode & 0o077) !== 0)
  throw new Error("P38_LEGACY_PROOF_RESTRICTED_EVIDENCE_REQUIRED");
const raw = readFileSync(path);
if (createHash("sha256").update(raw).digest("hex") !== expectedDigest)
  throw new Error("P38_LEGACY_PROOF_EVIDENCE_CHANGED");
const evidence = JSON.parse(raw.toString("utf8"));
if (evidence.protocol !== "observer-push38-home-identity-reconciliation-v1" ||
  evidence.devices?.length !== 2 || evidence.site?.id !== "cc1673b8-3eb0-4785-a12c-1fb88f425a41" ||
  Date.now() - Date.parse(evidence.observed_at) > 30 * 60_000)
  throw new Error("P38_LEGACY_PROOF_EVIDENCE_INVALID_OR_STALE");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("P38_LEGACY_PROOF_PRODUCT_READ_REQUIRED");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const keychain = createKeychainStore({ service: "com.ganbatuach.video-gateway.runtime" });
const connectorTokenPath = "/Users/danielderi/Library/Application Support/Digital Observer/Tapo Connector/secrets/device_refresh_token";
const bindings = [];
for (const row of evidence.devices) {
  const token = row.profile === "PHYSICAL_GATEWAY" ? await keychain.read("device_refresh_token") :
    readFileSync(connectorTokenPath, "utf8").trim();
  const product = await db.from("video_gateway_device_enrollments")
    .select("id,gateway_id,observer_site_id,tenant_id,deployment_profile,status,lifecycle_state,identity_scheme,refresh_token_hash")
    .eq("id", row.enrollment_id).eq("gateway_id", row.device_id).limit(2);
  if (product.error || product.data?.length !== 1) throw new Error("P38_LEGACY_PROOF_PRODUCT_ENROLLMENT_UNAVAILABLE");
  const p = product.data[0];
  const candidate = createHash("sha256").update(token, "utf8").digest();
  const stored = Buffer.from(p.refresh_token_hash || "", "hex");
  if (stored.length !== candidate.length || !timingSafeEqual(candidate, stored) ||
    p.status !== "delivered" || p.lifecycle_state !== "ACTIVE" || p.identity_scheme !== "LEGACY_HMAC" ||
    p.observer_site_id !== row.site_id || p.tenant_id !== row.tenant_id ||
    p.deployment_profile !== row.profile) throw new Error("P38_LEGACY_PROOF_PRODUCT_BINDING_CHANGED");
  const localSigningSecret = row.profile === "PHYSICAL_GATEWAY" ? await keychain.read("gateway_signing_secret") :
    readFileSync("/Users/danielderi/Library/Application Support/Digital Observer/Tapo Connector/secrets/gateway_signing_secret", "utf8").trim();
  const pair = deriveHomeQaLegacyProofKey({ localSigningSecret, device_id: row.device_id,
    enrollment_id: row.enrollment_id, site_id: row.site_id, tenant_id: row.tenant_id,
    profile: row.profile });
  bindings.push({ enrollment_id: row.enrollment_id, device_id: row.device_id,
    public_key_spki: pair.publicKeySpki,
    public_key_sha256: createHash("sha256").update(Buffer.from(pair.publicKeySpki, "base64url")).digest("hex") });
}
if (!apply) {
  console.log(JSON.stringify({ status: "VERIFIED_NOT_BOUND", devices: bindings.map(({ device_id, public_key_sha256 }) =>
    ({ device_id, public_key_sha256 })), product_writes: 0, runtime_writes: 0,
    private_key_exported: false }));
  process.exit(0);
}
const context = "colima-push38t", project = "gan-batuach-push38t", container = `supabase_db_${project}`;
const docker = args => execFileSync("docker", ["--context", context, ...args],
  { encoding: "utf8", timeout: 45_000, stdio: ["ignore", "pipe", "pipe"] });
const labels = JSON.parse(docker(["inspect", "--format", "{{json .Config.Labels}}", container]));
if (labels["com.supabase.cli.project"] !== project) throw new Error("P38_LEGACY_PROOF_WRONG_DATABASE");
const network = docker(["network", "inspect", "push38t-loopback", "--format",
  "{{index .Options \"com.docker.network.bridge.host_binding_ipv4\"}}"]).trim();
if (network !== "127.0.0.1") throw new Error("P38_LEGACY_PROOF_DATABASE_NOT_LOOPBACK");
const payload = Buffer.from(JSON.stringify(bindings), "utf8").toString("hex");
const sql = `begin;
create temp table p38_keys on commit drop as
  select * from jsonb_to_recordset(convert_from(decode('${payload}','hex'),'UTF8')::jsonb)
  as x(enrollment_id uuid,device_id uuid,public_key_spki text,public_key_sha256 text);
do $$ begin
  if (select count(*) from p38_keys) <> 2 or
    (select count(*) from public.video_gateway_device_enrollments) <> 2 or
    exists(select 1 from p38_keys k left join public.video_gateway_device_enrollments e
      on e.id=k.enrollment_id where e.gateway_id is distinct from k.device_id or
      e.status <> 'pending' or e.identity_scheme <> 'LEGACY_HMAC' or
      e.metadata->>'home_qa_phase' <> 'LEGACY_VERIFIED_FOR_TRANSITION' or
      (e.metadata ? 'home_qa_legacy_public_key_spki' and
        e.metadata->>'home_qa_legacy_public_key_spki' is distinct from k.public_key_spki))
  then raise exception 'P38_LEGACY_PROOF_QA_STATE_CONFLICT'; end if;
end $$;
update public.video_gateway_device_enrollments e set
  metadata=e.metadata || jsonb_build_object('home_qa_legacy_public_key_spki',k.public_key_spki,
    'home_qa_legacy_public_key_sha256',k.public_key_sha256,
    'home_qa_legacy_proof_bound_at',now()::text,
    'home_qa_legacy_proof_expires_at',(now()+interval '2 hours')::text)
from p38_keys k where e.id=k.enrollment_id;
do $$ begin
  if exists(select 1 from p38_keys k left join public.video_gateway_device_enrollments e
    on e.id=k.enrollment_id where e.metadata->>'home_qa_legacy_public_key_spki' <> k.public_key_spki or
    e.metadata->>'home_qa_legacy_public_key_sha256' <> k.public_key_sha256)
  then raise exception 'P38_LEGACY_PROOF_QA_BINDING_FAILED'; end if;
end $$;
commit;`;
execFileSync("docker", ["--context", context, "exec", "-i", container, "psql", "-X", "-q",
  "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
{ input: sql, encoding: "utf8", timeout: 45_000, stdio: ["pipe", "pipe", "pipe"] });
console.log(JSON.stringify({ status: "PUBLIC_TRANSITION_PROOFS_BOUND", devices: 2,
  product_writes: 0, runtime_writes: 0, private_key_exported: false }));
