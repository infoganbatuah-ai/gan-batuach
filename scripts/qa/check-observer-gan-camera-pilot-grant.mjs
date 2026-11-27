import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { loadTs } from "./digital-guard-test-loader.mjs";

const { createGanCameraPilotGrantProvider, createGanCameraPilotHostAuthorization, ganCameraPilotLimits } = loadTs("lib/domain/digital-observer/gan-camera-pilot-grant.ts");
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const foreignKey = generateKeyPairSync("ed25519").privateKey;
const binding = { viewerId: "viewer-a", role: "parent", gardenId: "garden-a", siteId: "site-a", cameraId: "camera-a", protocol: "WebRTC" };
const mapping = { sessionId: "session-a", tenantId: "tenant-a", sourceId: "source-a", gatewayId: "gateway-a", streamId: "stream-a" };

function fixture() {
  let timestamp = 10_000;
  let nextJti = 0;
  let currentScope = { ...binding, ...mapping };
  let lookups = 0;
  const outstanding = new Map();
  const issuedAssertions = new Set();
  const now = () => timestamp;
  const store = {
    async issue(record, jti) {
      if (issuedAssertions.has(jti) || outstanding.has(record.handle) || now() >= record.expiresAtMs) return false;
      issuedAssertions.add(jti);
      outstanding.set(record.handle, structuredClone(record));
      return true;
    },
    async consume(handle, scope, assertionExpiresAtMs) {
      const record = outstanding.get(handle);
      if (!record || Math.min(record.expiresAtMs, assertionExpiresAtMs) <= now() ||
          Object.keys(record.scope).some((field) => scope[field] !== record.scope[field])) return null;
      outstanding.delete(handle);
      return record;
    },
    async revoke(handle) { outstanding.delete(handle); }
  };
  const resolveScope = async () => { lookups++; return currentScope; };
  function signed(overrides = {}, key = privateKey) {
    const assertion = {
      version: 1, issuer: "gan_batuach", audience: "digital_observer:gan_camera_pilot", environment: "development",
      binding, sessionId: mapping.sessionId, operation: "issue", jti: String(++nextJti).padStart(32, "0"),
      issuedAtMs: now(), expiresAtMs: now() + 45_000, ...overrides
    };
    const payload = Buffer.from(JSON.stringify(assertion)).toString("base64url");
    return `${payload}.${sign(null, Buffer.from(payload), key).toString("base64url")}`;
  }
  function provider(signedAssertion = signed(), overrides = {}) {
    return createGanCameraPilotGrantProvider({ environment: "development", qaGardenId: binding.gardenId,
      signedAssertion, ganPublicKey: publicKey, resolveScope, store, now, ...overrides });
  }
  return { signed, provider, store, now, get lookups() { return lookups; },
    advance: (ms) => { timestamp += ms; }, setScope: (value) => { currentScope = value; } };
}

test("issues an opaque Gan receipt and atomically admits only one concurrent redemption", async () => {
  const h = fixture();
  const issuer = h.provider();
  const [first, duplicate] = await Promise.all([issuer.issue(binding), issuer.issue(binding)]);
  assert.ok(first);
  assert.equal(duplicate, null);
  assert.deepEqual(first, { ...binding, version: 1, environment: "development", capability: "live_playback",
    recording: false, operation: "issue", handle: first.handle, expiresAtMs: 55_000 });
  assert.match(first.handle, /^[A-Za-z0-9_-]{43}$/);
  const redeemer = h.provider(h.signed({ operation: "redeem", handle: first.handle, expiresAtMs: 50_000 }));
  const accepted = (await Promise.all([redeemer.consume(binding, first.handle), redeemer.consume(binding, first.handle)])).filter(Boolean);
  assert.deepEqual(accepted, [{ ...first, operation: "redeem", expiresAtMs: 50_000 }]);
  assert.deepEqual(ganCameraPilotLimits, { durationSeconds: 300, cumulativeBytes: 104_857_600, viewers: 1, streams: 1, sources: 1 });
});

test("rejects forged, expired, foreign and out-of-domain assertions before looking up the scope", async () => {
  const h = fixture();
  for (const signed of [
    h.signed({}, foreignKey),
    h.signed({ issuer: "other" }),
    h.signed({ audience: "other" }),
    h.signed({ environment: "production" }),
    h.signed({ expiresAtMs: h.now() }),
    h.signed({ issuedAtMs: h.now() + 1 }),
    h.signed({ expiresAtMs: h.now() + 45_001 }),
    h.signed({ binding: { ...binding, role: "admin" } }),
    h.signed({ binding: { ...binding, protocol: "HLS" } })
  ]) assert.equal(await h.provider(signed).issue(binding), null);
  assert.equal(await h.provider(h.signed(), { environment: "production" }).issue(binding), null);
  assert.equal(h.lookups, 0);
});

