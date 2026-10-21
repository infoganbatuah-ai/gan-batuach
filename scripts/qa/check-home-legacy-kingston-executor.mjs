import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createHomeLegacyKingstonGuard, createHomeLegacyKingstonExecutor,
  HOME_LEGACY_KINGSTON_MOUNT, HOME_LEGACY_KINGSTON_SOURCE,
  HOME_LEGACY_KINGSTON_ARTIFACTS, HOME_LEGACY_KINGSTON_VOLUME_UUID } from
  "../../services/video-gateway/home-legacy-kingston-executor.mjs";
import { HOME_LEGACY_MATCH_BINDINGS } from "../../services/video-gateway/home-legacy-match-service.mjs";

let checks = 0;
const good = { MountPoint: HOME_LEGACY_KINGSTON_MOUNT,
  VolumeUUID: HOME_LEGACY_KINGSTON_VOLUME_UUID, FilesystemType: "apfs",
  FileVault: true, Encryption: true, WritableVolume: true,
  APFSContainerFree: 2 * 1024 ** 3 };
const paths = new Set([HOME_LEGACY_KINGSTON_MOUNT, HOME_LEGACY_KINGSTON_SOURCE,
  HOME_LEGACY_KINGSTON_ARTIFACTS]);
const guard = (info = good, options = ["apfs", "local", "journaled"]) =>
  createHomeLegacyKingstonGuard({ inspect: () => info, inspectMountOptions: () => options,
    realpath: path => { if (!paths.has(path)) throw new Error("missing"); return path; },
    stat: path => ({ dev: paths.has(path) ? 42 : 1 }) });
assert.equal(guard()(), true); checks++;
for (const change of [
  { MountPoint: "/Volumes/other" }, { VolumeUUID: randomUUID().toUpperCase() },
  { FilesystemType: "exfat" }, { FileVault: false }, { Encryption: false },
  { WritableVolume: false }, { APFSContainerFree: 0 }
]) { assert.equal(guard({ ...good, ...change })(), false); checks++; }
assert.equal(guard(good, ["apfs", "noowners"])(), false); checks++;
assert.equal(guard(good, [])(), false); checks++;
assert.equal(createHomeLegacyKingstonGuard({ inspect: () => good,
  inspectMountOptions: () => ["apfs"], realpath: () => HOME_LEGACY_KINGSTON_MOUNT,
  stat: () => ({ dev: 42 }) })(), false); checks++;
assert.equal(createHomeLegacyKingstonGuard({ inspect: () => good,
  inspectMountOptions: () => ["apfs"], realpath: path => path,
  stat: path => ({ dev: path === HOME_LEGACY_KINGSTON_SOURCE ? 12 : 42 }) })(), false); checks++;
assert.equal(createHomeLegacyKingstonGuard({ inspect: () => { throw new Error("unmounted"); },
  inspectMountOptions: () => ["apfs"] })(), false); checks++;
assert.throws(() => createHomeLegacyKingstonExecutor({ approvalStore: {}, comparator: {} }),
  /KINGSTON_GUARD_REQUIRED/); checks++;

const binding = Object.values(HOME_LEGACY_MATCH_BINDINGS)[0];
let calls = 0;
const approval = { authenticated: true, role: "platform_admin",
  purpose: "HOME_TELEMETRY_LEGACY_MATCH", deviceId: binding.deviceId,
  siteId: binding.siteId, tenantId: binding.tenantId, actorId: randomUUID(),
  approvalId: randomUUID(), issuedAt: 1000, expiresAt: 2000, revoked: false };
const approvalStore = {
  authorizeAdministrator: async () => approval,
  confirmApprovalActive: async () => true,
  consumeAttempt: async () => true,
  recordAudit: async () => true
};
const comparator = { compareBoundCredential: async () => { calls++; return "MATCH"; } };
const input = { deviceId: binding.deviceId, approvalId: approval.approvalId,
  requestId: randomUUID(), administratorToken: "synthetic-admin-token-longer-than-32-characters" };
const executor = hostGuard => createHomeLegacyKingstonExecutor({ hostGuard, approvalStore,
  comparator, now: () => 1500 });
assert.equal(await executor(() => false).compare(input), "UNKNOWN"); checks++;
assert.equal(calls, 0); checks++;
let probes = 0;
assert.equal(await executor(() => ++probes === 1).compare(input), "UNKNOWN"); checks++;
assert.equal(calls, 1); checks++;
assert.equal(await executor(() => true).compare(input), "MATCH"); checks++;
const oneShot = executor(() => true);
assert.equal(await oneShot.compare(input), "MATCH"); checks++;
const beforeRepeat = calls;
assert.equal(await oneShot.compare(input), "UNKNOWN"); checks++;
assert.equal(calls, beforeRepeat); checks++;
assert.equal(await executor(() => { throw new Error("drive gone"); }).compare(input), "UNKNOWN"); checks++;
console.log(`home legacy Kingston executor: ${checks}/${checks} synthetic checks PASS`);
