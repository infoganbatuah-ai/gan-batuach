import assert from "node:assert/strict";
import test from "node:test";
import { cameraPilotGrant } from "../../lib/management/camera-pilot-grant.mjs";

function fixture(patch = {}) {
  const handle = "a".repeat(48);
  let outstanding;
  const receipt = (binding, operation) => ({
    ...binding, version: 1, environment: "development", capability: "live_playback",
    recording: false, operation, handle, expiresAtMs: 15_000, ...patch
  });
  const options = {
    environment: "development", operation: "issue",
    viewer: { active: true, id: "viewer-a", role: "parent" },
    camera: { active: true, id: "camera-a", gardenId: "garden-a", siteId: "site-a" },
    now: () => 10_000, authorize: async () => true,
    provider: {
      async issue(binding) {
        outstanding = binding;
        return receipt(binding, "issue");
      },
      async consume(binding, key) {
        if (!outstanding || key !== handle ||
            !Object.keys(binding).every(field => binding[field] === outstanding[field])) return null;
        outstanding = undefined;
        return receipt(binding, "redeem");
      }
    }
  };
  return { handle, options, revoke: () => { outstanding = undefined; } };
}

test("issues minimal envelope and redeems once through the provider", async () => {
  const { options, handle } = fixture({ diagnostic: "private" });
  assert.deepEqual(await cameraPilotGrant(options), { handle, expiresAtMs: 15_000 });
  const redeem = { ...options, operation: "redeem", handle };
  const results = await Promise.all([cameraPilotGrant(redeem), cameraPilotGrant(redeem)]);
  assert.equal(results.filter(Boolean).length, 1);
});

test("provider revocation and changed viewer authorization prevent redemption", async () => {
  const { options, handle, revoke } = fixture();
  assert.ok(await cameraPilotGrant(options));
  const redeem = { ...options, operation: "redeem", handle };
  assert.equal(await cameraPilotGrant({ ...redeem, authorize: async () => false }), null);
  revoke();
  assert.equal(await cameraPilotGrant(redeem), null);
});

test("does not contact provider for denied tenant, role or environment", async () => {
  const { options } = fixture();
  let requests = 0;
  options.provider.issue = async () => { requests += 1; };
  assert.equal(await cameraPilotGrant({ ...options, authorize: async () => false }), null);
  for (const role of ["inspector", "admin"]) {
    assert.equal(await cameraPilotGrant({ ...options, viewer: { ...options.viewer, role } }), null);
  }
  assert.equal(await cameraPilotGrant({ ...options, environment: "production" }), null);
  assert.equal(requests, 0);
});

test("a scoped handle is not redeemable by a different tenant or identity", async () => {
  const { options, handle } = fixture();
  assert.ok(await cameraPilotGrant(options));
  const redeem = { ...options, operation: "redeem", handle };
  assert.equal(await cameraPilotGrant({ ...redeem, camera: { ...options.camera, gardenId: "garden-b" } }), null);
  assert.equal(await cameraPilotGrant({ ...redeem, viewer: { ...options.viewer, id: "viewer-b" } }), null);
  assert.ok(await cameraPilotGrant(redeem));
});

for (const patch of [
  { viewerId: "other" }, { role: "manager" }, { gardenId: "other" }, { siteId: "other" },
  { cameraId: "other" }, { expiresAtMs: 10_000 }, { expiresAtMs: 70_001 },
  { capability: "health" }, { environment: "production" }, { recording: true },
  { protocol: "HLS" }, { operation: "redeem" }, { handle: "https://example.invalid" }
]) {
  test("refuses altered " + Object.keys(patch)[0], async () => {
    assert.equal(await cameraPilotGrant(fixture(patch).options), null);
  });
}

test("provider failure fails closed", async () => {
  const { options } = fixture();
  options.provider.issue = async () => { throw new Error("offline"); };
  assert.equal(await cameraPilotGrant(options), null);
});