test("a different garden, site, camera, viewer or role cannot use the same assertion", async () => {
  const h = fixture();
  const provider = h.provider();
  for (const [key, value] of Object.entries({
    gardenId: "garden-b", siteId: "site-b", cameraId: "camera-b", viewerId: "viewer-b", role: "staff"
  })) assert.equal(await provider.issue({ ...binding, [key]: value }), null);
  const unrelatedGarden = { ...binding, gardenId: "garden-b" };
  assert.equal(await h.provider(h.signed({ binding: unrelatedGarden })).issue(unrelatedGarden), null);
  assert.equal(h.lookups, 0);
  assert.ok(await provider.issue(binding));
});

test("redemption rechecks session, source and role and binds the signed handle", async () => {
  const h = fixture();
  const { handle } = await h.provider().issue(binding);
  const redeem = h.provider(h.signed({ operation: "redeem", handle }));
  assert.equal(await redeem.consume(binding, "x".repeat(43)), null);
  assert.equal(await h.provider().consume(binding, handle), null);
  assert.equal(await h.provider(h.signed({ operation: "redeem", handle, sessionId: "session-b" })).consume(binding, handle), null);
  for (const key of ["tenantId", "sourceId", "gatewayId", "streamId", "role"]) {
    h.setScope({ ...binding, ...mapping, [key]: key === "role" ? "staff" : "another" });
    assert.equal(await redeem.consume(binding, handle), null);
  }
  h.setScope(null);
  assert.equal(await redeem.consume(binding, handle), null);
  h.setScope({ ...binding, ...mapping });
  assert.ok(await redeem.consume(binding, handle));
});

test("revoked or expired handles and failed storage or lookup do not authorize playback", async () => {
  const h = fixture();
  const revoked = await h.provider().issue(binding);
  await h.store.revoke(revoked.handle);
  assert.equal(await h.provider(h.signed({ operation: "redeem", handle: revoked.handle })).consume(binding, revoked.handle), null);
  const expired = await h.provider().issue(binding);
  h.advance(45_000);
  assert.equal(await h.provider(h.signed({ operation: "redeem", handle: expired.handle })).consume(binding, expired.handle), null);
  const fail = () => { throw Error("synthetic fault"); };
  assert.equal(await h.provider(h.signed(), { resolveScope: fail }).issue(binding), null);
  assert.equal(await h.provider(h.signed(), { store: { ...h.store, issue: fail } }).issue(binding), null);
});

test("a lookup that runs past assertion expiry cannot create a handle", async () => {
  const h = fixture();
  let writes = 0;
  const provider = h.provider(h.signed(), {
    resolveScope: async () => { h.advance(45_000); return { ...binding, ...mapping }; },
    store: { ...h.store, async issue() { writes++; return true; } }
  });
  assert.equal(await provider.issue(binding), null);
  assert.equal(writes, 0);
});

test("the host requires both the Gan server credential and the signed viewer assertion", async () => {
  const h = fixture();
  const issued = await h.provider().issue(binding);
  const service = "s".repeat(43);
  const authorization = `Bearer ${service}`;
  const proof = h.signed({ operation: "redeem", handle: issued.handle });
  const { redeem: authorize } = createGanCameraPilotHostAuthorization({ environment: "development", qaGardenId: binding.gardenId,
    ganPublicKey: publicKey, ganServiceBearerSha256: createHash("sha256").update(service).digest("hex"),
    store: h.store, now: h.now, resolveScope: async () => ({ ...binding, ...mapping }) });
  assert.equal(await authorize({ headers: { "x-gan-pilot-assertion": proof } }), null);
  assert.equal(await authorize({ headers: { authorization, "x-gan-pilot-assertion": [proof] } }), null);
  assert.equal(await authorize({ headers: { authorization, "x-gan-pilot-assertion": h.signed({ operation: "redeem", handle: issued.handle }, foreignKey) } }), null);
  assert.deepEqual(await authorize({ headers: { authorization, "x-gan-pilot-assertion": proof } }),
    { handle: issued.handle, scope: { ...binding, ...mapping } });
  assert.equal(await authorize({ headers: { authorization, "x-gan-pilot-assertion": proof } }), null);
});

if (process.env.GAN_PILOT_CONTRACT_PATH) {
  test("composes the actual Gan stage-three caller with the DO provider", async () => {
    const { cameraPilotGrant } = await import(pathToFileURL(process.env.GAN_PILOT_CONTRACT_PATH));
    const h = fixture();
    const input = { environment: "development", viewer: { id: binding.viewerId, role: binding.role, active: true },
      camera: { id: binding.cameraId, gardenId: binding.gardenId, siteId: binding.siteId, active: true },
      authorize: async (scope) => { assert.deepEqual(scope, binding); return true; }, now: h.now };
    const result = await cameraPilotGrant({ ...input, operation: "issue", provider: h.provider() });
    assert.ok(result);
    const { handle } = result;
    const provider = h.provider(h.signed({ operation: "redeem", handle }));
    assert.deepEqual(await cameraPilotGrant({ ...input, operation: "redeem", provider, handle }), result);
    assert.equal(await cameraPilotGrant({ ...input, operation: "redeem", provider, handle }), null);
  });
}
