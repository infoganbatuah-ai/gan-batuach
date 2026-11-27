import assert from "node:assert/strict";
import { createPublicKey, randomBytes, verify } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { openProductDeviceIdentity, productDeviceStoreName, verifyProductDeviceIdentity } from "../../services/video-gateway/product-device-identity.mjs";
import { confirmProductDeviceMigration, productDeviceMigrationRequest, recordProductDeviceMigrationChallenge,
  stageProductDeviceMigration } from "../../services/video-gateway/product-device-migration.mjs";

const gatewayId = "11111111-1111-4111-8111-111111111111";
const siteId = "22222222-2222-4222-8222-222222222222";
const rotationId = "33333333-3333-4333-8333-333333333333";
const binding = { gatewayId, siteId };
const now = 1_800_000_000_000;

function rootFor(t) {
  const root = mkdtempSync(join(tmpdir(), "observer-device-migration-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function fixture(t) {
  const root = rootFor(t);
  const request = stageProductDeviceMigration(root, binding);
  const { directory, store } = openProductDeviceIdentity(root);
  const challenge = randomBytes(32).toString("base64url");
  const prepared = { status: "MIGRATION_PREPARED", gateway_id: gatewayId, new_credential_version: 1,
    rotation_id: rotationId, challenge, expires_at: new Date(now + 300_000).toISOString() };
  return { root, directory, request, store, prepared };
}

test("staging keeps the original binding and provides only public material", t => {
  const { root, request, store } = fixture(t);
  assert.deepEqual(Object.keys(request).sort(), ["action", "gateway_id", "new_credential_algorithm", "new_public_key_spki", "observer_site_id"]);
  assert.equal(request.gateway_id, gatewayId);
  assert.equal(request.observer_site_id, siteId);
  assert.deepEqual(productDeviceMigrationRequest(store), request);
  assert.throws(() => stageProductDeviceMigration(root, binding), { code: "EEXIST" });
  assert.throws(() => verifyProductDeviceIdentity(store, binding));
});

test("reject unsafe stores, swapped binding, expired challenge and unexpected version", async t => {
  const { root, directory, store, prepared } = fixture(t);
  chmodSync(directory, 0o755);
  assert.throws(() => openProductDeviceIdentity(root), /STORE_UNSAFE/);
  chmodSync(directory, 0o700);
  const unsafeRoot = rootFor(t);
  const target = join(unsafeRoot, "alternate");
  mkdirSync(target, { mode: 0o700 });
  symlinkSync(target, join(unsafeRoot, productDeviceStoreName));
  assert.throws(() => openProductDeviceIdentity(unsafeRoot), /STORE_UNSAFE/);
  for (const invalid of [{ gateway_id: siteId }, { new_credential_version: 2 },
    { expires_at: new Date(now - 1).toISOString() }]) {
    assert.throws(() => recordProductDeviceMigrationChallenge(store, { ...prepared, ...invalid }, now),
      /CHALLENGE_INVALID/);
  }
  recordProductDeviceMigrationChallenge(store, prepared, now);
  const forbidden = () => assert.fail("unexpected network request");
  await assert.rejects(confirmProductDeviceMigration(store, { gatewayId, siteId: gatewayId }, { fetcher: forbidden, now }),
    /CONFIRMATION_NOT_READY/);
  await assert.rejects(confirmProductDeviceMigration(store, binding, { fetcher: forbidden, now: now + 300_001 }),
    /CONFIRMATION_NOT_READY/);
});

test("lost response reuses one signed confirmation after restart and never creates another enrollment", async t => {
  const { root, request, store, prepared } = fixture(t);
  recordProductDeviceMigrationChallenge(store, prepared, now);
  let confirmedBody;
  await assert.rejects(confirmProductDeviceMigration(store, binding, { now, fetcher: async (url, options) => {
    assert.equal(url, "https://ganbatuach.com/api/video-gateway/device-identity");
    assert.equal(options.redirect, "error");
    confirmedBody = options.body;
    const payload = JSON.parse(confirmedBody);
    assert.equal(payload.gateway_id, gatewayId);
    const canonical = ["observer-managed-device-rotation-v1", gatewayId, "1", rotationId, prepared.challenge].join("\n");
    assert(verify(null, Buffer.from(canonical), createPublicKey({ key: Buffer.from(request.new_public_key_spki, "base64url"),
      format: "der", type: "spki" }), Buffer.from(payload.signature, "base64url")));
    throw Error("lost_response");
  } }), /lost_response/);
  assert.equal(store.read("device_credential_version"), "");
  const reopened = openProductDeviceIdentity(root).store;
  await confirmProductDeviceMigration(reopened, binding, { now: now + 300_001, fetcher: async (_url, options) => {
    assert.equal(options.body, confirmedBody);
    return Response.json({ data: { status: "ROTATED", credential_version: 1, idempotent_recovery: true } });
  } });
  verifyProductDeviceIdentity(reopened, binding);
  assert.equal(reopened.read("device_gateway_id"), gatewayId);
  assert.equal(reopened.read("device_observer_site_id"), siteId);
  assert.equal(reopened.read("product_migration_journal"), "");
  await confirmProductDeviceMigration(reopened, binding, { fetcher: () => assert.fail("duplicate confirmation") });
});

test("a server rejection leaves the staged key recoverable and cannot enable the runtime", async t => {
  const { store, prepared } = fixture(t);
  recordProductDeviceMigrationChallenge(store, prepared, now);
  await assert.rejects(confirmProductDeviceMigration(store, binding, { now,
    fetcher: async () => Response.json({}, { status: 409 }) }), /CONFIRMATION_FAILED/);
  assert.equal(store.read("device_credential_version"), "");
  assert.throws(() => verifyProductDeviceIdentity(store, binding));
  assert.equal(productDeviceMigrationRequest(store).gateway_id, gatewayId);
});
