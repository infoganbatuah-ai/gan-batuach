// Current read-only Product/runtime snapshot for the authorized DVR endpoint
// reconciliation. This deliberately does not turn a Connector credential
// mismatch into permission to skip the later Connector identity gate.
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";

const SITE_ID = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const GATEWAY_ID = "62df97e2-3c0b-427f-9108-bde029bc10e7";
const CONNECTOR_ID = "db267b52-6282-4944-bcee-5d4857698fb0";
const option = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const output = resolve(option("output") || ".");
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
if (!output.startsWith(restricted)) throw new Error("P38_DVR_PREWRITE_RESTRICTED_OUTPUT_REQUIRED");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("P38_DVR_PREWRITE_AUTHORIZED_PRODUCT_READ_REQUIRED");

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const gatewayStore = createEdgeSecretStoreSync({ keychainService: "com.ganbatuach.video-gateway.runtime" });
const connectorDir = join(homedir(), "Library/Application Support/Digital Observer/Tapo Connector/secrets");
const connectorRead = (name) => readFileSync(join(connectorDir, name), "utf8").trim();
const sha = (value) => createHash("sha256").update(value).digest("hex");
const verifierMatches = (token, stored) => {
  if (!token || !/^[a-f0-9]{64}$/.test(stored || "")) return false;
  return timingSafeEqual(createHash("sha256").update(token).digest(), Buffer.from(stored, "hex"));
};
const requireTruth = (condition, code) => { if (!condition) throw new Error(`P38_DVR_PREWRITE_${code}`); };
const select = async (table, columns, field, value) => {
  const result = await db.from(table).select(columns).eq(field, value).limit(40);
  if (result.error) throw new Error(`P38_DVR_PREWRITE_PRODUCT_READ_${table}_${result.error.code || "FAILED"}`);
  return result.data;
};

const [installedGatewayId, installedSite, gatewayToken] = [
  gatewayStore.read("device_gateway_id"), gatewayStore.read("device_observer_site_id"), gatewayStore.read("device_refresh_token")
];
const installedConnectorId = connectorRead("device_gateway_id");
const installedConnectorSite = connectorRead("device_observer_site_id");
const installedTapoSource = connectorRead("connector_camera_source_id");
const connectorToken = connectorRead("device_refresh_token");
requireTruth(installedGatewayId === GATEWAY_ID && installedConnectorId === CONNECTOR_ID, "INSTALLED_DEVICE_CONFLICT");
requireTruth(installedSite === SITE_ID && installedConnectorSite === SITE_ID, "INSTALLED_SITE_CONFLICT");

const [sites, devices, sources] = await Promise.all([
  select("observer_sites", "id,site_type,active,digital_observer_organization_id", "id", SITE_ID),
  select("video_gateway_device_enrollments",
    "id,gateway_id,observer_site_id,tenant_id,deployment_profile,status,lifecycle_state,identity_scheme,config_version,refresh_token_hash",
    "observer_site_id", SITE_ID),
  select("digital_observer_camera_sources", "id,observer_site_id,connector_type,status,source_mode,health_status,last_error_code,metadata",
    "observer_site_id", SITE_ID)
]);
requireTruth(sites.length === 1 && sites[0].site_type === "home" && sites[0].active === true, "SITE_CONFLICT");
const enrolled = (id, profile) => devices.filter((row) => row.gateway_id === id && row.deployment_profile === profile
  && row.status === "delivered" && row.lifecycle_state === "ACTIVE");
const gatewayRows = enrolled(GATEWAY_ID, "PHYSICAL_GATEWAY");
const connectorRows = enrolled(CONNECTOR_ID, "SOFTWARE_CONNECTOR");
requireTruth(gatewayRows.length === 1 && connectorRows.length === 1, "ENROLLMENT_NOT_UNIQUE");
requireTruth(gatewayRows[0].observer_site_id === SITE_ID && gatewayRows[0].tenant_id === SITE_ID,
  "GATEWAY_SCOPE_CONFLICT");
