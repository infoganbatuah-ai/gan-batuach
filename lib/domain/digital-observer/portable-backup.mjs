import { createHash, randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

export const PORTABLE_BACKUP_CONTRACT = "observer-portable-backup-v1";
const DOMAIN_ORDER = ["TENANT", "SITE", "CAMERA_SOURCE", "MANAGED_DEVICE", "FLEET_RELATIONSHIP", "CONFIGURATION", "EVENT", "INCIDENT", "EVIDENCE", "STORAGE_REFERENCE", "QUEUE_STATE"];
const FORBIDDEN_KEY = /(password|secret|private[_-]?key|refresh[_-]?token|service[_-]?role|camera[_-]?url)/i;

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function assertNoSecrets(value, path = "root") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key) && child !== null && child !== "") throw new Error(`BACKUP_SECRET_FIELD_DENIED:${path}.${key}`);
    assertNoSecrets(child, `${path}.${key}`);
  }
}

function validateRecord(record) {
  if (!record || !DOMAIN_ORDER.includes(record.domain) || typeof record.record_id !== "string" || !record.record_id || typeof record.tenant_id !== "string" || !record.tenant_id) {
    throw new Error("PORTABLE_BACKUP_RECORD_INVALID");
  }
  assertNoSecrets(record.payload);
  return { domain: record.domain, record_id: record.record_id, tenant_id: record.tenant_id, site_id: record.site_id || null, payload: record.payload || {} };
}

function safeDirectory(directory) {
  const target = resolve(directory);
  if (["/", resolve(process.cwd())].includes(target)) throw new Error("PORTABLE_BACKUP_DIRECTORY_UNSAFE");
  return target;
}

function writeAtomic(path, bytes, mode = 0o600) {
  const temporary = `${path}.${process.pid}.${randomUUID()}.partial`;
  writeFileSync(temporary, bytes, { flag: "wx", mode });
  renameSync(temporary, path);
  chmodSync(path, mode);
}

export async function createPortableBackup({ directory, records, storageObjects = [], storageBackend, createdAt = new Date().toISOString(), sourceBuildSha = "unknown" }) {
  const target = safeDirectory(directory);
  if (existsSync(target)) throw new Error("PORTABLE_BACKUP_TARGET_MUST_BE_NEW");
  mkdirSync(join(target, "objects"), { recursive: true, mode: 0o700 });
  chmodSync(target, 0o700);
  const normalized = records.map(validateRecord).sort((left, right) => DOMAIN_ORDER.indexOf(left.domain) - DOMAIN_ORDER.indexOf(right.domain) || left.record_id.localeCompare(right.record_id));
  const recordsBytes = Buffer.from(`${canonicalJson(normalized)}\n`);
  writeAtomic(join(target, "records.json"), recordsBytes);
  const objects = [];
  for (const reference of storageObjects) {
    if (!storageBackend) throw new Error("PORTABLE_BACKUP_STORAGE_BACKEND_REQUIRED");
    const bytes = await storageBackend.read({ objectId: reference.object_id, tenantId: reference.tenant_id, siteId: reference.site_id });
    const sha256 = digest(bytes);
    if (reference.integrity_sha256 && reference.integrity_sha256 !== sha256) throw new Error("PORTABLE_BACKUP_SOURCE_INTEGRITY_MISMATCH");
    const file = `${sha256}.bin`;
    const destination = join(target, "objects", file);
    if (!existsSync(destination)) writeAtomic(destination, bytes);
    objects.push({ ...reference, backup_file: file, integrity_sha256: sha256, size_bytes: bytes.length });
  }
  const manifest = {
    contract: PORTABLE_BACKUP_CONTRACT,
    backup_id: randomUUID(),
    created_at: createdAt,
    source_build_sha: sourceBuildSha,
    record_count: normalized.length,
    records_sha256: digest(recordsBytes),
    objects,
    excluded_secret_classes: ["provider credentials", "camera credentials", "device private keys", "release signing private keys"]
  };
  const manifestBytes = Buffer.from(`${canonicalJson(manifest)}\n`);
  writeAtomic(join(target, "manifest.json"), manifestBytes);
  return Object.freeze({ ...manifest, directory: target, manifest_sha256: digest(manifestBytes) });
}

export async function restorePortableBackup({ directory, targetStorageBackend, upsertRecord, expectedTenantId = null }) {
  const source = safeDirectory(directory);
  const manifestPath = join(source, "manifest.json");
  const recordsPath = join(source, "records.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.contract !== PORTABLE_BACKUP_CONTRACT) throw new Error("PORTABLE_BACKUP_CONTRACT_UNSUPPORTED");
  const recordsBytes = readFileSync(recordsPath);
  if (digest(recordsBytes) !== manifest.records_sha256) throw new Error("PORTABLE_BACKUP_RECORDS_INTEGRITY_MISMATCH");
  const records = JSON.parse(recordsBytes);
  const restored = [];
  for (const record of records.map(validateRecord)) {
    if (expectedTenantId && record.tenant_id !== expectedTenantId) throw new Error("PORTABLE_BACKUP_TENANT_SCOPE_DENIED");
    await upsertRecord(record);
    restored.push(`${record.domain}:${record.record_id}`);
  }
  const restoredObjects = [];
  for (const object of manifest.objects || []) {
    if (expectedTenantId && object.tenant_id !== expectedTenantId) throw new Error("PORTABLE_BACKUP_TENANT_SCOPE_DENIED");
    const file = basename(object.backup_file);
    if (file !== object.backup_file) throw new Error("PORTABLE_BACKUP_OBJECT_PATH_INVALID");
    const bytes = readFileSync(join(source, "objects", file));
    if (bytes.length !== object.size_bytes || digest(bytes) !== object.integrity_sha256) throw new Error("PORTABLE_BACKUP_OBJECT_INTEGRITY_MISMATCH");
    if (targetStorageBackend) {
      await targetStorageBackend.write({ objectId: object.object_id, tenantId: object.tenant_id, siteId: object.site_id, evidenceId: object.evidence_id, bytes, contentType: object.content_type || "application/octet-stream", upsert: true });
      const verified = await targetStorageBackend.read({ objectId: object.object_id, tenantId: object.tenant_id, siteId: object.site_id });
      if (digest(verified) !== object.integrity_sha256) throw new Error("PORTABLE_RESTORE_TARGET_INTEGRITY_MISMATCH");
    }
    restoredObjects.push(object.object_id);
  }
  return Object.freeze({ contract: PORTABLE_BACKUP_CONTRACT, backup_id: manifest.backup_id, record_count: restored.length, object_count: restoredObjects.length, restored, restored_objects: restoredObjects });
}

export function removePortableBackupForQa(directory) {
  rmSync(safeDirectory(directory), { recursive: true, force: true });
}

export function verifyPortableBackupPermissions(directory) {
  const rootMode = statSync(directory).mode & 0o777;
  const manifestMode = statSync(join(directory, "manifest.json")).mode & 0o777;
  return { root_mode: rootMode, manifest_mode: manifestMode, safe: (rootMode & 0o077) === 0 && (manifestMode & 0o077) === 0 };
}
