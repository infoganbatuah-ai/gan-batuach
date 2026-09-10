import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { claimDesktopInstallation, pollDesktopInstallation, validateInstallDocument } from "../../services/video-gateway/desktop-enrollment.mjs";
import { loadTs } from "./digital-guard-test-loader.mjs";
const contract = loadTs("lib/domain/digital-observer/connector-installation.ts");
const intelligence = loadTs("lib/domain/digital-observer/connection-intelligence.ts");
test("commercial friction separates capability, coverage and real success and rejects private data", () => {
  const schema = intelligence.connectivityObservationSchema.shape.commercial;
  const sample = { productActions: 4, technicalActions: null, installerActions: null, discoverySucceeded: true,
    technicalCapability: "LOCAL_PATH_VERIFIED", digitalObserverCoverage: "INTEGRATION_MISSING",
    observedSuccess: "NOT_VERIFIED", requirementBasis: "PRODUCT_COVERAGE" };
  assert.equal(schema.safeParse(sample).success, true);
  for (const field of ["password", "ip", "url", "hostname", "note"])
    assert.equal(schema.safeParse({ ...sample, [field]: "private" }).success, false);
  assert.equal(schema.safeParse({ ...sample, technicalActions: -1 }).success, false);
});
function fixture() {
  const values = new Map();
  return { values, store: { read: k => values.get(k) ?? null, write: (k, v) => values.set(k, v), remove: k => values.delete(k) },
    document: { version: "connector-install-v1", intent_id: randomUUID(), observer_site_id: randomUUID(), secret: "a".repeat(43),
      expires_at: new Date(Date.now() + 600000).toISOString(), origin: "https://ganbatuach.com" },
    platform: "macos-arm64", version: "connector-desktop-v1", build: "qa" };
}
test("install document rejects destinations, secret URLs, unknown keys and expiration", () => {
  const { document } = fixture();
  assert.equal(validateInstallDocument(document), document);
  for (const change of [{ origin: "https://example.org" }, { password: "fixture" }, { expires_at: "invalid" }, { expires_at: new Date(0).toISOString() }, { secret: "short" }])
    assert.throws(() => validateInstallDocument({ ...document, ...change }));
});
test("platform detection never offers native desktop installation to phone", () => {
  assert.equal(contract.installerPlatform("iPhone Mac OS X"), "MOBILE");
  assert.equal(contract.installerPlatform("Windows NT 10.0"), "WINDOWS");
  assert.equal(contract.installerPlatform("Macintosh Mac OS X"), "MACOS");
  assert.equal(contract.installerPlatform("Linux"), "UNSUPPORTED");
});
test("claim persists independent identity before transport and excludes prepared refresh key", async () => {
  const f = fixture();
  await claimDesktopInstallation({ ...f, post: async (_path, body) => {
    assert.ok(f.store.read("desktop_enrollment_pending"));
    assert.ok(f.store.read("device_installation_id").startsWith("edge-"));
    assert.equal(body.delivery_refresh_token, undefined);
    assert.equal(body.document.observer_site_id, f.document.observer_site_id);
  } });
  assert.equal(f.store.read("device_gateway_id"), null);
});
test("restart after claim network loss reuses exact identity and request proof", async () => {
  const f = fixture(); let first;
  await assert.rejects(claimDesktopInstallation({ ...f, post: async (_p, body) => { first = body; throw new Error("NETWORK"); } }));
  await claimDesktopInstallation({ ...f, post: async (_p, body) => assert.deepEqual(body, first) });
});
test("consumed claim only recovers through original poll proof; conflict is not enrollment", async () => {
  const f = fixture(); await claimDesktopInstallation({ ...f, post: async () => ({}) });
  const paths = [];
  await claimDesktopInstallation({ ...f, post: async (path, body) => {
    paths.push(path); if (body.action === "claim") throw new Error("INSTALL_REQUEST_409"); return { status: "pending" };
  } });
  assert.equal(paths.length, 2); assert.equal(f.store.read("device_gateway_id"), null);
});
test("wrong-site delivery cannot commit local identity", async () => {
  const f = fixture(); await claimDesktopInstallation({ ...f, post: async () => ({}) });
  const prepared = JSON.parse(f.store.read("desktop_enrollment_pending"));
  await assert.rejects(pollDesktopInstallation({ ...f, post: async () => ({ status: "linked", observer_site_id: randomUUID(), gateway_id: randomUUID(), refresh_token: prepared.delivery_refresh_token }) }), /SCOPE_MISMATCH/);
  assert.equal(f.store.read("device_gateway_id"), null);
});
test("delivery and restart preserve identity, consume pending material once, no second enrollment", async () => {
  const f = fixture(); await claimDesktopInstallation({ ...f, post: async () => ({}) });
  const gateway = randomUUID();
  const post = async () => ({ status: "linked", observer_site_id: f.document.observer_site_id, gateway_id: gateway,
    identity_scheme: "ED25519_V1", credential_version: 1, deployment_profile: "SOFTWARE_CONNECTOR" });
  assert.equal((await pollDesktopInstallation({ ...f, post })).status, "ENROLLED");
  assert.equal(f.store.read("desktop_enrollment_pending"), null);
  assert.equal((await pollDesktopInstallation({ ...f, post: async () => assert.fail("restart must not enroll") })).status, "ENROLLED");
  await assert.rejects(claimDesktopInstallation({ ...f, post }), /ALREADY_ENROLLED/);
  assert.equal(f.store.read("device_gateway_id"), gateway);
});
test("expired unapproved handoff replacement preserves installation identity", async () => {
  const f = fixture(); await claimDesktopInstallation({ ...f, post: async () => ({}) });
  const id = f.store.read("device_installation_id"), pending = JSON.parse(f.store.read("desktop_enrollment_pending"));
  pending.document.expires_at = new Date(0).toISOString(); f.store.write("desktop_enrollment_pending", JSON.stringify(pending));
  await claimDesktopInstallation({ ...f, document: { ...f.document, intent_id: randomUUID() }, post: async () => ({}) });
  assert.equal(f.store.read("device_installation_id"), id);
});
test("health unknown, stale, future and revoked never mean connector found", () => {
  const base = { state: "CLAIMED", expiresAt: new Date(Date.now() + 60000).toISOString(), enrollmentStatus: "delivered" };
  for (const heartbeatAt of [undefined, "invalid", new Date(0).toISOString(), new Date(Date.now() + 60000).toISOString()])
    assert.equal(contract.installationStage({ ...base, heartbeatAt }), "WAITING_FOR_CONNECTOR");
  assert.equal(contract.installationStage({ ...base, heartbeatAt: new Date().toISOString() }), "CONNECTOR_FOUND");
  assert.equal(contract.installationStage({ ...base, enrollmentStatus: "revoked", heartbeatAt: new Date().toISOString() }), "REVOKED");
});
test("Product requests cannot mass-assign actor, gateway or claimed healthy status", () => {
  const { document } = fixture();
  for (const key of ["actor_profile_id", "gateway_id", "stage", "tenant_id"])
    assert.equal(contract.installIntentRequestSchema.safeParse({ action: "create", observer_site_id: document.observer_site_id, [key]: randomUUID() }).success, false);
});
test("server approval locks original account/site and binds delivery recovery to one-time poll proof", () => {
  const route = readFileSync("app/api/digital-observer/gateway-enrollment/route.ts", "utf8");
  assert.ok(route.includes("pending.data.created_by_profile_id !== session.profile.id"));
  assert.ok(route.includes("pending.data.observer_site_id !== site.id"));
  assert.ok(route.includes("enrollment.data.metadata.delivery_receipt_hash === deliveryReceipt"));
  assert.ok(route.includes('identity_scheme: "ED25519_V1"'));
  assert.ok(route.includes('enrollment.data.status === "delivered"'));
});
test("native host pipes secrets and uses isolated fixed service; never arbitrary cloud shell", () => {
  const source = readFileSync("services/connector-desktop/macos/DesktopHost.swift", "utf8");
  assert.ok(source.includes("FileHandle.standardInput.readDataToEndOfFile"));
  assert.ok(source.includes('let secretService = "com.digitalobserver.connector.commercial.v1"'));
  assert.ok(source.includes('"VIDEO_GATEWAY_PORT": "18084"'));
  assert.ok(source.includes('"RunAtLoad": true'));
  assert.ok(!source.includes("/bin/sh"));
});
