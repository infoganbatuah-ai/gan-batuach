#!/usr/bin/env node
// Disposable architecture probe only: synthetic sentinel; never Development data.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFreshIsolatedTarget, COMPONENT_FILES, verifyComponentCiphertexts } from "./component-restore-preflight.mjs";
import { createComponentReceipt } from "./component-backup-contract.mjs";
import { verifyDecryptedStorageTar } from "./verify-decrypted-storage-tar.mjs";

const worktree = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const cachedBase = "/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/cache/caches/b0992ab88f5a3c0c436bbb3065c01466f20dc1dd0eb0a60299d410176f21a1c3";
const sourceDocker = "unix:///Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima/gbi/docker.sock";
const pgImage = "public.ecr.aws/supabase/postgres:17.6.1.167";
const pgImageId = "sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb";
const scratch = mkdtempSync(join(worktree, ".restore-architecture-qa."));
const image = join(scratch, "target.sparsebundle");
const mount = mkdtempSync("/private/tmp/do-restore-qa.");
const secret = randomBytes(48).toString("base64url");
const guest = "isolated-restore-qa";
let attached = false;
let started = false;
let startAttempted = false;
let cleanupSafe = false;
const evidence = { status: "BLOCKED", reason: null, targetImagePath: image,
  encrypted: false, isolatedHome: false, guestDiskInsideEncryptedVolume: false,
  noHostMounts: false, noProxyEnv: false, guestHasDefaultRoute: null,
  guestIpv4OutputDrop: false, guestIpv6OutputDrop: false,
  guestIpv4ForwardDrop: false, guestIpv6ForwardDrop: false,
  managementSurvivedFirewall: false, dnsHasNoAllowRule: false,
  ipv4EgressProbeDenied: false, ipv6EgressProbeDenied: false,
  dnsResolutionProbeDenied: false, egressProbesDeniedAfterReboot: false,
  firewallPersistence: "NOT_TESTED", bootRouteAbsentBeforePolicy: false,
  bootIpv6RouteAbsentBeforePolicy: false,
  rebootVerified: false, postgresSentinelAfterReboot: false,
  storageSentinelAfterReboot: false, sentinelRecoveredAfterReattach: false,
  postgresRestoredFromCustomDump: false, storageRestoredFromTar: false,
  preflightAcceptedFreshMeasuredProof: false,
  syntheticFiveAgeCaptured: false, syntheticCiphertextSetVerified: false,
  syntheticFiveAgeAuthenticated: false, syntheticStorageTarGatePassed: false,
  syntheticNegativeCasesPassed: false, syntheticComponentScratchCleaned: false,
  syntheticAgeGlobalsRestored: false, syntheticAgeThreeDatabasesRestored: false,
  syntheticAgeAuthRolesRlsMigrationsVerified: false,
  syntheticAgeStorageMetadataBytesMatched: false, syntheticRestoreFaultCleaned: false,
  syntheticGuestStageCleaned: false,
  syntheticPhase: "NOT_STARTED",
  postgresTool: false, pgNetworkNone: false, storageNetworkNone: false,
  postgresVersion: null, pgSentinel: false, storageSentinel: false,
  originalVolumesAbsent: false, payloadHiddenAfterDetach: false, scratchCleaned: false };

