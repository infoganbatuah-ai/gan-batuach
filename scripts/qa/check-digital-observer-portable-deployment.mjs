import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createPortableBackup, restorePortableBackup, verifyPortableBackupPermissions } from "../../lib/domain/digital-observer/portable-backup.mjs";
import { createStorageObjectId } from "../../lib/domain/digital-observer/storage-contract.mjs";
import { createLocalNasStorageBackend } from "../../lib/domain/digital-observer/storage-local-nas.mjs";
import { resolveEdgeRuntimePaths } from "../../services/video-gateway/runtime-paths.mjs";
import { createPortableInferenceWorker } from "../../services/video-gateway/portable-inference-worker.mjs";

const root = process.cwd();
const deployment = JSON.parse(readFileSync("config/digital-observer-portable-deployment.json", "utf8"));
const models = JSON.parse(readFileSync("config/digital-observer-model-artifacts.json", "utf8"));
assert.equal(deployment.contract, "observer-portable-deployment-v1");
assert.equal(deployment.runtime.node_major, 22);
assert.equal(models.contract, "observer-model-artifacts-v1");
assert.match(models.models[0].sha256, /^[a-f0-9]{64}$/);
assert.equal(models.models[0].license, "Apache-2.0");

function releaseFiles(directory = ".", prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if ([".git", ".next", "node_modules"].includes(entry.name)) return [];
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? releaseFiles(join(directory, entry.name), relative) : [relative];
  });
}

const files = existsSync(".git")
  ? execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n").filter(Boolean)
  : releaseFiles();
