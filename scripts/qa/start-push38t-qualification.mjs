import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";

const root = resolve(import.meta.dirname, "../..");
const projectId = "gan-batuach-push38t";
const dockerContext = "colima-push38t";
const container = `supabase_db_${projectId}`;
const baseEnv = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  DOCKER_CONTEXT: dockerContext };
const run = (command, args) => execFileSync(command, args, { cwd: root, env: baseEnv,
  encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] });
const enableLegacyDelivery = process.argv.includes("--enable-legacy-delivery");
function r2Credentials() {
  const service = "digital-observer-r2-home-qa-reader-20260922";
  const keychain = join(homedir(), "Library/Keychains/login.keychain-db");
  const opts = { encoding: "utf8", timeout: 45_000, maxBuffer: 16_384,
    stdio: ["ignore", "pipe", "ignore"] };
  const account = execFileSync("/usr/bin/security", ["find-generic-password", "-s", service, keychain], opts)
    .match(/"acct"<blob>=(?:0x[0-9A-Fa-f]+\s+)?"([\s\S]*?)"/)?.[1]?.replace(/\\012|\\n/g, "\n").trim();
  const raw = execFileSync("/usr/bin/security", ["find-generic-password", "-s", service, "-w", keychain], opts).trim();
  const decoded = /^(?:[a-fA-F0-9]{2})+$/.test(raw) ? Buffer.from(raw, "hex").toString("utf8").trim() : "";
  const secret = /^[a-fA-F0-9]{64}$/.test(raw) ? raw : /^[a-fA-F0-9]{64}$/.test(decoded) ? decoded : "";
  if (!/^[a-f0-9]{32}$/.test(account || "") || !secret) throw new Error("P38_QA_R2_KEYCHAIN_UNAVAILABLE");
  return { accessKeyId: account, secretAccessKey: secret };
}
// A separate Docker context and project label are mandatory. No linked-cloud
// Supabase URL or inherited provider credential may reach the QA process.
const labels = JSON.parse(run("docker", ["--context", dockerContext, "inspect", "--format",
  "{{json .Config.Labels}}", container]));
if (labels["com.supabase.cli.project"] !== projectId) throw new Error("Wrong QA database container");
const variables = Object.fromEntries(run("supabase", ["status", "--workdir", root, "--output", "env"])
  .split("\n").filter(line => /^[A-Z][A-Z0-9_]*=/.test(line)).map(line => {
    const separator = line.indexOf("=");
    const raw = line.slice(separator + 1);
    return [line.slice(0, separator), raw.startsWith('"') ? JSON.parse(raw) : raw];
  }));
if (variables.API_URL !== "http://127.0.0.1:56421" ||
  !variables.DB_URL?.includes("127.0.0.1:56422") ||
  !variables.SERVICE_ROLE_KEY || !variables.PUBLISHABLE_KEY)
  throw new Error("QA stack URL or credentials are incomplete or non-local");
run(process.execPath, ["scripts/qa/start-push38t-rest-loopback.mjs"]);

const releaseEnv = {};
if (enableLegacyDelivery) {
  const inventory = JSON.parse(run("docker", ["--context", dockerContext, "exec", container, "psql",
    "-X", "-A", "-t", "-U", "postgres", "-d", "postgres", "-c",
    `select json_build_object(
      'devices',coalesce((select json_agg(json_build_object(
        'id',gateway_id,'profile',deployment_profile,'status',status,
        'identity_scheme',identity_scheme,'credential_version',credential_version,
        'lifecycle_state',lifecycle_state,'tenant_id',tenant_id,'site_id',observer_site_id,
        'phase',metadata->>'home_qa_phase') order by deployment_profile)
        from public.video_gateway_device_enrollments),'[]'::json),
      'releases',(select count(*) from public.observer_edge_releases where channel='HOME_QA'),
      'broad_rollouts',(select count(*) from public.observer_edge_rollouts where cohort_percent<>0));`]).trim());
  const expected = new Map([
    ["db267b52-6282-4944-bcee-5d4857698fb0", "SOFTWARE_CONNECTOR"],
    ["62df97e2-3c0b-427f-9108-bde029bc10e7", "PHYSICAL_GATEWAY"]
  ]);
  const siteId = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
  const phaseMatchesIdentity = device => device.phase === "LEGACY_VERIFIED_FOR_TRANSITION"
    ? device.status === "pending" && device.identity_scheme === "LEGACY_HMAC" && device.credential_version === 0
    : ["MANAGED_IDENTITY_PENDING_PROOF", "MANAGED_IDENTITY_VERIFIED"].includes(device.phase) &&
      device.status === "delivered" && device.identity_scheme === "ED25519_V1" && device.credential_version === 1;
  const inventoryReady = Array.isArray(inventory.devices) && inventory.devices.length === expected.size &&
    inventory.devices.every(device => expected.get(device.id) === device.profile &&
      device.lifecycle_state === "ACTIVE" && device.tenant_id === siteId && device.site_id === siteId &&
      phaseMatchesIdentity(device)) && inventory.releases === 4 && inventory.broad_rollouts === 0;
  if (!inventoryReady) throw new Error("P38_QA_RELEASE_METADATA_NOT_READY");
  const keys = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
  if (!keys["observer-kms-release-v1"] || !keys["qa-p38f-ed25519-20260913"])
    throw new Error("P38_QA_PROTECTED_TRUST_UNAVAILABLE");
  const r2 = r2Credentials();
  Object.assign(releaseEnv, {
    OBSERVER_HOME_QA_LEGACY_TRANSITION: "enabled", OBSERVER_EDGE_PRIVATE_RELEASE_DELIVERY: "enabled",
    OBSERVER_EDGE_R2_ACCOUNT_ID: "693f824a750afcc264fe6ee58c8a86ab",
    OBSERVER_EDGE_R2_READ_ACCESS_KEY_ID: r2.accessKeyId,
    OBSERVER_EDGE_R2_READ_SECRET_ACCESS_KEY: r2.secretAccessKey,
    OBSERVER_EDGE_RELEASE_PUBLIC_KEYS_JSON: JSON.stringify(keys)
  });
}

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], {
  cwd: root,
  env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
    NODE_ENV: "development", APP_ENV: "local", NEXT_PUBLIC_APP_ENV: "local",
    OBSERVER_PUSH38_QUALIFICATION: "enabled", OBSERVER_EDGE_PRIVATE_RELEASE_DELIVERY: "disabled",
    ...releaseEnv,
    NEXT_PUBLIC_SUPABASE_URL: variables.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: variables.PUBLISHABLE_KEY,
    // Server-only loopback adapter bypasses a local Kong 2.8 header-template
    // defect. It is not published and preserves the real service-role JWT.
    SUPABASE_ADMIN_URL: "http://127.0.0.1:56431",
    SUPABASE_SERVICE_ROLE_KEY: variables.SERVICE_ROLE_KEY,
    VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET: randomBytes(48).toString("base64url") },
  stdio: "inherit"
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code ?? 1; });
console.log(JSON.stringify({ environment: "PUSH38T_QUALIFICATION", projectId,
  url: "http://127.0.0.1:3100", productionAccess: false,
  releaseDelivery: enableLegacyDelivery ? "ENABLED_LOCAL_QA_ONLY" : "DISABLED_UNTIL_ENROLLMENT" }));
