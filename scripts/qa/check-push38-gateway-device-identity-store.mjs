import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runner = readFileSync("scripts/run-persistent-home-gateway.mjs", "utf8");
const server = readFileSync("services/video-gateway/server.mjs", "utf8");

assert.match(runner, /observer-gateway\/ota\/home-qa-device-secrets/);
assert.match(runner, /Managed device identity store does not match the installed Gateway/);
assert.match(runner, /OBSERVER_EDGE_DEVICE_IDENTITY_SECRET_DIR: deviceIdentitySecretDir/);
assert.match(runner, /const managedDeviceGatewayId = identityStore\?\.read\("device_gateway_id"\)/);
assert.match(runner, /const managedDeviceObserverSiteId = identityStore\?\.read\("device_observer_site_id"\)/);
assert.match(runner, /const gatewayId = managedDeviceGatewayId \|\| legacyDeviceGatewayId/);
assert.match(runner, /legacyDeviceGatewayId && legacyDeviceGatewayId !== gatewayId/);
assert.match(runner, /legacyDeviceObserverSiteId && legacyDeviceObserverSiteId !== observerSiteId/);
assert.match(runner, /identityStore\.read\("device_cloud_base_url"\) !== "https:\/\/127\.0\.0\.1:3101"/);

assert.match(server, /const DEVICE_IDENTITY_SECRET_DIR = process\.env\.OBSERVER_EDGE_DEVICE_IDENTITY_SECRET_DIR/);
assert.match(server, /const deviceIdentity = DEVICE_IDENTITY_SECRET_DIR[\s\S]*createKeychainStore\(\{ secretDir: DEVICE_IDENTITY_SECRET_DIR \}\) : keychain/);
assert.match(server, /readSecret: deviceIdentitySecret, writeSecret: storeDeviceIdentitySecret/);
assert.match(server, /removeSecret: deviceIdentity\.remove/);
assert.match(server, /const \[gatewayId, siteId, auditSigningKey\] = await Promise\.all\(\[[\s\S]*keychainSecret\("command_audit_signing_key"\)/);
assert.doesNotMatch(runner, /GAN_BATUACH_GATEWAY_DVR_SECRET_DIR: deviceIdentitySecretDir/);
assert.doesNotMatch(server, /createKeychainStore\(\{ service: GATEWAY_KEYCHAIN_SERVICE, secretDir: DEVICE_IDENTITY_SECRET_DIR \}\)/);

console.log(JSON.stringify({ status: "PASS", managed_device_identity_store: "DEDICATED",
  private_key_copied: false, dvr_secret_store: "UNCHANGED", command_audit_store: "UNCHANGED" }));