function run(bin, args, { input, env, timeout = 30000, allowFailure = false } = {}) {
  const result = spawnSync(bin, args, {
    input, env: env ? { ...process.env, ...env } : process.env,
    encoding: "utf8", timeout, maxBuffer: 2_000_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${bin.split("/").at(-1)} exited ${result.status}: ${result.stderr.trim().slice(0, 800)}`);
  }
  return result;
}
function guestRun(args, env, timeout = 30000) {
  return run("/opt/homebrew/bin/limactl", ["shell", guest, "--", ...args], { env, timeout });
}
function guestDocker(args, env, timeout = 30000) {
  return guestRun(["sudo", "docker", ...args], env, timeout);
}
function binary(bin, args, { input, env, timeout = 30000, allowFailure = false } = {}) {
  const result = spawnSync(bin, args, { input, env: env ? { ...process.env, ...env } : process.env,
    encoding: null, timeout, maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure)
    throw new Error(`SYNTHETIC_BINARY_COMMAND_FAILED:${bin.split("/").at(-1)}:${result.status}`);
  return result;
}
function guestDockerBinary(args, env) {
  const result = binary("/opt/homebrew/bin/limactl", ["shell", guest, "--", "sudo", "docker", ...args],
    { env, timeout: 60000, allowFailure: true });
  if (result.status !== 0) {
    // The guest contains synthetic data only. Keep only bounded command stderr;
    // never log stdout, which may contain a dump or archive.
    const diagnostic = result.stderr.toString("utf8").trim().replace(/[^a-zA-Z0-9_ .:/-]/g, "?").slice(0, 180);
    throw new Error(`SYNTHETIC_GUEST_CAPTURE_FAILED:${result.status}:${diagnostic}`);
  }
  return result.stdout;
}
async function detachScratchMount() {
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = run("/usr/bin/hdiutil", ["detach", mount],
      { timeout: 60000, allowFailure: true });
    if (result.status === 0) return true;
    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
  }
  return false;
}
const sha256 = value => createHash("sha256").update(value).digest("hex");
function syntheticIdentity() {
  const generated = binary("/opt/homebrew/bin/age-keygen", []).stdout;
  const privateMatch = generated.toString("ascii").match(/^AGE-SECRET-KEY-1[A-Z0-9]+$/m);
  const publicMatch = generated.toString("ascii").match(/^# public key: (age1[023456789acdefghjklmnpqrstuvwxyz]+)$/m);
  assert.ok(privateMatch && publicMatch, "SYNTHETIC_AGE_IDENTITY_INVALID");
  const key = Buffer.from(privateMatch[0], "ascii");
  generated.fill(0);
  return { key, recipient: publicMatch[1] };
}
function syntheticDecrypt(directory, ciphertext, output, key, expectedSuccess) {
  const input = Buffer.concat([key, Buffer.from("\n")]);
  try {
    const result = binary("/usr/bin/python3", [join(dirname(fileURLToPath(import.meta.url)),
      "synthetic-age-pty-fd-decrypt.py"), "--synthetic-decrypt", directory, ciphertext, output],
    { input, timeout: 30000, allowFailure: true });
    assert.equal(result.status === 0, expectedSuccess, "SYNTHETIC_AGE_AUTH_RESULT_MISMATCH");
    assert.equal(existsSync(output), expectedSuccess, "SYNTHETIC_PARTIAL_PLAINTEXT_LEAK");
  } finally { input.fill(0); }
}
function firewallRules(family, chain, env) {
  return guestRun(["sudo", family, "-S", chain], env).stdout.trim().split(/\r?\n/);
}
function verifyFirewall(env, peerIp, guestSshPort) {
  const v4out = firewallRules("iptables", "OUTPUT", env);
  const v6out = firewallRules("ip6tables", "OUTPUT", env);
  const v4forward = firewallRules("iptables", "FORWARD", env);
  const v6forward = firewallRules("ip6tables", "FORWARD", env);
  const managementRule = `-A OUTPUT -d ${peerIp}/32 -p tcp -m tcp --sport ${guestSshPort} -m conntrack --ctstate ESTABLISHED -j ACCEPT`;
  evidence.guestIpv4OutputDrop = v4out[0] === "-P OUTPUT DROP" &&
    v4out.includes("-A OUTPUT -o lo -j ACCEPT") && v4out.includes(managementRule) &&
    v4out.filter(line => line.startsWith("-A OUTPUT ")).length === 2;
  evidence.guestIpv6OutputDrop = JSON.stringify(v6out) ===
    JSON.stringify(["-P OUTPUT DROP", "-A OUTPUT -o lo -j ACCEPT"]);
  evidence.guestIpv4ForwardDrop = v4forward.find(line => line.startsWith("-A FORWARD ")) === "-A FORWARD -j DROP";
  evidence.guestIpv6ForwardDrop = v6forward.find(line => line.startsWith("-A FORWARD ")) === "-A FORWARD -j DROP";
  evidence.dnsHasNoAllowRule = [...v4out, ...v6out].every(line => !/--dport 53.*-j ACCEPT/.test(line));
  assert.ok(evidence.guestIpv4OutputDrop && evidence.guestIpv6OutputDrop &&
    evidence.guestIpv4ForwardDrop && evidence.guestIpv6ForwardDrop &&
    evidence.dnsHasNoAllowRule, "GUEST_EGRESS_POLICY_NOT_FAIL_CLOSED");
}
function verifyDeniedEgress(env) {
  // These probes run before any source data is present. Policy inspection alone
  // cannot establish that packets are denied on the actual guest path.
  guestRun(["sh", "-lc", "command -v timeout >/dev/null && command -v bash >/dev/null && command -v getent >/dev/null"], env);
  const denied = args => {
    const result = run("/opt/homebrew/bin/limactl", ["shell", guest, "--", ...args],
      { env, timeout: 10000, allowFailure: true });
    return result.status !== 0 && result.status !== null && !result.error;
  };
  const ipv4 = denied(["timeout", "3", "bash", "-c", "exec 3<>/dev/tcp/1.1.1.1/443"]);
  const ipv6 = denied(["timeout", "3", "bash", "-c", "exec 3<>/dev/tcp/2606:4700:4700::1111/443"]);
  const dns = denied(["timeout", "3", "getent", "ahostsv4", "cloudflare.com"]);
  assert.ok(ipv4 && ipv6 && dns, "GUEST_EGRESS_PROBE_SUCCEEDED");
  evidence.ipv4EgressProbeDenied = ipv4;
  evidence.ipv6EgressProbeDenied = ipv6;
  evidence.dnsResolutionProbeDenied = dns;
}

async function restoreSyntheticAgeComponents({ env, directory, storageBytes }) {
  const names = ["_supabase", "gan_batuach_baseline_builder_v2", "postgres"];
  const staged = Object.values(COMPONENT_FILES).map(file => `/tmp/do-qa-${file}.plain`);
  const containers = [];
  const psqlValue = (container, database, sql) => guestDocker(["exec", container,
    "psql", "-X", "-qAt", "-h", "/tmp", "-U", "qa_restore_admin", "-d", database,
    "-v", "ON_ERROR_STOP=1", "-c", sql], env).stdout.trim();
  function startTarget(volume) {
    guestDocker(["volume", "create", volume], env);
    guestDocker(["run", "--rm", "--network", "none", "--pull", "never", "--user", "root",
      "--volume", `${volume}:/data`, "--entrypoint", "/bin/sh", pgImage,
      "-ec", "chown postgres:postgres /data"], env);
    const container = guestDocker(["run", "--detach", "--rm", "--network", "none", "--pull", "never",
      "--read-only", "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m", "--user", "postgres",
      "--volume", `${volume}:/var/lib/postgresql/data`, "--entrypoint", "/bin/sh", pgImage,
      "-ec", "initdb -D /var/lib/postgresql/data -U qa_restore_admin -A trust --no-instructions >/dev/null && exec postgres -D /var/lib/postgresql/data -c listen_addresses= -c unix_socket_directories=/tmp"],
    env, 60000).stdout.trim();
    assert.match(container, /^[0-9a-f]{64}$/);
    containers.push(container);
    assert.equal(guestDocker(["inspect", container, "--format", "{{.HostConfig.NetworkMode}}"],
      env).stdout.trim(), "none", "SYNTHETIC_RESTORE_CONTAINER_NETWORKED");
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      const check = run("/opt/homebrew/bin/limactl", ["shell", guest, "--", "sudo", "docker",
        "exec", container, "pg_isready", "-h", "/tmp", "-U", "qa_restore_admin"],
      { env, timeout: 10000, allowFailure: true });
      if (check.status === 0) { ready = true; break; }
    }
    assert.ok(ready, "SYNTHETIC_AGE_RESTORE_POSTGRES_NOT_READY");
    return container;
  }
  try {
    evidence.syntheticPhase = "STAGE_AUTHENTICATED_COMPONENTS";
    for (const file of Object.values(COMPONENT_FILES)) {
      run("/opt/homebrew/bin/limactl", ["copy", "--backend=scp",
        join(directory, `${file}.plain`), `${guest}:/tmp/do-qa-${file}.plain`],
      { env, timeout: 30000 });
    }
    evidence.syntheticPhase = "RESTORE_GLOBALS_AND_DATABASES";
    for (const [index, database] of names.entries()) {
      const volume = `qa_age_restored_${index}`;
      const container = startTarget(volume);
      guestRun(["bash", "-o", "pipefail", "-c",
        `cat /tmp/do-qa-globals.age.plain | sudo docker exec -i ${container} psql -X -v ON_ERROR_STOP=1 -U qa_restore_admin -h /tmp -d postgres`],
      env, 60000);
      assert.equal(psqlValue(container, "postgres",
        "SELECT count(*) FROM pg_roles WHERE rolname IN ('postgres','qa_restored_reader');"), "2");
      if (database !== "postgres") guestDocker(["exec", container, "createdb", "-h", "/tmp",
        "-U", "qa_restore_admin", database], env);
      guestRun(["bash", "-o", "pipefail", "-c",
        `cat /tmp/do-qa-${database}.age.plain | sudo docker exec -i ${container} pg_restore --single-transaction --exit-on-error -U qa_restore_admin -h /tmp -d ${database}`],
      env, 60000);
      assert.equal(psqlValue(container, database, "SELECT value FROM qa_sentinel;"), "synthetic-only");
      assert.equal(psqlValue(container, database,
        "SELECT version FROM supabase_migrations.schema_migrations;"), "synthetic_0001");
      if (database === "postgres") {
        assert.equal(psqlValue(container, database, "SELECT id FROM auth.users;"), "synthetic-user-1");
        assert.equal(psqlValue(container, database,
          "SELECT relrowsecurity FROM pg_class WHERE oid='qa_contract.secure_record'::regclass;"), "t");
        assert.equal(psqlValue(container, database,
          "SELECT count(*) FROM pg_policies WHERE schemaname='qa_contract' AND tablename='secure_record' AND policyname='qa_tenant_select';"), "1");
        assert.equal(psqlValue(container, database,
          "SELECT has_table_privilege('qa_restored_reader','qa_contract.secure_record','SELECT');"), "t");
        assert.equal(psqlValue(container, database,
          "SET ROLE qa_restored_reader; SELECT string_agg(value, ',') FROM qa_contract.secure_record;"), "allowed");
        const metadata = psqlValue(container, database,
          "SELECT name || ':' || bytes || ':' || sha256 FROM storage.objects;");
        assert.equal(metadata, `object:${storageBytes.length}:${sha256(storageBytes)}`);
      }
    }
    evidence.syntheticAgeGlobalsRestored = true;
    evidence.syntheticAgeThreeDatabasesRestored = true;
    evidence.syntheticAgeAuthRolesRlsMigrationsVerified = true;
    evidence.syntheticPhase = "RESTORE_STORAGE_FROM_AUTHENTICATED_TAR";
    guestDocker(["volume", "create", "qa_age_restored_storage"], env);
    guestRun(["bash", "-o", "pipefail", "-c",
      `cat /tmp/do-qa-storage-bytes.age.plain | sudo docker run --rm -i --network none --pull never --read-only --volume qa_age_restored_storage:/dest --entrypoint /bin/tar ${pgImage} -C /dest -xf -`],
    env, 60000);
    const recoveredObject = guestDockerBinary(["run", "--rm", "--network", "none", "--pull", "never",
      "--volume", "qa_age_restored_storage:/mnt:ro", "--entrypoint", "/bin/cat", pgImage,
      "/mnt/object"], env);
    assert.ok(recoveredObject.equals(storageBytes), "SYNTHETIC_STORAGE_METADATA_BYTE_MISMATCH");
    evidence.syntheticAgeStorageMetadataBytesMatched = true;
    evidence.syntheticPhase = "INJECT_MID_RESTORE_FAILURE";
    const faultContainer = startTarget("qa_age_fault_pgdata");
    // Commit the first restore phase, then fail the next one. The fault target
    // must not be reported complete and its partial role state must be removed.
    guestRun(["bash", "-o", "pipefail", "-c",
      `cat /tmp/do-qa-globals.age.plain | sudo docker exec -i ${faultContainer} psql -X -v ON_ERROR_STOP=1 -U qa_restore_admin -h /tmp -d postgres`],
    env, 60000);
    assert.equal(psqlValue(faultContainer, "postgres",
      "SELECT count(*) FROM pg_roles WHERE rolname IN ('postgres','qa_restored_reader');"), "2");
    const badDump = readFileSync(join(directory, "postgres.age.plain")).subarray(0, 64);
    writeFileSync(join(directory, "truncated-postgres.dump"), badDump,
      { mode: 0o600, flag: "wx" });
    run("/opt/homebrew/bin/limactl", ["copy", "--backend=scp",
      join(directory, "truncated-postgres.dump"), `${guest}:/tmp/do-qa-truncated-postgres.dump`],
    { env, timeout: 30000 });
    const fault = run("/opt/homebrew/bin/limactl", ["shell", guest, "--", "bash", "-o",
      "pipefail", "-c", `cat /tmp/do-qa-truncated-postgres.dump | sudo docker exec -i ${faultContainer} pg_restore --single-transaction --exit-on-error -U qa_restore_admin -h /tmp -d postgres`],
    { env, timeout: 30000, allowFailure: true });
    assert.notEqual(fault.status, 0, "SYNTHETIC_FAULT_RESTORE_ACCEPTED");
    guestDocker(["stop", faultContainer], env);
    containers.pop();
    guestDocker(["volume", "rm", "qa_age_fault_pgdata"], env);
    const residual = run("/opt/homebrew/bin/limactl", ["shell", guest, "--", "sudo", "docker",
      "volume", "inspect", "qa_age_fault_pgdata"], { env, timeout: 10000, allowFailure: true });
    assert.notEqual(residual.status, 0, "SYNTHETIC_FAULT_VOLUME_REMAINED");
    evidence.syntheticRestoreFaultCleaned = true;
  } finally {
    for (const container of containers.reverse()) {
      run("/opt/homebrew/bin/limactl", ["shell", guest, "--", "sudo", "docker", "stop", container],
        { env, timeout: 30000, allowFailure: true });
    }
    const toRemove = [...staged, "/tmp/do-qa-truncated-postgres.dump"];
    const removed = run("/opt/homebrew/bin/limactl", ["shell", guest, "--", "rm", "-f", ...toRemove],
      { env, timeout: 10000, allowFailure: true });
    evidence.syntheticGuestStageCleaned = removed.status === 0 && toRemove.every(path =>
      run("/opt/homebrew/bin/limactl", ["shell", guest, "--", "test", "!", "-e", path],
        { env, timeout: 10000, allowFailure: true }).status === 0);
  }
}

async function verifySyntheticFiveAgeComponents({ env, sourcePg, peerIp, guestSshPort }) {
  // All persistent fixture material lives on the disposable AES-256 mount.
  // The guest contains synthetic data only; neither original receipt nor owner
  // identity is accepted by this function.
  const directory = join(mount, "synthetic-components");
  mkdirSync(directory, { mode: 0o700 });
  writeFileSync(join(directory, ".synthetic-only"), "synthetic disposable QA\n",
    { mode: 0o600, flag: "wx" });
  const identity = syntheticIdentity();
  try {
    evidence.syntheticPhase = "PREPARE_DATABASES";
    for (const database of ["_supabase", "gan_batuach_baseline_builder_v2"]) {
      guestDocker(["exec", sourcePg, "createdb", "-h", "/tmp", "-U", "postgres", database], env);
      guestDocker(["exec", sourcePg, "psql", "-X", "-h", "/tmp", "-U", "postgres",
        "-d", database, "-v", "ON_ERROR_STOP=1", "-c",
        "CREATE TABLE qa_sentinel (value text NOT NULL); INSERT INTO qa_sentinel VALUES ('synthetic-only');"], env);
    }
    const storageBytes = Buffer.from("synthetic-storage-only", "utf8");
    guestDocker(["exec", sourcePg, "psql", "-X", "-h", "/tmp", "-U", "postgres",
      "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c",
      `CREATE ROLE qa_restored_reader NOLOGIN;
       CREATE SCHEMA auth;
       CREATE TABLE auth.users (id text PRIMARY KEY, email text NOT NULL);
       INSERT INTO auth.users VALUES ('synthetic-user-1', 'synthetic@example.invalid');
       CREATE SCHEMA storage;
       CREATE TABLE storage.objects (name text PRIMARY KEY, bytes integer NOT NULL, sha256 text NOT NULL);
       INSERT INTO storage.objects VALUES ('object', ${storageBytes.length}, '${sha256(storageBytes)}');
       CREATE SCHEMA qa_contract;
       CREATE TABLE qa_contract.secure_record (tenant text NOT NULL, value text NOT NULL);
       INSERT INTO qa_contract.secure_record VALUES ('synthetic-tenant', 'allowed'), ('other-tenant', 'denied');
       ALTER TABLE qa_contract.secure_record ENABLE ROW LEVEL SECURITY;
       CREATE POLICY qa_tenant_select ON qa_contract.secure_record FOR SELECT TO qa_restored_reader
         USING (tenant = 'synthetic-tenant');
       GRANT USAGE ON SCHEMA qa_contract TO qa_restored_reader;
       GRANT SELECT ON qa_contract.secure_record TO qa_restored_reader;`], env);
    for (const database of ["_supabase", "gan_batuach_baseline_builder_v2", "postgres"]) {
      guestDocker(["exec", sourcePg, "psql", "-X", "-h", "/tmp", "-U", "postgres",
        "-d", database, "-v", "ON_ERROR_STOP=1", "-c",
        "CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations (version text PRIMARY KEY); INSERT INTO supabase_migrations.schema_migrations VALUES ('synthetic_0001');"], env);
    }
    const storageManifest = { fileCount: 1, logicalFileBytes: storageBytes.length,
      crossStoreAtomicity: "NOT_PROVEN", sampledSourceFileManifest: [{
        pathDigest: sha256("object"), sha256: sha256(storageBytes), bytes: storageBytes.length,
      }] };
    const definitions = [
      ...["_supabase", "gan_batuach_baseline_builder_v2", "postgres"].map(database => ({
        id: `database:${database}`, kind: "database", name: database,
        produce: () => guestDockerBinary(["exec", sourcePg, "pg_dump", "-Fc", "-U", "postgres",
          "-h", "/tmp", "-d", database], env),
      })),
      { id: "globals", kind: "globals", produce: () => guestDockerBinary(["exec", sourcePg,
        "pg_dumpall", "--globals-only", "-U", "postgres", "-h", "/tmp"], env) },
      { id: "storage-bytes", kind: "storage-bytes", details: storageManifest,
        produce: () => guestDockerBinary(["run", "--rm", "--network", "none", "--pull", "never",
          "--volume", "qa_storage:/mnt:ro", "--entrypoint", "/bin/tar", pgImage,
          "-C", "/mnt", "-cf", "-", "."], env) },
    ];
    const builder = createComponentReceipt({ expectedDatabases: ["_supabase",
      "gan_batuach_baseline_builder_v2", "postgres"] });
    for (const definition of definitions) {
      evidence.syntheticPhase = `CAPTURE_${definition.id.replace(/[^a-z0-9]/gi, "_")}`;
      const startedAtUtc = new Date().toISOString();
      const plain = definition.produce();
      assert.ok(plain.length > 0 && plain.length < 8 * 1024 * 1024,
        "SYNTHETIC_COMPONENT_PLAINTEXT_CAP");
      if (definition.kind === "database") assert.ok(plain.subarray(0, 5).equals(Buffer.from("PGDMP")),
        "SYNTHETIC_DATABASE_DUMP_FORMAT");
      const encrypted = binary("/opt/homebrew/bin/age", ["-r", identity.recipient],
        { input: plain, timeout: 30000 }).stdout;
      plain.fill(0);
      const file = COMPONENT_FILES[definition.id];
      writeFileSync(join(directory, file), encrypted, { mode: 0o600, flag: "wx" });
      builder.addSuccess({ kind: definition.kind, name: definition.name, file,
        startedAtUtc, endedAtUtc: new Date().toISOString(), bytes: encrypted.length,
        ciphertextSha256: sha256(encrypted), details: definition.details });
    }
    evidence.syntheticFiveAgeCaptured = true;
    const expected = { expectedScope: "synthetic-disposable-guest",
      expectedRecipientSha256: sha256(identity.recipient), expectedSourceContainerId: sourcePg };
    const receipt = builder.receipt({ scope: expected.expectedScope,
      publicRecipientSha256: expected.expectedRecipientSha256,
      sourceContainerId: sourcePg, independentRestore: "NOT_RUN" });
    const receiptPath = join(directory, "receipt.json");
    writeFileSync(receiptPath, JSON.stringify(receipt), { mode: 0o600, flag: "wx" });
    evidence.syntheticPhase = "VERIFY_CIPHERTEXT_SET";
    // Recheck the same guest immediately before accepting its component set.
    verifyFirewall(env, peerIp, guestSshPort);
    verifyDeniedEgress(env);
    evidence.noHostMounts = guestRun(["sh", "-lc", "mount | grep -c 'virtiofs' || true"], env).stdout.trim() === "0";
    evidence.noProxyEnv = guestRun(["sh", "-lc",
      "env | cut -d= -f1 | grep -Eic '^(http_proxy|https_proxy|all_proxy|no_proxy)$' || true"], env).stdout.trim() === "0";
    evidence.originalVolumesAbsent = JSON.stringify(guestDocker(["volume", "ls", "--format", "{{.Name}}"],
      env).stdout.trim().split(/\r?\n/).sort()) === JSON.stringify(["qa_pgdata", "qa_storage"]);
    evidence.pgNetworkNone = guestDocker(["inspect", sourcePg, "--format",
      "{{.HostConfig.NetworkMode}}"], env).stdout.trim() === "none";
    evidence.checkedAtMs = Date.now();
    assertFreshIsolatedTarget(evidence);
    const verified = await verifyComponentCiphertexts(receiptPath,
      { ...expected, deadlineAt: Date.now() + 60_000 });
    assert.equal(verified.status, "CIPHERTEXT_SET_VERIFIED_NOT_DECRYPTED");
    assert.equal(verified.components.length, 5);
    evidence.syntheticCiphertextSetVerified = true;
    for (const definition of definitions) {
      evidence.syntheticPhase = `DECRYPT_${definition.id.replace(/[^a-z0-9]/gi, "_")}`;
      const file = COMPONENT_FILES[definition.id];
      const plaintext = join(directory, `${file}.plain`);
      syntheticDecrypt(directory, join(directory, file), plaintext, identity.key, true);
      if (definition.kind === "database") assert.equal(readFileSync(plaintext).subarray(0, 5).toString(), "PGDMP");
    }
    evidence.syntheticFiveAgeAuthenticated = true;
    evidence.syntheticPhase = "VERIFY_STORAGE_GATE";
    const storagePlain = join(directory, "storage-bytes.age.plain");
    const storageResult = await verifyDecryptedStorageTar(createReadStream(storagePlain), receipt);
    assert.equal(storageResult.status, "STORAGE_ARCHIVE_FILES_VERIFIED");
    evidence.syntheticStorageTarGatePassed = true;
    evidence.syntheticPhase = "NEGATIVE_CASES";
    const wrong = syntheticIdentity();
    try { syntheticDecrypt(directory, join(directory, "postgres.age"),
      join(directory, "wrong-key.plain"), wrong.key, false); }
    finally { wrong.key.fill(0); }
    for (const definition of definitions) {
      const file = COMPONENT_FILES[definition.id];
      const tampered = Buffer.from(readFileSync(join(directory, file)));
      tampered[tampered.length - 1] ^= 1;
      const tamperedPath = join(directory, `tampered-${file}`);
      writeFileSync(tamperedPath, tampered, { mode: 0o600, flag: "wx" });
      syntheticDecrypt(directory, tamperedPath, join(directory, `tampered-${file}.plain`),
        identity.key, false);
    }
    const badReceiptPath = join(directory, "bad-receipt.json");
    writeFileSync(badReceiptPath, JSON.stringify({ ...receipt,
      totalEncryptedBytes: receipt.totalEncryptedBytes + 1 }), { mode: 0o600, flag: "wx" });
    await assert.rejects(verifyComponentCiphertexts(badReceiptPath, expected),
      /RESTORE_CIPHERTEXT_TOTAL_MISMATCH/);
    await assert.rejects(verifyComponentCiphertexts(receiptPath,
      { ...expected, deadlineAt: Date.now() - 1 }), /RESTORE_PREFLIGHT_DEADLINE/);
    const corruptTar = Buffer.from(readFileSync(storagePlain));
    const sentinelOffset = corruptTar.indexOf(storageBytes);
    assert.ok(sentinelOffset >= 0, "SYNTHETIC_STORAGE_PAYLOAD_NOT_FOUND");
    corruptTar[sentinelOffset] ^= 1;
    const corruptCiphertext = binary("/opt/homebrew/bin/age", ["-r", identity.recipient],
      { input: corruptTar }).stdout;
    corruptTar.fill(0);
    const corruptPath = join(directory, "corrupt-storage.age");
    writeFileSync(corruptPath, corruptCiphertext, { mode: 0o600, flag: "wx" });
    const corruptPlain = join(directory, "corrupt-storage.plain");
    syntheticDecrypt(directory, corruptPath, corruptPlain, identity.key, true);
    await assert.rejects(verifyDecryptedStorageTar(createReadStream(corruptPlain), receipt),
      /TAR_FILE_HASH_MISMATCH/);
    evidence.syntheticNegativeCasesPassed = true;
    await restoreSyntheticAgeComponents({ env, directory, storageBytes });
    assert.ok(evidence.syntheticGuestStageCleaned, "SYNTHETIC_GUEST_STAGE_NOT_CLEANED");
    evidence.syntheticPhase = "COMPLETE";
  } finally {
    identity.key.fill(0);
    rmSync(directory, { recursive: true });
    evidence.syntheticComponentScratchCleaned = !existsSync(directory);
  }
}

try {
  assert.ok(existsSync(cachedBase), "LOCAL_BASE_IMAGE_MISSING");
  assert.ok(statSync(cachedBase).size > 300_000_000,
    "LOCAL_BASE_IMAGE_INVALID");
  run("/usr/bin/hdiutil", ["create", "-size", "12g", "-type", "SPARSEBUNDLE",
    "-encryption", "AES-256", "-stdinpass", "-fs", "APFS", "-volname",
    "DO_RESTORE_QA", "-nospotlight", image], { input: `${secret}\n`, timeout: 120000 });
  run("/usr/bin/hdiutil", ["attach", "-nobrowse", "-owners", "on", "-stdinpass", "-mountpoint", mount, image],
    { input: `${secret}\n`, timeout: 120000 });
  attached = true;
  const imageInfo = run("/usr/bin/hdiutil", ["info"]).stdout;
  assert.ok(imageInfo.includes(image), "SCRATCH_IMAGE_NOT_ATTACHED");
  const mountedEntry = imageInfo.slice(imageInfo.indexOf(image));
  const encryptionLine = mountedEntry.match(/^image-encrypted[^\n]*/m)?.[0] ?? "missing";
  assert.ok(/:\s*(true|yes)/i.test(encryptionLine),
    `SCRATCH_IMAGE_ENCRYPTION_UNVERIFIED:${encryptionLine}`);
  evidence.encrypted = true;
  const mountInfo = run("/usr/sbin/diskutil", ["info", mount]).stdout;
  const ownersLine = mountInfo.match(/^\s*Owners:\s*[^\n]*/m)?.[0] ?? "Owners: unknown";
  assert.ok(/Owners:\s*Enabled/i.test(ownersLine),
    `SCRATCH_VOLUME_OWNERSHIP_NOT_ENABLED:${ownersLine.trim()}`);

  const sentinel = join(mount, "synthetic-sentinel.txt");
  writeFileSync(sentinel, "synthetic restore sentinel only\n", { mode: 0o600, flag: "wx" });
  assert.equal(readFileSync(sentinel, "utf8"), "synthetic restore sentinel only\n");
  const limaHome = join(mount, "lima");
  mkdirSync(limaHome, { mode: 0o700 });
  const config = join(mount, "isolated-lima.yaml");
  writeFileSync(config, `vmType: vz\narch: aarch64\nimages:\n  - location: ${cachedBase}\n    arch: aarch64\ncpus: 2\nmemory: 2GiB\ndisk: 6GiB\nmounts: []\nnetworks: []\nportForwards: []\npropagateProxyEnv: false\ncontainerd:\n  system: false\n  user: false\nssh:\n  loadDotSSHPubKeys: false\n  forwardAgent: false\nhostResolver:\n  enabled: false\nprovision: []\n`, { mode: 0o600, flag: "wx" });
  const env = { LIMA_HOME: limaHome };
  run("/opt/homebrew/bin/limactl", ["validate", config], { env });
  evidence.isolatedHome = true;
  startAttempted = true;
  run("/opt/homebrew/bin/limactl", ["start", "--tty=false", "--name", guest,
    "--plain", "--mount-none", "--containerd", "none", config],
  { env, timeout: 180000 });
  started = true;
  const guestFiles = readdirSync(join(limaHome, guest));
  evidence.guestDiskInsideEncryptedVolume = guestFiles.some(name => /disk/i.test(name));
  assert.ok(evidence.guestDiskInsideEncryptedVolume, "SCRATCH_VM_DISK_NOT_INSIDE_ENCRYPTED_IMAGE");
  const guestState = guestRun(["sh", "-lc",
    "printf 'MOUNTS='; mount | grep -c 'virtiofs' || true; printf 'ROUTES='; ip -4 route | grep -c '^default ' || true; printf 'DOCKER='; command -v docker || true; printf 'POSTGRES='; command -v postgres || true"],
  env).stdout;
  evidence.noHostMounts = /MOUNTS=0(?:\r?\n|$)/.test(guestState);
  evidence.noProxyEnv = guestRun(["sh", "-lc",
    "env | cut -d= -f1 | grep -Eic '^(http_proxy|https_proxy|all_proxy|no_proxy)$' || true"], env).stdout.trim() === "0";
  evidence.guestHasDefaultRoute = /ROUTES=1(?:\r?\n|$)/.test(guestState);
  evidence.postgresTool = /(?:DOCKER|POSTGRES)=\//.test(guestState);
  assert.ok(evidence.noHostMounts, "GUEST_HAS_HOST_MOUNT");
  assert.ok(evidence.noProxyEnv, "GUEST_INHERITED_PROXY_ENV");
  assert.ok(evidence.postgresTool, "GUEST_HAS_NO_OFFLINE_POSTGRES_RUNTIME");

  // This scratch Docker daemon must not rewrite the forwarding chain after
  // the fail-closed rule is installed. Only --network none is used below.
  guestRun(["sudo", "test", "!", "-e", "/etc/docker/daemon.json"], env);
  const daemonConfig = join(mount, "docker-daemon-qa.json");
  writeFileSync(daemonConfig, '{"iptables":false,"ip6tables":false,"bridge":"none"}\n',
    { mode: 0o600, flag: "wx" });
  run("/opt/homebrew/bin/limactl", ["copy", "--backend=scp", daemonConfig,
    `${guest}:/tmp/docker-daemon-qa.json`], { env, timeout: 30000 });
  guestRun(["sudo", "install", "-o", "root", "-g", "root", "-m", "0644",
    "/tmp/docker-daemon-qa.json", "/etc/docker/daemon.json"], env);
  // Before any guest test data, start only the scratch guest's local Docker
  // daemon, then install the persistent firewall service.
  guestRun(["sudo", "systemctl", "start", "docker"], env, 30000);
  const sshParts = guestRun(["sh", "-lc", "printf '%s' \"$SSH_CONNECTION\""], env).stdout.trim().split(/\s+/);
  assert.equal(sshParts.length, 4, "GUEST_MANAGEMENT_PEER_UNKNOWN");
  const [peerIp, , , guestSshPort] = sshParts;
  assert.match(peerIp, /^(?:\d{1,3}\.){3}\d{1,3}$/);
  assert.match(guestSshPort, /^\d{1,5}$/);
  const initial4 = firewallRules("iptables", "OUTPUT", env);
  const initial6 = firewallRules("ip6tables", "OUTPUT", env);
  assert.deepEqual(initial4, ["-P OUTPUT ACCEPT"], "UNEXPECTED_GUEST_IPV4_OUTPUT_RULES");
  assert.deepEqual(initial6, ["-P OUTPUT ACCEPT"], "UNEXPECTED_GUEST_IPV6_OUTPUT_RULES");
  // This dedicated scratch guest may be discarded if management is lost.
  // Unlike the previous probe, there is no timer that can reopen egress.
  const lockScript = join(mount, "do-qa-egress-lock");
  const lockUnit = join(mount, "do-qa-egress-lock.service");
  writeFileSync(lockScript, `#!/bin/sh
set -eu
ip -4 route show default | wc -l > /run/do-qa-default-route-before-lock
ip -6 route show default | wc -l > /run/do-qa-ipv6-default-route-before-lock
iptables -I FORWARD 1 -j DROP
ip6tables -I FORWARD 1 -j DROP
iptables -C OUTPUT -o lo -j ACCEPT 2>/dev/null || iptables -A OUTPUT -o lo -j ACCEPT
ip6tables -C OUTPUT -o lo -j ACCEPT 2>/dev/null || ip6tables -A OUTPUT -o lo -j ACCEPT
iptables -C OUTPUT -d ${peerIp}/32 -p tcp --sport ${guestSshPort} -m conntrack --ctstate ESTABLISHED -j ACCEPT 2>/dev/null || iptables -A OUTPUT -d ${peerIp}/32 -p tcp --sport ${guestSshPort} -m conntrack --ctstate ESTABLISHED -j ACCEPT
iptables -P OUTPUT DROP
ip6tables -P OUTPUT DROP
`, { mode: 0o600, flag: "wx" });
  writeFileSync(lockUnit, `[Unit]
Description=Disposable QA fail-closed egress boundary
DefaultDependencies=no
After=local-fs.target
Before=sysinit.target network-pre.target systemd-networkd.service NetworkManager.service docker.service
Wants=network-pre.target
FailureAction=poweroff

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/do-qa-egress-lock
RemainAfterExit=yes

[Install]
WantedBy=sysinit.target
`, { mode: 0o600, flag: "wx" });
  run("/opt/homebrew/bin/limactl", ["copy", "--backend=scp", lockScript,
    `${guest}:/tmp/do-qa-egress-lock`], { env, timeout: 30000 });
  run("/opt/homebrew/bin/limactl", ["copy", "--backend=scp", lockUnit,
    `${guest}:/tmp/do-qa-egress-lock.service`], { env, timeout: 30000 });
  guestRun(["sudo", "install", "-o", "root", "-g", "root", "-m", "0700",
    "/tmp/do-qa-egress-lock", "/usr/local/sbin/do-qa-egress-lock"], env);
  guestRun(["sudo", "install", "-o", "root", "-g", "root", "-m", "0644",
    "/tmp/do-qa-egress-lock.service", "/etc/systemd/system/do-qa-egress-lock.service"], env);
  guestRun(["sudo", "systemctl", "daemon-reload"], env);
  guestRun(["sudo", "systemctl", "enable", "do-qa-egress-lock.service"], env);
  guestRun(["sudo", "systemctl", "start", "do-qa-egress-lock.service"], env);
  assert.equal(guestRun(["systemctl", "is-enabled", "do-qa-egress-lock.service"], env).stdout.trim(), "enabled");
  assert.equal(guestRun(["systemctl", "is-active", "do-qa-egress-lock.service"], env).stdout.trim(), "active");
  verifyFirewall(env, peerIp, guestSshPort);
  verifyDeniedEgress(env);
  guestRun(["true"], env);
  evidence.managementSurvivedFirewall = true;

  const localImageId = run("/opt/homebrew/bin/docker", ["-H", sourceDocker,
    "image", "inspect", pgImage, "--format", "{{.Id}}"], { timeout: 30000 }).stdout.trim();
  assert.equal(localImageId, pgImageId, "CACHED_POSTGRES_IMAGE_CHANGED");
  const imageTar = join(mount, "cached-postgres-image.tar");
  run("/opt/homebrew/bin/docker", ["-H", sourceDocker, "image", "save", "-o", imageTar, pgImage],
    { timeout: 120000 });
  run("/opt/homebrew/bin/limactl", ["copy", "--backend=scp", imageTar,
    `${guest}:/tmp/cached-postgres-image.tar`], { env, timeout: 120000 });
  guestDocker(["image", "load", "-i", "/tmp/cached-postgres-image.tar"], env, 120000);
  guestRun(["rm", "-f", "/tmp/cached-postgres-image.tar"], env);
  assert.equal(guestDocker(["image", "inspect", pgImage, "--format", "{{.Id}}"], env).stdout.trim(),
    pgImageId, "GUEST_POSTGRES_IMAGE_MISMATCH");
  const initialVolumes = guestDocker(["volume", "ls", "--format", "{{.Name}}"], env).stdout.trim();
  assert.equal(initialVolumes, "", "ISOLATED_GUEST_HAS_PREEXISTING_VOLUMES");

  guestDocker(["volume", "create", "qa_pgdata"], env);
  guestDocker(["run", "--rm", "--network", "none", "--pull", "never", "--user", "root",
    "--volume", "qa_pgdata:/data", "--entrypoint", "/bin/sh", pgImage,
    "-ec", "chown postgres:postgres /data"], env);
  const pg = guestDocker(["run", "--detach", "--rm", "--network", "none", "--pull", "never",
    "--read-only", "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m", "--user", "postgres",
    "--volume", "qa_pgdata:/var/lib/postgresql/data", "--entrypoint", "/bin/sh", pgImage,
    "-ec", "initdb -D /var/lib/postgresql/data -A trust --no-instructions >/dev/null && exec postgres -D /var/lib/postgresql/data -c listen_addresses= -c unix_socket_directories=/tmp"],
  env, 60000).stdout.trim();
  assert.match(pg, /^[0-9a-f]{64}$/);
  assert.equal(guestDocker(["inspect", pg, "--format", "{{.HostConfig.NetworkMode}}"], env).stdout.trim(), "none");
  evidence.pgNetworkNone = true;
  let pgReady = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    const readiness = run("/opt/homebrew/bin/limactl", ["shell", guest, "--", "sudo", "docker",
      "exec", pg, "pg_isready", "-h", "/tmp", "-U", "postgres"],
    { env, timeout: 10000, allowFailure: true });
    if (readiness.status === 0) { pgReady = true; break; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(pgReady, "ISOLATED_POSTGRES_NOT_READY");
  evidence.postgresVersion = guestDocker(["exec", pg, "psql", "-X", "-h", "/tmp", "-U",
    "postgres", "-d", "postgres", "-At", "-c", "SELECT current_setting('server_version');"], env).stdout.trim();
  assert.match(evidence.postgresVersion, /^17\.6(?:\s|$)/);
  guestDocker(["exec", pg, "psql", "-X", "-h", "/tmp", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-c", "CREATE TABLE qa_sentinel (value text NOT NULL); INSERT INTO qa_sentinel VALUES ('synthetic-only');"], env);
  const pgValue = guestDocker(["exec", pg, "psql", "-X", "-h", "/tmp", "-U", "postgres",
    "-d", "postgres", "-At", "-c", "SELECT value FROM qa_sentinel;"], env).stdout.trim();
  evidence.pgSentinel = pgValue === "synthetic-only";
  assert.ok(evidence.pgSentinel, "POSTGRES_SENTINEL_MISSING");

  guestDocker(["volume", "create", "qa_storage"], env);
  const storage = guestDocker(["run", "--detach", "--rm", "--network", "none", "--pull", "never",
    "--read-only", "--volume", "qa_storage:/mnt", "--entrypoint", "/bin/sh", pgImage,
    "-ec", "sleep 45"], env).stdout.trim();
  assert.match(storage, /^[0-9a-f]{64}$/);
  assert.equal(guestDocker(["inspect", storage, "--format", "{{.HostConfig.NetworkMode}}"], env).stdout.trim(), "none");
  evidence.storageNetworkNone = true;
  guestDocker(["exec", storage, "sh", "-ec", "printf synthetic-storage-only > /mnt/object"], env);
  evidence.storageSentinel = guestDocker(["exec", storage, "cat", "/mnt/object"], env).stdout.trim() === "synthetic-storage-only";
  assert.ok(evidence.storageSentinel, "STORAGE_SENTINEL_MISSING");
  const volumes = guestDocker(["volume", "ls", "--format", "{{.Name}}"], env).stdout.trim().split(/\r?\n/).sort();
  evidence.originalVolumesAbsent = JSON.stringify(volumes) === JSON.stringify(["qa_pgdata", "qa_storage"]);
  assert.ok(evidence.originalVolumesAbsent, "ORIGINAL_OR_UNEXPECTED_VOLUME_PRESENT");
  verifyFirewall(env, peerIp, guestSshPort); // Fail if Docker rewrote the forwarding boundary.
  guestDocker(["stop", storage, pg], env, 30000);
  const bootIdBefore = guestRun(["cat", "/proc/sys/kernel/random/boot_id"], env).stdout.trim();
  run("/opt/homebrew/bin/limactl", ["stop", guest], { env, timeout: 60000 });
  started = false;
  run("/opt/homebrew/bin/limactl", ["start", "--tty=false", guest], { env, timeout: 180000 });
  started = true;
  const bootIdAfter = guestRun(["cat", "/proc/sys/kernel/random/boot_id"], env).stdout.trim();
  assert.notEqual(bootIdAfter, bootIdBefore, "SCRATCH_VM_DID_NOT_REBOOT");
  assert.equal(guestRun(["systemctl", "is-active", "do-qa-egress-lock.service"], env).stdout.trim(), "active");
  verifyFirewall(env, peerIp, guestSshPort);
  verifyDeniedEgress(env);
  evidence.egressProbesDeniedAfterReboot = true;
  evidence.bootRouteAbsentBeforePolicy = guestRun(["cat", "/run/do-qa-default-route-before-lock"], env).stdout.trim() === "0";
  evidence.bootIpv6RouteAbsentBeforePolicy = guestRun(["cat", "/run/do-qa-ipv6-default-route-before-lock"], env).stdout.trim() === "0";
  assert.ok(evidence.bootRouteAbsentBeforePolicy, "NETWORK_ROUTE_PRECEDED_BOOT_FIREWALL");
  assert.ok(evidence.bootIpv6RouteAbsentBeforePolicy, "IPV6_ROUTE_PRECEDED_BOOT_FIREWALL");
  evidence.rebootVerified = true;
  evidence.firewallPersistence = "REAPPLIED_BEFORE_NETWORK_AFTER_REBOOT";
  guestRun(["sudo", "systemctl", "start", "docker"], env);
  verifyFirewall(env, peerIp, guestSshPort);
  const resumedPg = guestDocker(["run", "--detach", "--rm", "--network", "none", "--pull", "never",
    "--read-only", "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m", "--user", "postgres",
    "--volume", "qa_pgdata:/var/lib/postgresql/data", "--entrypoint", "/bin/sh", pgImage,
    "-ec", "exec postgres -D /var/lib/postgresql/data -c listen_addresses= -c unix_socket_directories=/tmp"],
  env, 60000).stdout.trim();
  assert.match(resumedPg, /^[0-9a-f]{64}$/);
  let resumedReady = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    const result = run("/opt/homebrew/bin/limactl", ["shell", guest, "--", "sudo", "docker",
      "exec", resumedPg, "pg_isready", "-h", "/tmp", "-U", "postgres"],
    { env, timeout: 10000, allowFailure: true });
    if (result.status === 0) { resumedReady = true; break; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(resumedReady, "REBOOTED_POSTGRES_NOT_READY");
  evidence.postgresSentinelAfterReboot = guestDocker(["exec", resumedPg, "psql", "-X", "-h", "/tmp", "-U",
    "postgres", "-d", "postgres", "-At", "-c", "SELECT value FROM qa_sentinel;"], env).stdout.trim() === "synthetic-only";
  evidence.storageSentinelAfterReboot = guestDocker(["run", "--rm", "--network", "none", "--pull", "never",
    "--volume", "qa_storage:/mnt:ro", "--entrypoint", "/bin/cat", pgImage, "/mnt/object"], env).stdout.trim() === "synthetic-storage-only";
  assert.ok(evidence.postgresSentinelAfterReboot && evidence.storageSentinelAfterReboot,
    "SYNTHETIC_SENTINEL_LOST_AFTER_REBOOT");
  evidence.noHostMounts = guestRun(["sh", "-lc", "mount | grep -c 'virtiofs' || true"], env).stdout.trim() === "0";
  evidence.noProxyEnv = guestRun(["sh", "-lc",
    "env | cut -d= -f1 | grep -Eic '^(http_proxy|https_proxy|all_proxy|no_proxy)$' || true"], env).stdout.trim() === "0";
  const rebootedVolumes = guestDocker(["volume", "ls", "--format", "{{.Name}}"], env).stdout.trim().split(/\r?\n/).sort();
  evidence.originalVolumesAbsent = JSON.stringify(rebootedVolumes) === JSON.stringify(["qa_pgdata", "qa_storage"]);
  evidence.pgNetworkNone = guestDocker(["inspect", resumedPg, "--format", "{{.HostConfig.NetworkMode}}"], env).stdout.trim() === "none";
  evidence.checkedAtMs = Date.now();
  assertFreshIsolatedTarget(evidence); // Measured in this guest, never loaded from an external receipt.
  evidence.preflightAcceptedFreshMeasuredProof = true;
  await verifySyntheticFiveAgeComponents({ env, sourcePg: resumedPg, peerIp, guestSshPort });
  // The authenticated five-component route supersedes the older unencrypted
  // direct-pipe sentinel restore; do not run a second, weaker restore.
  evidence.postgresRestoredFromCustomDump = evidence.syntheticAgeThreeDatabasesRestored;
  evidence.storageRestoredFromTar = evidence.syntheticAgeStorageMetadataBytesMatched;
  verifyFirewall(env, peerIp, guestSshPort);
  guestDocker(["stop", resumedPg], env);
  run("/opt/homebrew/bin/limactl", ["stop", guest], { env, timeout: 60000 });
  started = false;
  assert.ok(await detachScratchMount(), "SCRATCH_IMAGE_DETACH_FAILED");
  attached = false;
  assert.ok(!existsSync(sentinel), "SENTINEL_VISIBLE_AFTER_DETACH");
  run("/usr/bin/hdiutil", ["attach", "-nobrowse", "-owners", "on", "-stdinpass",
    "-mountpoint", mount, image], { input: `${secret}\n`, timeout: 120000 });
  attached = true;
  evidence.sentinelRecoveredAfterReattach = readFileSync(sentinel, "utf8") === "synthetic restore sentinel only\n" &&
    readdirSync(join(mount, "lima", guest)).some(name => /disk/i.test(name));
  assert.ok(evidence.sentinelRecoveredAfterReattach, "ENCRYPTED_VOLUME_SENTINEL_NOT_RECOVERED");
  evidence.status = "ARCHITECTURE_PROBE_PASS";
} catch (error) {
  evidence.reason = String(error.message).slice(0, 900);
} finally {
  if (startAttempted) {
    const env = { LIMA_HOME: join(mount, "lima") };
    const listed = run("/opt/homebrew/bin/limactl", ["list", "--json"],
      { env, timeout: 30000, allowFailure: true });
    if (listed.status !== 0) {
      started = true;
      evidence.reason = "SCRATCH_VM_STATUS_UNVERIFIED";
    } else {
      const guestInfo = listed.stdout.split(/\r?\n/).map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).find(item => item?.name === guest);
      if (guestInfo?.status === "Running") {
        const stopped = run("/opt/homebrew/bin/limactl", ["stop", guest],
          { env, timeout: 60000, allowFailure: true });
        if (stopped.status !== 0) {
          started = true;
          evidence.reason = "SCRATCH_VM_STOP_FAILED";
        } else started = false;
      } else if (guestInfo?.status === "Stopped" || !guestInfo) started = false;
      else {
        started = true;
        evidence.reason = "SCRATCH_VM_STATE_UNSAFE_FOR_DETACH";
      }
    }
  }
  if (!started && attached) {
    const detached = await detachScratchMount();
    if (!detached) evidence.reason = "SCRATCH_IMAGE_DETACH_FAILED";
    else attached = false;
  }
  if (!started && !attached) {
    evidence.payloadHiddenAfterDetach = ["synthetic-sentinel.txt", "lima", "cached-postgres-image.tar"]
      .every(name => !existsSync(join(mount, name)));
    cleanupSafe = evidence.payloadHiddenAfterDetach && scratch.startsWith(`${worktree}/.restore-architecture-qa.`);
    if (cleanupSafe) {
      rmSync(scratch, { recursive: true });
      rmdirSync(mount);
      evidence.scratchCleaned = true;
    }
  }
  if (!evidence.scratchCleaned) evidence.reason ??= "SCRATCH_CLEANUP_INCOMPLETE";
  if (!evidence.scratchCleaned) evidence.status = "BLOCKED";
  console.log(JSON.stringify(evidence));
  if (evidence.status !== "ARCHITECTURE_PROBE_PASS" || !evidence.scratchCleaned) process.exitCode = 1;
}
