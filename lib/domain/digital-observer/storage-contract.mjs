import { createHash } from "node:crypto";

export const STORAGE_CONTRACT = "observer-storage-v1";
export const STORAGE_USAGE_CONTRACT = "observer-storage-usage-v1";
export const STORAGE_BACKEND_CLASSES = Object.freeze(["CLOUD_OBJECT_STORAGE", "LOCAL_NAS", "ENTERPRISE_OBJECT_STORAGE", "CUSTOMER_MANAGED_STORAGE"]);
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const SHA256 = /^[a-f0-9]{64}$/;

function required(value, name) { if (typeof value !== "string" || !value.trim()) throw new Error(`storage_${name}_required`); return value.trim(); }
function safePart(value, name) { const part = required(value, name); if (!SAFE_ID.test(part) || part === "." || part === "..") throw new Error(`storage_${name}_invalid`); return part; }
function scopedObjectId(input) {
  const tenant = safePart(input.tenantId, "tenant_id"), site = safePart(input.siteId, "site_id"), evidence = safePart(input.evidenceId, "evidence_id");
  const variant = safePart(input.variant, "variant"), extension = safePart(String(input.extension || "bin").replace(/^\./, ""), "extension");
  return `${tenant}/${site}/${evidence}/${variant}.${extension}`;
}
function scopeFromObjectId(objectId) {
  const parts = required(objectId, "object_id").split("/");
  if (parts.length !== 4 || parts.some((part) => !SAFE_ID.test(part) || part === "." || part === "..")) throw new Error("storage_object_id_invalid");
  return { tenantId: parts[0], siteId: parts[1] };
}
function assertScope(objectId, scope) {
  const bound = scopeFromObjectId(objectId);
  if (!scope || bound.tenantId !== scope.tenantId || bound.siteId !== scope.siteId) throw new Error("storage_scope_denied");
  return bound;
}
function bytes(value) { return Buffer.isBuffer(value) ? value : Buffer.from(value); }
function digest(value) { return createHash("sha256").update(value).digest("hex"); }
function usage(onUsage, operation, input, quantity) {
  const event = { contract: STORAGE_USAGE_CONTRACT, operation, backend_id: input.backendId, backend_class: input.backendClass,
    tenant_id: input.tenantId, site_id: input.siteId, evidence_id: input.evidenceId ?? null, object_id: input.objectId,
    quantity, unit: "BYTE", attribution_quality: "DIRECTLY_METERED", measured_at: new Date().toISOString() };
  onUsage?.(Object.freeze(event));
}
function descriptor(input, body, backend) {
  return Object.freeze({ contract: STORAGE_CONTRACT, backend_id: backend.id, backend_class: backend.class, object_id: input.objectId,
    tenant_id: input.tenantId, site_id: input.siteId, evidence_id: input.evidenceId ?? null, content_type: input.contentType,
    size_bytes: body.length, sha256: digest(body), created_at: input.createdAt ?? new Date().toISOString(), state: "AVAILABLE" });
}

export function createStorageObjectId(input) { return scopedObjectId(input); }
export function verifyStorageIntegrity(value, expected) {
  const actual = digest(bytes(value));
  return { ok: SHA256.test(String(expected || "")) && actual === expected, algorithm: "sha256", expected, actual };
}