for (const required of ["package-lock.json", "Dockerfile", ".env.example", "supabase/migrations/20260910040000_digital_observer_storage_portability.sql", "services/video-gateway/portable-inference-worker.mjs"]) assert(files.includes(required), `${required} must be tracked`);
const runtimeFiles = files.filter((file) => /^(app|components|lib|services)\//.test(file) || /^scripts\/(?!qa\/|visual-match|local-dvr-onboarding-session|prepare-|stage-)/.test(file));
const machineSpecific = [];
for (const file of runtimeFiles) {
  const value = readFileSync(file, "utf8");
  if (/\/Volumes\/DIGITAL_OBSERVER|\/Users\/danielderi|\/private\/tmp\/gan-batuach|text-web-ai/i.test(value)) machineSpecific.push(file);
}
assert.deepEqual(machineSpecific, [], `runtime machine-specific paths: ${machineSpecific.join(",")}`);

const linuxPaths = resolveEdgeRuntimePaths({ OBSERVER_EDGE_DEVICE_TYPE: "SOFTWARE_CONNECTOR", XDG_STATE_HOME: "/srv/state" }, { platform: "linux", home: "/home/observer" });
assert.equal(linuxPaths.dataDir, "/srv/state/digital-observer/observer-connector");
assert.throws(() => resolveEdgeRuntimePaths({ OBSERVER_EDGE_DATA_DIR: "relative-state" }, { platform: "linux", home: "/home/observer" }), /MUST_BE_ABSOLUTE/);

const workspace = mkdtempSync(join(tmpdir(), "observer-portable-restore-"));
chmodSync(workspace, 0o700);
const sourceRoot = join(workspace, "source-storage");
const restoredRoot = join(workspace, "restored-storage");
const backupRoot = join(workspace, "backup");
const sourceStorage = createLocalNasStorageBackend({ root: sourceRoot, signingSecret: "qa-source-signing-secret-32-bytes" });
const restoredStorage = createLocalNasStorageBackend({ root: restoredRoot, signingSecret: "qa-restore-signing-secret-32-bytes" });
const ids = {
  tenant: "11111111-1111-4111-8111-111111111111",
  site: "22222222-2222-4222-8222-222222222222",
  source: "33333333-3333-4333-8333-333333333333",
  device: "44444444-4444-4444-8444-444444444444",
  event: "55555555-5555-4555-8555-555555555555",
  incident: "66666666-6666-4666-8666-666666666666",
  evidence: "77777777-7777-4777-8777-777777777777"
};
const media = Buffer.from("controlled portable evidence bytes\n");
const sha256 = createHash("sha256").update(media).digest("hex");
const objectId = createStorageObjectId({ tenantId: ids.tenant, siteId: ids.site, evidenceId: ids.evidence, variant: "clip", extension: "mp4" });
await sourceStorage.write({ objectId, tenantId: ids.tenant, siteId: ids.site, evidenceId: ids.evidence, bytes: media, contentType: "video/mp4" });
const records = [
  { domain: "TENANT", record_id: ids.tenant, tenant_id: ids.tenant, payload: { name: "Portable QA tenant" } },
  { domain: "SITE", record_id: ids.site, tenant_id: ids.tenant, site_id: ids.site, payload: { name: "Portable QA Site" } },
  { domain: "CAMERA_SOURCE", record_id: ids.source, tenant_id: ids.tenant, site_id: ids.site, payload: { status: "active", source_mode: "live" } },
  { domain: "MANAGED_DEVICE", record_id: ids.device, tenant_id: ids.tenant, site_id: ids.site, payload: { profile: "SOFTWARE_CONNECTOR", credential_version: 3, identity_state: "ENROLLED" } },
  { domain: "FLEET_RELATIONSHIP", record_id: "fleet-source-binding", tenant_id: ids.tenant, site_id: ids.site, payload: { device_id: ids.device, camera_source_id: ids.source } },
  { domain: "CONFIGURATION", record_id: "config-v7", tenant_id: ids.tenant, site_id: ids.site, payload: { version: 7 } },
  { domain: "EVENT", record_id: ids.event, tenant_id: ids.tenant, site_id: ids.site, payload: { camera_source_id: ids.source, provenance: "REAL_CAMERA_AI", observed_at: "2026-09-10T10:00:00.000Z" } },
  { domain: "INCIDENT", record_id: ids.incident, tenant_id: ids.tenant, site_id: ids.site, payload: { event_id: ids.event, status: "resolved" } },
  { domain: "EVIDENCE", record_id: ids.evidence, tenant_id: ids.tenant, site_id: ids.site, payload: { event_id: ids.event, state: "AVAILABLE", integrity_sha256: sha256 } },
  { domain: "STORAGE_REFERENCE", record_id: "storage-reference-1", tenant_id: ids.tenant, site_id: ids.site, payload: { evidence_id: ids.evidence, object_id: objectId, backend_class: "LOCAL_NAS" } },
  { domain: "QUEUE_STATE", record_id: "queue-checkpoint-1", tenant_id: ids.tenant, site_id: ids.site, payload: { schema_version: 1, pending_records: 0 } }
];
const backup = await createPortableBackup({ directory: backupRoot, records, storageBackend: sourceStorage, storageObjects: [{ tenant_id: ids.tenant, site_id: ids.site, evidence_id: ids.evidence, object_id: objectId, integrity_sha256: sha256, content_type: "video/mp4" }], sourceBuildSha: "qa-clean-build" });
assert.equal(backup.record_count, records.length);
assert.equal(verifyPortableBackupPermissions(backupRoot).safe, true);

const db = new PGlite();
await db.exec("create table restored_records(domain text not null, record_id text not null, tenant_id text not null, site_id text, payload jsonb not null, primary key(domain, record_id));");
const upsertRecord = async (record) => db.query("insert into restored_records(domain,record_id,tenant_id,site_id,payload) values($1,$2,$3,$4,$5) on conflict(domain,record_id) do update set tenant_id=excluded.tenant_id,site_id=excluded.site_id,payload=excluded.payload", [record.domain, record.record_id, record.tenant_id, record.site_id, record.payload]);
const restored = await restorePortableBackup({ directory: backupRoot, targetStorageBackend: restoredStorage, upsertRecord, expectedTenantId: ids.tenant });
const restoredAgain = await restorePortableBackup({ directory: backupRoot, targetStorageBackend: restoredStorage, upsertRecord, expectedTenantId: ids.tenant });
assert.equal(restored.record_count, records.length);
assert.equal(restoredAgain.record_count, records.length);
assert.deepEqual(await restoredStorage.read({ objectId, tenantId: ids.tenant, siteId: ids.site }), media);
const count = await db.query("select count(*)::int as count from restored_records");
assert.equal(count.rows[0].count, records.length, "restore retry must remain idempotent");
const ownership = await db.query("select record_id,tenant_id,site_id,payload from restored_records where domain in ('SITE','CAMERA_SOURCE','MANAGED_DEVICE','EVENT','INCIDENT','EVIDENCE') order by domain");
assert.equal(ownership.rows.every((row) => row.tenant_id === ids.tenant), true);
assert.equal(ownership.rows.find((row) => row.record_id === ids.device).payload.credential_version, 3);

const tampered = join(workspace, "tampered-backup");
cpSync(backupRoot, tampered, { recursive: true });
writeFileSync(join(tampered, "records.json"), "[]\n");
await assert.rejects(() => restorePortableBackup({ directory: tampered, targetStorageBackend: restoredStorage, upsertRecord, expectedTenantId: ids.tenant }), /INTEGRITY_MISMATCH/);
await assert.rejects(() => createPortableBackup({ directory: join(workspace, "secret-backup"), records: [{ ...records[0], payload: { device_private_key: "denied" } }] }), /SECRET_FIELD_DENIED/);

const migrations = readdirSync("supabase/migrations").filter((file) => file.endsWith(".sql")).sort();
assert(migrations.length >= 202);
assert.equal(new Set(migrations.map((file) => file.slice(0, 14))).size, migrations.length, "migration timestamps must be unique");
const migrationChainSha256 = createHash("sha256").update(migrations.map((file) => `${file}:${createHash("sha256").update(readFileSync(join("supabase/migrations", file))).digest("hex")}`).join("\n")).digest("hex");

const queue = { claim: () => null };
const portableWorker = createPortableInferenceWorker({ workerId: "portable-clean-worker", environment: "CONTAINER_LIKE_LOCAL", identity: { kind: "isolated_qa" }, capabilities: ["object_detection"], infer: async () => ({ detections: [] }) });
assert.equal((await portableWorker.processOne(queue)).status, "IDLE");

console.log(JSON.stringify({
  result: "PASS",
  contract: deployment.contract,
  runtime_machine_specific_paths: machineSpecific,
  tracked_runtime_inputs: true,
  migration_chain: { count: migrations.length, sha256: migrationChainSha256, unique_ordered_timestamps: true },
  database_restore: { engine: "PGlite isolated PostgreSQL", records: restored.record_count, idempotent_retry_records: count.rows[0].count, tenant_ownership_preserved: true },
  restored_domains: [...new Set(records.map((record) => record.domain))],
  restored_storage: { objects: restored.object_count, integrity_sha256: sha256 },
  permissions: verifyPortableBackupPermissions(backupRoot),
  tamper_rejected: true,
  secret_payload_rejected: true,
  portable_worker_start: "PASS",
  model_catalog: { id: models.models[0].id, sha256: models.models[0].sha256, license: models.models[0].license }
}, null, 2));
