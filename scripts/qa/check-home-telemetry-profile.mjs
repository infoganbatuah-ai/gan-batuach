import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { refreshDeviceCredentials } from "../../services/video-gateway/device-refresh.mjs";
import { resolveHomeTelemetryProfile } from "../../services/video-gateway/home-telemetry-profile.mjs";

const gatewayId = "62df97e2-3c0b-427f-9108-bde029bc10e7";
const siteId = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";

function fixture(deviceType) {
  const root = mkdtempSync(join(tmpdir(), "observer-telemetry-profile-"));
  const ota = join(root, "ota");
  const qaDir = join(ota, "home-qa-device-secrets");
  const legacyDir = join(root, "legacy-secrets");
  mkdirSync(qaDir, { recursive: true, mode: 0o700 });
  mkdirSync(legacyDir, { mode: 0o700 });
  const qa = createEdgeSecretStoreSync({ secretDir: qaDir });
  qa.write("device_credential_version", "1");
  qa.write("device_private_key_pkcs8", "synthetic-private-key");
  qa.write("device_cloud_base_url", "https://127.0.0.1:3101");
  const legacy = createEdgeSecretStoreSync({ secretDir: legacyDir });
  legacy.write("device_gateway_id", gatewayId);
  legacy.write("device_observer_site_id", siteId);
  legacy.write("device_refresh_token", "synthetic-refresh-token-0123456789abcdef");
  legacy.write("device_cloud_base_url", "https://gan-batuach.vercel.app");
  const now = Date.parse("2026-10-21T10:00:00Z");
  const authorizationFile = join(root, "owner-approval.json");
  const approval = { contract: "observer-home-production-telemetry-authorization-v1",
    device_type: deviceType, gateway_id: gatewayId, observer_site_id: siteId,
    production_cloud_url: "https://gan-batuach.vercel.app", approval_reference: "synthetic-qa-only",
    approved_at: new Date(now - 1000).toISOString(), expires_at: new Date(now + 60_000).toISOString(),
    legacy_auth_proof: "VERIFIED", backup_proof: "VERIFIED", rollback_proof: "VERIFIED" };
  const writeApproval = (value = approval) => writeFileSync(authorizationFile, JSON.stringify(value), { mode: 0o600 });
  const select = (options = {}) => resolveHomeTelemetryProfile({ deviceType, legacyStore: legacy,
    homeQaIdentityDir: qaDir, now, ...options });
  return { root, qaDir, legacy, authorizationFile, approval, writeApproval, select,
    cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

for (const deviceType of ["PHYSICAL_GATEWAY", "SOFTWARE_CONNECTOR"]) {
  test(`${deviceType}: QA is default and Production requires a scoped owner approval`, () => {
    const f = fixture(deviceType);
    try {
      assert.deepEqual(f.select(), { profile: "QA", identityDir: realpathSync(f.qaDir), cloudUrl: "https://127.0.0.1:3101" });
      assert.throws(() => f.select({ profile: "PRODUCTION" }), /TELEMETRY_PRODUCTION_GATE_MISSING/);
      f.writeApproval();
      assert.deepEqual(f.select({ profile: "PRODUCTION", authorizationFile: f.authorizationFile }),
        { profile: "PRODUCTION", identityDir: "", cloudUrl: "https://gan-batuach.vercel.app" });
      assert.throws(() => f.select({ profile: "PRODUCTION", authorizationFile: f.authorizationFile,
        configuredIdentityDir: f.qaDir }), /TELEMETRY_PRODUCTION_GATE_MISSING/);
      assert.throws(() => f.select({ profile: "PRODUCTION", authorizationFile: f.authorizationFile,
        connectorCloudUrl: "https://127.0.0.1:3101" }), /TELEMETRY_PRODUCTION_AUTHORIZATION_INVALID/);
      assert.throws(() => f.select({ profile: "PRODUCTION", authorizationFile: f.authorizationFile,
        now: Date.parse(f.approval.expires_at) }), /TELEMETRY_PRODUCTION_AUTHORIZATION_INVALID/);
      f.writeApproval({ ...f.approval, legacy_auth_proof: "UNVERIFIED" });
      assert.throws(() => f.select({ profile: "PRODUCTION", authorizationFile: f.authorizationFile }),
        /TELEMETRY_PRODUCTION_AUTHORIZATION_INVALID/);
    } finally { f.cleanup(); }
  });

  test(`${deviceType}: missing managed QA identity never falls back to legacy Production`, () => {
    const f = fixture(deviceType);
    try {
      rmSync(f.qaDir, { recursive: true });
      assert.throws(() => f.select(), /ENOENT/);
    } finally { f.cleanup(); }
  });
}

test("isolated QA → synthetic legacy refresh/health → QA rollback preserves IDs and one reporter", async () => {
  const f = fixture("PHYSICAL_GATEWAY");
  try {
    f.writeApproval();
    const sourceIds = Array.from({ length: 17 }, (_, index) => `synthetic-source-${index + 1}`);
    const health = new Map();
    let activeReporter = null;
    const report = (selected, status) => {
      assert.equal(activeReporter, null, "a second reporter must not overlap");
      activeReporter = selected.profile;
      for (const id of sourceIds) health.set(id, { status, reporter: activeReporter });
      activeReporter = null;
    };
    report(f.select(), "QA_CONNECTED");
    const production = f.select({ profile: "PRODUCTION", authorizationFile: f.authorizationFile });
    let acceptedToken = f.legacy.read("device_refresh_token");
    const credentials = await refreshDeviceCredentials({ gatewayId, cloudBaseUrl: production.cloudUrl,
      readSecret: async key => f.legacy.read(key), writeSecret: async (key, value) => f.legacy.write(key, value),
      removeSecret: async key => f.legacy.remove(key), fetcher: async (_url, init) => {
        const request = JSON.parse(init.body);
        if (request.action !== "refresh" || request.gateway_id !== gatewayId || request.refresh_token !== acceptedToken) {
          return { status: 401, ok: false, json: async () => ({}) };
        }
        acceptedToken = request.next_refresh_token;
        return { status: 200, ok: true, json: async () => ({ data: { rotation_protocol: 2,
          refresh_token: acceptedToken, access_token: "synthetic-access-token" } }) };
      } });
    assert.equal(credentials.accessToken, "synthetic-access-token");
    assert.equal(f.legacy.read("device_refresh_token"), acceptedToken);
    report(production, "SYNTHETIC_PRODUCTION_CONNECTED");
    report(f.select(), "QA_CONNECTED");
    assert.equal(health.size, 17);
    assert.equal([...health.values()].every(value => value.status === "QA_CONNECTED" && value.reporter === "QA"), true);
  } finally { f.cleanup(); }
});