export function createSupabaseStorageBackend({ client, bucket = "digital-observer-event-media", backendId = "supabase-private-evidence", onUsage } = {}) {
  if (!client?.storage?.from) throw new Error("storage_supabase_client_required");
  const backend = Object.freeze({ id: safePart(backendId, "backend_id"), class: "CLOUD_OBJECT_STORAGE" });
  const bucketApi = () => client.storage.from(bucket);
  return Object.freeze({ contract: STORAGE_CONTRACT, ...backend,
    objectId: createStorageObjectId,
    async write(input) {
      assertScope(input.objectId, input); const body = bytes(input.bytes); const result = await bucketApi().upload(input.objectId, body, { contentType: input.contentType, upsert: input.upsert === true });
      if (result.error) throw new Error("storage_write_failed"); usage(onUsage, "WRITE", { ...input, ...backend }, body.length); return descriptor(input, body, backend);
    },
    async read(input) {
      assertScope(input.objectId, input); const result = await bucketApi().download(input.objectId); if (result.error || !result.data) throw new Error("storage_read_failed");
      const body = Buffer.from(await result.data.arrayBuffer()); usage(onUsage, "READ", { ...input, ...backend }, body.length); return body;
    },
    async stat(input) {
      assertScope(input.objectId, input); const parent = input.objectId.slice(0, input.objectId.lastIndexOf("/")), name = input.objectId.slice(input.objectId.lastIndexOf("/") + 1);
      const result = await bucketApi().list(parent, { search: name, limit: 2 }); if (result.error) throw new Error("storage_stat_failed");
      const item = result.data?.find((entry) => entry.name === name); if (!item) return null;
      return { object_id: input.objectId, size_bytes: Number(item.metadata?.size ?? 0), content_type: item.metadata?.mimetype ?? null, updated_at: item.updated_at ?? item.created_at ?? null };
    },
    async delete(input) { assertScope(input.objectId, input); const result = await bucketApi().remove([input.objectId]); if (result.error) throw new Error("storage_delete_failed"); usage(onUsage, "DELETE", { ...input, ...backend }, input.sizeBytes ?? 0); return { deleted: true, object_id: input.objectId }; },
    async authorize(input) { assertScope(input.objectId, input); if (!input.actor?.tenantId || input.actor.tenantId !== input.tenantId || !input.actor.siteIds?.includes(input.siteId)) throw new Error("storage_access_denied");
      const result = await bucketApi().createSignedUrl(input.objectId, Math.min(300, Math.max(15, input.ttlSeconds ?? 60)), input.downloadName ? { download: input.downloadName } : undefined);
      if (result.error || !result.data?.signedUrl) throw new Error("storage_authorize_failed"); return { kind: "SIGNED_REDIRECT", url: result.data.signedUrl, expires_in_seconds: Math.min(300, Math.max(15, input.ttlSeconds ?? 60)) }; },
    async health() { return { backend_id: backend.id, backend_class: backend.class, status: "UNKNOWN", reason: "probe_requires_scoped_object" }; }
  });
}

export const storageContractInternals = Object.freeze({ required, safePart, scopeFromObjectId, assertScope, bytes, usage, descriptor });

export function createRetentionPolicy(input) {
  const days = Number(input.retentionDays); if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error("retention_days_invalid");
  return Object.freeze({ contract: "observer-retention-policy-v1", policy_id: safePart(input.policyId, "policy_id"), version: Number(input.version ?? 1), tenant_id: required(input.tenantId, "tenant_id"),
    site_id: input.siteId ?? null, evidence_type: input.evidenceType ?? "EVENT_MEDIA", retention_days: days, legal_hold_allowed: input.legalHoldAllowed !== false, effective_at: input.effectiveAt ?? new Date().toISOString() });
}
export function evaluateRetention({ policy, object, now = Date.now }) {
  if (object.tenant_id !== policy.tenant_id || policy.site_id && object.site_id !== policy.site_id) return { eligible: false, reason: "SCOPE_MISMATCH" };
  if (object.legal_hold === true) return { eligible: false, reason: "LEGAL_HOLD" };
  const deleteAt = object.delete_after ? Date.parse(object.delete_after) : Date.parse(object.created_at) + policy.retention_days * 86400000;
  const currentTime = typeof now === "function" ? now() : Number(now);
  return currentTime >= deleteAt ? { eligible: true, reason: "RETENTION_EXPIRED", delete_at: new Date(deleteAt).toISOString() } : { eligible: false, reason: "NOT_YET_ELIGIBLE", delete_at: new Date(deleteAt).toISOString() };
}
export async function executeRetention({ backend, object, policy, updateCanonical, now = Date.now }) {
  const decision = evaluateRetention({ policy, object, now }); if (!decision.eligible) return { state: "RETAINED", ...decision };
  await backend.delete({ objectId: object.object_id, tenantId: object.tenant_id, siteId: object.site_id, sizeBytes: object.size_bytes, evidenceId: object.evidence_id });
  const currentTime = typeof now === "function" ? now() : Number(now);
  await updateCanonical?.({ ...object, state: "DELETED", tombstone_reason: "RETENTION_EXPIRED", deleted_at: new Date(currentTime).toISOString(), object_id: null });
  return { state: "DELETED", reason: "RETENTION_EXPIRED" };
}

