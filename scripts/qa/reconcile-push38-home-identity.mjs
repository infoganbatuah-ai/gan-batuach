// Read-only reconciliation of the installed legacy Home components with the
// authoritative Product records. The restricted output contains identifiers,
// never refresh tokens, credential hashes, camera URLs or camera passwords.
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createKeychainStore } from "../../services/video-gateway/keychain-store.mjs";

const SITE_ID = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const GATEWAY_ID = "62df97e2-3c0b-427f-9108-bde029bc10e7";
const CONNECTOR_ID = "db267b52-6282-4944-bcee-5d4857698fb0";
const CONNECTOR_SECRETS = "/Users/danielderi/Library/Application Support/Digital Observer/Tapo Connector/secrets";
const GATEWAY_KEYCHAIN = "com.ganbatuach.video-gateway.runtime";
const outputOption = process.argv.find(arg => arg.startsWith("--output="));
if (!outputOption) throw new Error("PUSH38_RESTRICTED_OUTPUT_REQUIRED");
const output = resolve(outputOption.slice("--output=".length));
const restricted = realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted") + sep;
if (!output.startsWith(restricted)) throw new Error("PUSH38_RESTRICTED_OUTPUT_PATH_REQUIRED");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("PUSH38_AUTHORIZED_PRODUCT_READ_REQUIRED");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const keychain = createKeychainStore({ service: GATEWAY_KEYCHAIN });
const readConnector = key => readFileSync(join(CONNECTOR_SECRETS, key), "utf8").trim();
const equalDigest = (token, storedHex) => {
  if (typeof token !== "string" || token.length < 32 || !/^[a-f0-9]{64}$/.test(storedHex || "")) return false;
  return timingSafeEqual(createHash("sha256").update(token, "utf8").digest(), Buffer.from(storedHex, "hex"));
};
function requireValue(condition, reason) { if (!condition) throw new Error(`PUSH38_IDENTITY_${reason}`); }
async function select(table, columns, field, value) {
  const result = await db.from(table).select(columns).eq(field, value).limit(30);
  if (result.error) throw new Error(`PUSH38_PRODUCT_READ_${table}_${result.error.code || "FAILED"}`);
  return result.data;
}

const [gatewayInstalledId, gatewayInstalledSite, gatewayToken] = await Promise.all([
  keychain.read("device_gateway_id"), keychain.read("device_observer_site_id"), keychain.read("device_refresh_token")
]);
const connectorInstalledId = readConnector("device_gateway_id");
const connectorInstalledSite = readConnector("device_observer_site_id");
const connectorInstalledSource = readConnector("connector_camera_source_id");
const connectorToken = readConnector("device_refresh_token");
requireValue(gatewayInstalledId === GATEWAY_ID && connectorInstalledId === CONNECTOR_ID, "INSTALLED_DEVICE_CONFLICT");
requireValue(gatewayInstalledSite === SITE_ID && connectorInstalledSite === SITE_ID, "INSTALLED_SITE_CONFLICT");

const [sites, devices, sources] = await Promise.all([
  select("observer_sites", "id,site_type,active,digital_observer_organization_id", "id", SITE_ID),
  select("video_gateway_device_enrollments",
    "id,gateway_id,observer_site_id,tenant_id,deployment_profile,status,lifecycle_state,identity_scheme,config_version,refresh_token_hash",
    "observer_site_id", SITE_ID),
  select("digital_observer_camera_sources", "id,observer_site_id,connector_type,status,source_mode,metadata",
    "observer_site_id", SITE_ID)
]);
requireValue(sites.length === 1 && sites[0].id === SITE_ID && sites[0].site_type === "home" &&
  sites[0].active === true && !sites[0].digital_observer_organization_id, "PRODUCT_SITE_CONFLICT");
