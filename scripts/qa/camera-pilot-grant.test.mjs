import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, verify } from "node:crypto";
import { cameraPilotGrant, createCameraPilotSessionRegistry, createCameraPilotLoopbackTransport, readCameraPilotOffer, requestCameraPilotPlayback, signCameraPilotAssertion } from "../../lib/management/camera-pilot-grant.mjs";

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
  { cameraId: "other" }, { expiresAtMs: 10_000 }, { expiresAtMs: 55_001 },
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

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const signingInput = {
  environment: "development", qaGardenId: "garden-a", sessionId: "session-a",
  operation: "issue", privateKey, now: () => 10_000,
  binding: { viewerId: "viewer-a", role: "parent", gardenId: "garden-a",
    siteId: "site-a", cameraId: "camera-a", protocol: "WebRTC" }
};

function verifyEnvelope(assertion) {
  const [payload, signature] = assertion.split(".");
  assert.ok(verify(null, Buffer.from(payload), publicKey, Buffer.from(signature, "base64url")));
  return JSON.parse(Buffer.from(payload, "base64url"));
}

test("creates signed DO assertions with unique request IDs and bounded lifetime", () => {
  const issued = verifyEnvelope(signCameraPilotAssertion(signingInput));
  assert.equal(issued.audience, "digital_observer:gan_camera_pilot");
  assert.deepEqual(issued.binding, signingInput.binding);
  assert.equal(issued.sessionId, "session-a");
  assert.equal(issued.expiresAtMs - issued.issuedAtMs, 45_000);
  assert.ok(!Object.hasOwn(issued, "handle"));
  const handle = "a".repeat(48);
  const redeemed = verifyEnvelope(signCameraPilotAssertion({ ...signingInput, operation: "redeem", handle }));
  assert.equal(redeemed.handle, handle);
  assert.equal(redeemed.operation, "redeem");
  assert.notEqual(redeemed.jti, issued.jti);
});

test("refuses to sign outside the configured QA garden and trusted session shape", () => {
  for (const patch of [
    { environment: "production" }, { qaGardenId: "garden-b" }, { sessionId: "" },
    { privateKey: publicKey }, { operation: "redeem" }, { handle: "a".repeat(48) }
  ]) assert.equal(signCameraPilotAssertion({ ...signingInput, ...patch }), null);
});

test("adapter proves current session access before signing each operation", async () => {
  const events = [];
  const handle = "a".repeat(48);
  let authorized = true;
  const request = {
    config: { environment: "development", qaGardenId: "garden-a", privateKey },
    context: {
      sessionId: "session-a", viewer: { id: "viewer-a", role: "parent", active: true },
      camera: { id: "camera-a", gardenId: "garden-a", siteId: "site-a", active: true }
    },
    operation: "issue", now: () => 10_000,
    authorize: async ({ binding, sessionId }) => {
      events.push("authorize");
      assert.deepEqual(binding, signingInput.binding);
      assert.equal(sessionId, signingInput.sessionId);
      return authorized;
    },
    transport: async ({ operation, assertion, signal }) => {
      events.push("transport");
      assert.equal(signal.aborted, false);
      const proof = verifyEnvelope(assertion);
      assert.equal(proof.operation, operation);
      assert.equal(proof.sessionId, "session-a");
      if (operation === "redeem") assert.equal(proof.handle, handle);
      return {
        ...proof.binding, version: 1, environment: "development", capability: "live_playback",
        recording: false, operation, handle, expiresAtMs: 15_000
      };
    }
  };
  assert.ok(await requestCameraPilotPlayback(request));
  assert.ok(await requestCameraPilotPlayback({ ...request, operation: "redeem", handle }));
  authorized = false;
  assert.equal(await requestCameraPilotPlayback({ ...request, operation: "redeem", handle }), null);
  assert.deepEqual(events, ["authorize", "transport", "authorize", "transport", "authorize"]);
});

test("adapter skips authorization and transport when the pilot is unavailable", async () => {
  let calls = 0;
  const request = {
    config: { environment: "development", qaGardenId: "garden-a", privateKey },
    context: { sessionId: "session-a", camera: { gardenId: "garden-b" } },
    operation: "issue", authorize: async () => { calls += 1; },
    transport: async () => { calls += 1; }
  };
  assert.equal(await requestCameraPilotPlayback(request), null);
  assert.equal(await requestCameraPilotPlayback({ ...request, transport: undefined }), null);
  assert.equal(calls, 0);
});

