import { createHmac, timingSafeEqual } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { STORAGE_CONTRACT, createStorageObjectId, storageContractInternals } from "./storage-contract.mjs";

const { required, safePart, scopeFromObjectId, assertScope, bytes, usage, descriptor } = storageContractInternals;
async function rootAndPath(root, objectId) {
  const canonicalRoot = await realpath(root), candidate = resolve(canonicalRoot, objectId), rel = relative(canonicalRoot, candidate);
  if (!rel || rel.startsWith("..") || rel.includes(`${sep}..${sep}`) || resolve(canonicalRoot, rel) !== candidate) throw new Error("storage_path_escape_denied");
  let cursor = canonicalRoot;
  for (const part of rel.split(sep).slice(0, -1)) { cursor = join(cursor, part); try { if ((await lstat(cursor)).isSymbolicLink()) throw new Error("storage_symlink_escape_denied"); } catch (error) { if (error?.code !== "ENOENT") throw error; } }
  return { candidate };
}
function grantPayload(input, expiresAt) { return `${input.tenantId}\n${input.siteId}\n${input.objectId}\n${expiresAt}`; }

export function createLocalNasStorageBackend({ root, signingSecret, backendId = "local-nas-evidence", onUsage, now = Date.now } = {}) {
  required(root, "root"); required(signingSecret, "signing_secret");
  const backend = Object.freeze({ id: safePart(backendId, "backend_id"), class: "LOCAL_NAS" }); let initialized = false;
  async function initialize() { if (!initialized) { await mkdir(root, { recursive: true, mode: 0o700 }); initialized = true; } }
  async function target(objectId) { await initialize(); scopeFromObjectId(objectId); return rootAndPath(root, objectId); }
  return Object.freeze({ contract: STORAGE_CONTRACT, ...backend, objectId: createStorageObjectId,
    async write(input) { assertScope(input.objectId, input); const body = bytes(input.bytes), location = await target(input.objectId); await mkdir(dirname(location.candidate), { recursive: true, mode: 0o700 });
      const temporary = `${location.candidate}.partial`; await writeFile(temporary, body, { mode: 0o600 }); await rename(temporary, location.candidate); usage(onUsage, "WRITE", { ...input, ...backend }, body.length); return descriptor(input, body, backend); },
    async read(input) { assertScope(input.objectId, input); const location = await target(input.objectId), body = await readFile(location.candidate); usage(onUsage, "READ", { ...input, ...backend }, body.length); return body; },
    async stat(input) { assertScope(input.objectId, input); const location = await target(input.objectId); try { const info = await stat(location.candidate); return { object_id: input.objectId, size_bytes: info.size, updated_at: info.mtime.toISOString() }; } catch (error) { if (error?.code === "ENOENT") return null; throw error; } },
    async delete(input) { assertScope(input.objectId, input); const location = await target(input.objectId); await rm(location.candidate, { force: true }); usage(onUsage, "DELETE", { ...input, ...backend }, input.sizeBytes ?? 0); return { deleted: true, object_id: input.objectId }; },
    async authorize(input) { assertScope(input.objectId, input); if (!input.actor?.tenantId || input.actor.tenantId !== input.tenantId || !input.actor.siteIds?.includes(input.siteId)) throw new Error("storage_access_denied");
      const expiresAt = now() + Math.min(300, Math.max(15, input.ttlSeconds ?? 60)) * 1000, signature = createHmac("sha256", signingSecret).update(grantPayload(input, expiresAt)).digest("hex");
      return { kind: "MEDIATED_GRANT", grant: Buffer.from(JSON.stringify({ tenantId: input.tenantId, siteId: input.siteId, objectId: input.objectId, expiresAt, signature })).toString("base64url"), expires_at: new Date(expiresAt).toISOString() }; },
    async readAuthorized(grant, actor) { let parsed; try { parsed = JSON.parse(Buffer.from(grant, "base64url").toString("utf8")); } catch { throw new Error("storage_grant_invalid"); }
      if (parsed.expiresAt <= now() || actor?.tenantId !== parsed.tenantId || !actor?.siteIds?.includes(parsed.siteId)) throw new Error("storage_grant_denied"); const expected = createHmac("sha256", signingSecret).update(grantPayload(parsed, parsed.expiresAt)).digest(), supplied = Buffer.from(String(parsed.signature), "hex");
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error("storage_grant_invalid"); const location = await target(parsed.objectId), body = await readFile(location.candidate); usage(onUsage, "READ", { objectId: parsed.objectId, tenantId: parsed.tenantId, siteId: parsed.siteId, ...backend }, body.length); return body; },
    async health() { try { await initialize(); const location = await rootAndPath(root, `.health-${backend.id}`), handle = await open(location.candidate, "a", 0o600); await handle.close(); await rm(location.candidate, { force: true }); return { backend_id: backend.id, backend_class: backend.class, status: "HEALTHY" }; } catch { return { backend_id: backend.id, backend_class: backend.class, status: "UNHEALTHY" }; } }
  });
}