const tenantId = SITE_ID; // PUSH 18 fallback when Home has no organization.
const expected = [
  { id: GATEWAY_ID, profile: "PHYSICAL_GATEWAY", token: gatewayToken },
  { id: CONNECTOR_ID, profile: "SOFTWARE_CONNECTOR", token: connectorToken }
];
const enrollment = expected.map(component => {
  const matches = devices.filter(row => row.gateway_id === component.id && row.status === "delivered" && row.lifecycle_state === "ACTIVE");
  requireValue(matches.length === 1, `${component.profile}_ENROLLMENT_NOT_UNIQUE`);
  const row = matches[0];
  requireValue(row.observer_site_id === SITE_ID && row.tenant_id === tenantId &&
    row.deployment_profile === component.profile && row.identity_scheme === "LEGACY_HMAC" &&
    Number.isInteger(row.config_version) && row.config_version > 0, `${component.profile}_SCOPE_CONFLICT`);
  requireValue(equalDigest(component.token, row.refresh_token_hash), `${component.profile}_INSTALLED_PROOF_MISMATCH`);
  return { enrollment_id: row.id, device_id: row.gateway_id, tenant_id: row.tenant_id,
    site_id: row.observer_site_id, profile: row.deployment_profile,
    config_version: row.config_version, identity_phase: "LEGACY_VERIFIED_FOR_TRANSITION",
    installed_credential_matches_product_verifier: true };
});
const dvr = sources.filter(row => row.connector_type === "dvr");
const tapo = sources.filter(row => row.id === connectorInstalledSource && row.connector_type === "rtsp");
requireValue(dvr.length === 16 && tapo.length === 1 && sources.length === 17, "SOURCE_COUNT_CONFLICT");
requireValue(new Set(dvr.map(row => row.metadata?.dvr_channel)).size === 16 &&
  dvr.every(row => Number.isInteger(row.metadata?.dvr_channel) && row.metadata.dvr_channel >= 1 &&
    row.metadata.dvr_channel <= 16 && row.metadata?.gateway_id === GATEWAY_ID), "DVR_MAPPING_CONFLICT");
const assigned = dvr.filter(row => row.metadata?.channel_assignment === "ASSIGNED" &&
  row.metadata?.physical_camera_attached === true && row.status === "connected");
const empty = dvr.filter(row => row.metadata?.channel_assignment === "CHANNEL_EMPTY" &&
  row.metadata?.physical_camera_attached === false && row.status === "disabled");
requireValue(assigned.length === 10 && empty.length === 6, "DVR_ASSIGNMENT_CONFLICT");
requireValue(tapo[0].metadata?.gateway_id === CONNECTOR_ID && tapo[0].observer_site_id === SITE_ID,
  "TAPO_MAPPING_CONFLICT");

const response = await fetch("http://127.0.0.1:18082/health", { signal: AbortSignal.timeout(5000) });
requireValue(response.ok, "GATEWAY_HEALTH_UNAVAILABLE");
const health = await response.json();
const progressing = (health.mediaHeartbeat?.inputs || []).map(input => input.channel).sort((a, b) => a - b);
const assignedChannels = assigned.map(row => row.metadata.dvr_channel).sort((a, b) => a - b);
requireValue(JSON.stringify(progressing) === JSON.stringify(assignedChannels) &&
  health.mediaHeartbeat?.progressingRelays === 10 && health.lastDiscovery?.unassignedCount === 6,
  "LIVE_DVR_PRODUCT_MAPPING_CONFLICT");
const evidence = { protocol: "observer-push38-home-identity-reconciliation-v1", observed_at: new Date().toISOString(),
  environment: "HOME_QA_QUALIFICATION", product_database_access: "AUTHORIZED_READ_ONLY",
  site: { id: SITE_ID, tenant_id: tenantId, type: "home", provenance: ["Product observer_sites",
    "Product PUSH18 enrollments", "installed Gateway Keychain", "installed Connector secret store"] },
  devices: enrollment, dvr: { expected: 16, assigned: assigned.map(row => ({ source_id: row.id,
    channel: row.metadata.dvr_channel, stream_id: row.metadata.gateway_stream_id })).sort((a, b) => a.channel - b.channel),
    empty: empty.map(row => ({ source_id: row.id, channel: row.metadata.dvr_channel })).sort((a, b) => a.channel - b.channel),
    live_progressing: progressing },
  tapo: { source_id: tapo[0].id, connector_id: CONNECTOR_ID, installed_source_match: true },
  production_writes: 0, installed_runtime_writes: 0, private_credentials_exported: false };
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
const digest = createHash("sha256").update(readFileSync(output)).digest("hex");
console.log(JSON.stringify({ status: "PASS", evidence_sha256: digest, devices: enrollment.length,
  dvr_assigned: assigned.length, dvr_empty: empty.length, tapo: tapo.length,
  site_id: SITE_ID, production_writes: 0, installed_runtime_writes: 0 }));
