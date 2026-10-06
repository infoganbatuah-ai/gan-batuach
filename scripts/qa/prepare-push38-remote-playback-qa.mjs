import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";

const PROJECT = "gan-batuach-push38t";
const CONTEXT = "colima-push38t";
const CONTAINER = `supabase_db_${PROJECT}`;
const SITE_ID = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const GATEWAY_ID = "62df97e2-3c0b-427f-9108-bde029bc10e7";
const CONNECTOR_ID = "db267b52-6282-4944-bcee-5d4857698fb0";
const availableChannels = new Set([1, 2, 3, 4, 5, 6, 7, 8, 10, 11]);
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const evidenceOption = option("evidence");
const secretOption = option("secret-output");
const apply = process.argv.includes("--apply");
if (!evidenceOption || !secretOption) throw new Error("P38_REMOTE_QA_INPUT_REQUIRED");
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const evidencePath = realpathSync(resolve(evidenceOption));
const secretPath = resolve(secretOption);
if (!evidencePath.startsWith(restricted) || !secretPath.startsWith(restricted) || (statSync(evidencePath).mode & 0o077) !== 0)
  throw new Error("P38_REMOTE_QA_RESTRICTED_PATH_REQUIRED");
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
if (evidence.protocol !== "observer-push38-home-identity-reconciliation-v1" || evidence.site?.id !== SITE_ID ||
  !Array.isArray(evidence.dvr?.assigned) || evidence.dvr.assigned.length !== 10 ||
  !Array.isArray(evidence.dvr?.empty) || evidence.dvr.empty.length !== 6 || evidence.tapo?.connector_id !== CONNECTOR_ID)
  throw new Error("P38_REMOTE_QA_EVIDENCE_INVALID");

const gateway = await (await fetch("http://127.0.0.1:18082/health", { signal: AbortSignal.timeout(5_000) })).json();
const connector = await (await fetch("http://127.0.0.1:18083/health", { signal: AbortSignal.timeout(5_000) })).json();
const gatewayChannels = new Set((gateway.mediaHeartbeat?.inputs || []).filter(item => item.progressing || item.renewing)
  .map(item => Number(item.channel)));
if (gateway.lastDiscovery?.assignedCount !== 10 || gateway.lastDiscovery?.connectedCount !== 10 ||
  gateway.lastDiscovery?.failedAssignedCount !== 0 || gateway.lastDiscovery?.unassignedCount !== 6 ||
  gatewayChannels.size !== availableChannels.size || [...availableChannels].some(channel => !gatewayChannels.has(channel)) ||
  connector.lastDiscovery?.connectedCount !== 1 || connector.mediaHeartbeat?.progressingRelays !== 1)
  throw new Error("P38_REMOTE_QA_LIVE_SOURCE_TRUTH_INVALID");
const connectorStreamId = connector.supervision?.events?.map(item => String(item.resource_id || ""))
  .find(value => /^dvr_[a-f0-9]+_1$/.test(value));
if (!connectorStreamId) throw new Error("P38_REMOTE_QA_CONNECTOR_STREAM_UNAVAILABLE");
const gatewayStore = createEdgeSecretStoreSync({ keychainService: "com.ganbatuach.video-gateway.runtime" });
const installedProfile = JSON.parse(gatewayStore.read("dvr_profile_json") || "null");
if (!installedProfile?.endpoint) throw new Error("P38_REMOTE_QA_GATEWAY_PROFILE_UNAVAILABLE");
const installedHost = new URL(String(installedProfile.endpoint).includes("://")
  ? installedProfile.endpoint : `http://${installedProfile.endpoint}`).hostname;
const installedNamespace = String(installedProfile.metadata?.stream_namespace || "")
  .trim().replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 80);
const liveGatewayStreamId = channel => `dvr_${createHash("sha256").update([
  installedProfile.connection_type || "dvr", installedHost, channel, installedNamespace
].join(":")).digest("hex").slice(0, 18)}_${channel}`;