export function createStorageMigrationCoordinator({ now = Date.now } = {}) {
  const completed = new Map();
  return Object.freeze({ async migrate({ migrationId, source, target, object, switchCanonical, deleteSource = false }) {
    safePart(migrationId, "migration_id"); if (completed.has(migrationId)) return completed.get(migrationId);
    if (source.id === target.id) throw new Error("storage_migration_same_backend"); assertScope(object.object_id, { tenantId: object.tenant_id, siteId: object.site_id });
    const oldReference = { backend_id: source.id, object_id: object.object_id }; let body;
    try { body = await source.read({ objectId: object.object_id, tenantId: object.tenant_id, siteId: object.site_id, evidenceId: object.evidence_id }); } catch { return { migration_id: migrationId, state: "FAILED", reason: "SOURCE_UNAVAILABLE", canonical_reference: oldReference }; }
    const verification = verifyStorageIntegrity(body, object.sha256); if (!verification.ok) return { migration_id: migrationId, state: "FAILED", reason: "SOURCE_INTEGRITY_MISMATCH", canonical_reference: oldReference };
    try { await target.write({ objectId: object.object_id, tenantId: object.tenant_id, siteId: object.site_id, evidenceId: object.evidence_id, contentType: object.content_type, bytes: body, upsert: true });
      const copied = await target.read({ objectId: object.object_id, tenantId: object.tenant_id, siteId: object.site_id, evidenceId: object.evidence_id }); if (!verifyStorageIntegrity(copied, object.sha256).ok) throw new Error("TARGET_INTEGRITY_MISMATCH");
      const next = { backend_id: target.id, object_id: object.object_id, migrated_at: new Date(now()).toISOString() }; await switchCanonical(next);
      if (deleteSource) await source.delete({ objectId: object.object_id, tenantId: object.tenant_id, siteId: object.site_id, evidenceId: object.evidence_id, sizeBytes: object.size_bytes });
      const result = { migration_id: migrationId, state: "MIGRATED", canonical_reference: next, source_deleted: deleteSource }; completed.set(migrationId, result); return result;
    } catch (error) { return { migration_id: migrationId, state: "FAILED", reason: error instanceof Error ? error.message : "COPY_FAILED", canonical_reference: oldReference }; }
  } });
}

export function createSourceRecordingReference(input) {
  const forbidden = [input.credentials, input.password, input.rawUrl].some(Boolean); if (forbidden) throw new Error("recording_reference_secret_denied");
  const start = Date.parse(input.startsAt), end = Date.parse(input.endsAt); if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("recording_reference_time_invalid");
  return Object.freeze({ contract: "observer-source-recording-reference-v1", reference_id: safePart(input.referenceId, "reference_id"), tenant_id: required(input.tenantId, "tenant_id"), site_id: required(input.siteId, "site_id"),
    camera_source_id: required(input.cameraSourceId, "camera_source_id"), source_system: safePart(input.sourceSystem, "source_system"), recording_id: safePart(input.recordingId, "recording_id"),
    starts_at: input.startsAt, ends_at: input.endsAt, retrieval_capability: input.retrievalCapability ?? "ON_DEMAND_AUTHORIZED", retention_available_until: input.retentionAvailableUntil ?? null,
    authorization_requirement: input.authorizationRequirement ?? "TENANT_SITE_SOURCE_SCOPE", media_copied_to_digital_observer: input.mediaCopiedToDigitalObserver === true });
}