test("accepts a bounded candidate-free offer for one receive-only video stream", async () => {
  const offer = "v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=recvonly\r\n";
  const createRequest = (body, type = "application/sdp") =>
    new Request("http://127.0.0.1/pilot", { method: "POST", headers: { "content-type": type }, body });
  assert.equal(await readCameraPilotOffer(createRequest(offer)), offer);
  assert.equal(await readCameraPilotOffer(createRequest(offer, "text/plain")), null);
  for (const input of [
    offer + "a=candidate:1\r\n", offer + "a=remote-candidates:1\r\n",
    offer + "m=audio 9 UDP/TLS/RTP/SAVPF 96\r\n", offer.replace("recvonly", "sendrecv"),
    offer + "a=".padEnd(16_384, "x")
  ]) assert.equal(await readCameraPilotOffer(createRequest(input)), null);
});

test("Observer HTTP fixture receives fixed loopback paths and only server credentials", async () => {
  const calls = [];
  const serviceToken = "s".repeat(43);
  const transport = createCameraPilotLoopbackTransport({
    origin: "http://127.0.0.1:4444", serviceToken,
    fetcher: async (url, request) => {
      calls.push([url.href, request]);
      return url.pathname.endsWith("revoke") ? new Response(null, { status: 204 }) :
        new Response("v=0\r\n", { status: 201, headers: {
          "content-type": "application/sdp", "cache-control": "private, no-store"
        } });
    }
  });
  const assertion = signCameraPilotAssertion(signingInput);
  assert.equal(await transport.signal(assertion, "v=0\r\n"), "v=0\r\n");
  assert.equal(await transport.revoke("h".repeat(43)), true);
  assert.deepEqual(calls.map(([url]) => url), [
    "http://127.0.0.1:4444/pilot/whep", "http://127.0.0.1:4444/pilot/revoke"
  ]);
  assert.equal(calls[0][1].headers.Authorization, "Bearer " + serviceToken);
  assert.equal(calls[0][1].headers["X-Gan-Pilot-Assertion"], assertion);
  assert.equal(calls[0][1].redirect, "error");
  assert.deepEqual(JSON.parse(calls[1][1].body), { handle: "h".repeat(43) });
  assert.equal(createCameraPilotLoopbackTransport({ origin: "http://localhost:4444", serviceToken }), null);
});

test("Observer HTTP fixture refuses a malformed or oversized answer", async () => {
  for (const [body, cache] of [["v=0", "public"], ["v=0" + "x".repeat(16_384), "private, no-store"]]) {
    const transport = createCameraPilotLoopbackTransport({
      origin: "http://127.0.0.1:4444", serviceToken: "s".repeat(43),
      fetcher: async () => new Response(body, { status: 201, headers: {
        "content-type": "application/sdp", "cache-control": cache
      } })
    });
    assert.equal(await transport.signal(signCameraPilotAssertion(signingInput), "v=0"), null);
  }
});

test("registry scopes lookup, denies a second viewer, and blocks immediately on logout", async () => {
  const revoked = [];
  let succeed = false;
  const registry = createCameraPilotSessionRegistry({
    qaGardenId: "garden-a", now: () => 10_000,
    revoke: async handle => { revoked.push(handle); return succeed; }
  });
  const context = {
    sessionId: "session-a", viewer: { id: "viewer-a", role: "parent", active: true },
    camera: { id: "camera-a", gardenId: "garden-a", siteId: "site-a", active: true }
  };
  const grant = { handle: "h".repeat(43), expiresAtMs: 15_000 };
  assert.equal(registry.register(context, grant), true);
  assert.deepEqual(registry.lookup(context), grant);
  assert.equal(registry.lookup({ ...context, viewer: { ...context.viewer, role: "manager" } }), null);
  assert.equal(registry.lookup({ ...context, camera: { ...context.camera, gardenId: "garden-b" } }), null);
  assert.equal(registry.register({ ...context, sessionId: "session-b" }, grant), false);
  assert.equal(await registry.stop("session-b"), false);
  assert.deepEqual(revoked, []);
  const stop = registry.stop("session-a");
  assert.equal(registry.lookup(context), null);
  assert.equal(await stop, false);
  assert.equal(registry.register(context, grant), false);
  succeed = true;
  assert.equal(await registry.stop("session-a"), true);
  assert.deepEqual(revoked, [grant.handle, grant.handle]);
  assert.equal(registry.lookup(context), null);
});