const run = (command, args) => execFileSync(command, args, { encoding: "utf8", timeout: 45_000,
  stdio: ["ignore", "pipe", "pipe"], env: { PATH: process.env.PATH, HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR, DOCKER_CONTEXT: CONTEXT } });
const labels = JSON.parse(run("docker", ["--context", CONTEXT, "inspect", "--format", "{{json .Config.Labels}}", CONTAINER]));
if (labels["com.supabase.cli.project"] !== PROJECT) throw new Error("P38_REMOTE_QA_WRONG_DATABASE");
const variables = Object.fromEntries(run("supabase", ["status", "--workdir", process.cwd(), "--output", "env"])
  .split("\n").filter(line => /^[A-Z][A-Z0-9_]*=/.test(line)).map(line => {
    const separator = line.indexOf("="); const raw = line.slice(separator + 1);
    return [line.slice(0, separator), raw.startsWith('"') ? JSON.parse(raw) : raw];
  }));
if (variables.API_URL !== "http://127.0.0.1:56421" || !variables.SERVICE_ROLE_KEY || !variables.PUBLISHABLE_KEY)
  throw new Error("P38_REMOTE_QA_LOCAL_STACK_REQUIRED");
const admin = createClient(variables.API_URL, variables.SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const assigned = new Map(evidence.dvr.assigned.map(row => [Number(row.channel), row]));
if ([...availableChannels].some(channel => !assigned.has(channel))) throw new Error("P38_REMOTE_QA_DVR_MAP_INVALID");
const now = new Date().toISOString();
const sources = [...assigned].map(([channel, row]) => ({
  id: row.source_id, observer_site_id: SITE_ID, display_name: `DVR CH${channel} HOME_QA`,
  connector_type: "dvr", connector_provider: "home_qa_edge", source_mode: "gateway_test",
  status: "connected", health_status: "healthy",
  stream_protocol: "hls", last_health_check_at: now, last_seen_at: now,
  last_error_code: null,
  metadata: { qualification_only: true, gateway_id: GATEWAY_ID, gateway_stream_id: liveGatewayStreamId(channel),
    canonical_stream_reference: liveGatewayStreamId(channel), connector_device_type: "PHYSICAL_GATEWAY",
    connector_local_port: 18082, dvr_channel: channel, channel_assignment: "ASSIGNED",
    physical_camera_attached: true }
}));
for (const row of evidence.dvr.empty) sources.push({
  id: row.source_id, observer_site_id: SITE_ID, display_name: `DVR CH${row.channel} EMPTY HOME_QA`,
  connector_type: "dvr", connector_provider: "home_qa_edge", source_mode: "gateway_test",
  status: "disabled", health_status: "unknown", stream_protocol: null, last_health_check_at: now,
  metadata: { qualification_only: true, gateway_id: GATEWAY_ID, dvr_channel: row.channel,
    connector_device_type: "PHYSICAL_GATEWAY", connector_local_port: 18082,
    channel_assignment: "CHANNEL_EMPTY", physical_camera_attached: false }
});
sources.push({
  id: evidence.tapo.source_id, observer_site_id: SITE_ID, display_name: "Tapo HOME_QA",
  connector_type: "rtsp", connector_provider: "home_qa_edge", source_mode: "gateway_test",
  status: "connected", health_status: "healthy", stream_protocol: "hls",
  last_health_check_at: now, last_seen_at: now,
  metadata: { qualification_only: true, gateway_id: CONNECTOR_ID, gateway_stream_id: connectorStreamId,
    canonical_stream_reference: connectorStreamId, connector_device_type: "SOFTWARE_CONNECTOR",
    connector_local_port: 18083, channel_assignment: "ASSIGNED", physical_camera_attached: true }
});
if (sources.length !== 17 || new Set(sources.map(row => row.id)).size !== 17)
  throw new Error("P38_REMOTE_QA_SOURCE_SET_INVALID");

const existing = await admin.from("digital_observer_camera_sources").select("id,observer_site_id,status,health_status,metadata");
if (existing.error) throw new Error("P38_REMOTE_QA_SOURCE_READ_FAILED");
if (existing.data.length !== 0 && existing.data.length !== sources.length)
  throw new Error("P38_REMOTE_QA_SOURCE_COUNT_CONFLICT");
if (!apply) {
  console.log(JSON.stringify({ status: "VERIFIED_NOT_APPLIED", sources: sources.length, dvr_expected: 10,
    dvr_available: 10, dvr_upstream_unavailable: 0, empty: 6, tapo: 1, production_writes: 0 }));
  process.exit(0);
}
if (existing.data.length === 0) {
  const inserted = await admin.from("digital_observer_camera_sources").insert(sources);
  if (inserted.error) throw new Error(`P38_REMOTE_QA_SOURCE_INSERT_${inserted.error.code || "FAILED"}`);
} else {
  const expected = new Map(sources.map(row => [row.id, row]));
  if (existing.data.some(row => row.observer_site_id !== SITE_ID || !expected.has(row.id) ||
    row.metadata?.gateway_id !== expected.get(row.id).metadata.gateway_id ||
    row.metadata?.channel_assignment !== expected.get(row.id).metadata.channel_assignment))
    throw new Error("P38_REMOTE_QA_SOURCE_IDENTITY_CONFLICT");
  for (const source of sources) {
    const refreshed = await admin.from("digital_observer_camera_sources").update({ status: source.status,
      health_status: source.health_status, last_health_check_at: now, last_seen_at: source.last_seen_at,
      last_error_code: source.last_error_code ?? null, metadata: source.metadata
    }).eq("id", source.id).eq("observer_site_id", SITE_ID);
    if (refreshed.error) throw new Error("P38_REMOTE_QA_SOURCE_REFRESH_FAILED");
  }
}

let qaSecret = existsSync(secretPath) ? JSON.parse(readFileSync(secretPath, "utf8")) : null;
if (qaSecret && (statSync(secretPath).mode & 0o077) !== 0) throw new Error("P38_REMOTE_QA_SECRET_PERMISSIONS_INVALID");
if (!qaSecret) {
  const email = `push38.remote.${Date.now()}@qa.invalid`;
  const password = randomBytes(32).toString("base64url");
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { product: "digital_observer", full_name: "[QA] PUSH 38 remote client" },
    app_metadata: { digital_observer_admin: true, qualification: "PUSH38" } });
  if (created.error || !created.data.user) throw new Error("P38_REMOTE_QA_USER_CREATE_FAILED");
  const profile = await admin.from("profiles").upsert({ id: created.data.user.id, role: "admin",
    full_name: "[QA] PUSH 38 remote client", active: true, is_demo: true }, { onConflict: "id" });
  if (profile.error) {
    await admin.auth.admin.deleteUser(created.data.user.id);
    throw new Error(`P38_REMOTE_QA_PROFILE_CREATE_${profile.error.code || "FAILED"}`);
  }
  qaSecret = { protocol: "observer-push38-remote-client-secret-v1", user_id: created.data.user.id,
    email, password, created_at: now, environment: "ISOLATED_HOME_QA" };
  writeFileSync(secretPath, `${JSON.stringify(qaSecret)}\n`, { flag: "wx", mode: 0o600 });
}
const verification = await admin.from("profiles").select("id,role,active,is_demo").eq("id", qaSecret.user_id).maybeSingle();
if (verification.error || verification.data?.role !== "admin" || verification.data?.active !== true ||
  verification.data?.is_demo !== true) throw new Error("P38_REMOTE_QA_USER_VERIFY_FAILED");
console.log(JSON.stringify({ status: "PASS", environment: "ISOLATED_HOME_QA", sources: sources.length,
  dvr_expected: 10, dvr_available: 10, dvr_upstream_unavailable: 0, empty: 6, tapo: 1,
  qa_user: "CREATED_OR_VERIFIED", secret_location: "RESTRICTED_LOCAL_ONLY", production_writes: 0,
  private_camera_credentials_copied: false }));