requireTruth(verifierMatches(gatewayToken, gatewayRows[0].refresh_token_hash), "GATEWAY_INSTALLED_PROOF_MISMATCH");

const dvr = sources.filter((row) => row.connector_type === "dvr");
const tapo = sources.filter((row) => row.id === installedTapoSource && row.connector_type === "rtsp");
requireTruth(dvr.length === 16 && tapo.length === 1 && sources.length === 17, "SOURCE_COUNT_CONFLICT");
const assigned = dvr.filter((row) => row.metadata?.channel_assignment === "ASSIGNED"
  && row.metadata?.physical_camera_attached === true);
const empty = dvr.filter((row) => row.metadata?.channel_assignment === "CHANNEL_EMPTY"
  && row.metadata?.physical_camera_attached === false);
requireTruth(assigned.length === 10 && empty.length === 6, "DVR_ASSIGNMENT_CONFLICT");
requireTruth(new Set(dvr.map((row) => row.id)).size === 16
  && new Set(dvr.map((row) => row.metadata?.dvr_channel)).size === 16
  && dvr.every((row) => row.metadata?.gateway_id === GATEWAY_ID), "DVR_MAPPING_CONFLICT");

const healthResponse = await fetch("http://127.0.0.1:18082/health", { signal: AbortSignal.timeout(5000) });
requireTruth(healthResponse.ok, "GATEWAY_HEALTH_UNAVAILABLE");
const health = await healthResponse.json();
const evidence = {
  protocol: "observer-push38-home-dvr-prewrite-snapshot-v1", observed_at: new Date().toISOString(),
  environment: "LIVE_HOME_EDGE_WITH_AUTHORIZED_PRODUCT_READ", site: { id: SITE_ID, tenant_id: SITE_ID, type: "home" },
  devices: {
    gateway: { device_id: GATEWAY_ID, enrollment_id: gatewayRows[0].id, profile: "PHYSICAL_GATEWAY",
      config_version: gatewayRows[0].config_version, installed_proof: "PASS" },
    connector: { device_id: CONNECTOR_ID, enrollment_id: connectorRows[0].id, profile: "SOFTWARE_CONNECTOR",
      config_version: connectorRows[0].config_version,
      installed_proof: verifierMatches(connectorToken, connectorRows[0].refresh_token_hash) ? "PASS" : "MISMATCH_BLOCKS_CONNECTOR_TRANSITION" }
  },
  dvr: {
    capacity: 16,
    assigned: assigned.map((row) => ({ source_id: row.id, channel: row.metadata.dvr_channel,
      gateway_stream_id: row.metadata.gateway_stream_id, product_status: row.status,
      product_health_status: row.health_status, product_error: row.last_error_code || null })).sort((a, b) => a.channel - b.channel),
    empty: empty.map((row) => ({ source_id: row.id, channel: row.metadata.dvr_channel })).sort((a, b) => a.channel - b.channel),
    runtime_before: { status: health.status || null, ok: health.ok === true,
      discovery: health.lastDiscovery || null, progressing: health.mediaHeartbeat?.progressingRelays ?? null,
      stalled: health.mediaHeartbeat?.stalledRelays ?? null }
  },
  tapo: { source_id: tapo[0].id, connector_id: CONNECTOR_ID, product_status: tapo[0].status,
    product_health_status: tapo[0].health_status, product_error: tapo[0].last_error_code || null },
  source_ids_unique: new Set(sources.map((row) => row.id)).size === sources.length,
  product_writes: 0, runtime_writes: 0, credentials_recorded: false
};
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ status: "PASS", evidence_sha256: sha(readFileSync(output)),
  gateway_proof: evidence.devices.gateway.installed_proof, connector_proof: evidence.devices.connector.installed_proof,
  dvr_assigned: assigned.length, dvr_empty: empty.length, tapo: tapo.length, product_writes: 0 }));
