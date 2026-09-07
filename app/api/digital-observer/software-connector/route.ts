/* eslint-disable @typescript-eslint/no-explicit-any -- connector onboarding bridges migration-backed tables not yet represented in the generated database types. */
import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { verifyGatewayDeviceAccessToken } from "@/lib/domain/gateway-device-enrollment";
import { decryptField, encryptField } from "@/lib/security/encryption";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { assertTrustedMutationOrigin, parseBoundedJson, privateRateLimitIdentifier } from "@/lib/security/request-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordConnectivityOutcome } from "@/lib/domain/digital-observer/connection-outcome-service";
import { connectivityRegistryVersion } from "@/lib/domain/digital-observer/connectivity-registry";
import { connectionOrchestratorVersion } from "@/lib/domain/digital-observer/connection-orchestrator";
import { assessAuthorizedCameraSystem } from "@/lib/domain/digital-observer/connection-assessment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const siteSchema = z.string().uuid();
const gatewaySchema = z.string().uuid();
const hostSchema = z.string().trim().min(7).max(45).refine((value) => isPrivateLanAddress(value), "LOCAL_CAMERA_ADDRESS_REQUIRED");
const discoverySchema = z.object({
  action: z.literal("publish_discovery"),
  gateway_id: gatewaySchema,
  observer_site_id: siteSchema,
  candidates: z.array(z.object({
    host: hostSchema,
    vendor: z.enum(["tapo", "generic"]).default("generic"),
    model: z.string().trim().min(2).max(80).optional(),
    protocols: z.array(z.enum(["RTSP", "ONVIF", "HTTPS"])).min(1).max(3),
    rtsp_port: z.number().int().min(1).max(65535).optional(),
    onvif_port: z.number().int().min(1).max(65535).optional()
  }).strict()).min(1).max(32)
}).strict();
const configureSchema = z.object({
  action: z.literal("configure"),
  observer_site_id: siteSchema,
  gateway_id: gatewaySchema,
  candidate_id: z.string().uuid(),
  display_name: z.string().trim().min(2).max(100),
  location_label: z.string().trim().max(100).optional().default(""),
  username: z.string().min(1).max(128),
  password: z.string().min(8).max(256)
}).strict();
const activateSchema = z.object({
  action: z.literal("activate"),
  observer_site_id: siteSchema,
  camera_source_id: z.string().uuid(),
  effort: z.object({ product_actions: z.number().int().min(0).max(1000), technical_actions: z.number().int().min(0).max(1000),
    installer_actions: z.number().int().min(0).max(100), external_app_actions: z.number().int().min(0).max(100),
    elapsed_ms: z.number().int().min(0).max(7 * 86400000), support_required: z.boolean() }).strict().optional()
}).strict();
const configureBatchSchema = z.object({ action: z.literal("configure_batch"), observer_site_id: siteSchema, gateway_id: gatewaySchema,
  cameras: z.array(configureSchema.omit({ action: true, observer_site_id: true, gateway_id: true })).min(1).max(32) }).strict();
const activateBatchSchema = z.object({ action: z.literal("activate_batch"), observer_site_id: siteSchema,
  camera_source_ids: z.array(z.string().uuid()).min(1).max(32).refine(values => new Set(values).size === values.length, "DUPLICATE_CAMERA_SELECTION"),
  effort: activateSchema.shape.effort }).strict();
const userMutationSchema = z.discriminatedUnion("action", [configureSchema, configureBatchSchema, activateSchema, activateBatchSchema]);

function cloudSecret() {
  return process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET || "";
}

function isPrivateLanAddress(value: string) {
  if (isIP(value) !== 4) return false;
  const octets = value.split(".").map(Number);
  return octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function privateAddressFingerprint(siteId: string, gatewayId: string, host: string) {
  return createHash("sha256").update(`connector-camera-v1:${siteId}:${gatewayId}:${host}`).digest("hex");
}

function streamNamespace(gatewayId: string) {
  return `tapo_${gatewayId.replaceAll("-", "").slice(0, 20)}`;
}

function expectedStreamId(host: string, namespace: string) {
  const fingerprint = createHash("sha256").update(["rtsp", host, 1, namespace].join(":")).digest("hex").slice(0, 18);
  return `dvr_${fingerprint}_1`;
}

async function enrolledConnector(admin: ReturnType<typeof createAdminClient>, device: { device_id: string; gateway_id: string; observer_site_id: string }) {
  const enrollment = await admin.from("video_gateway_device_enrollments" as any)
    .select("id,status,gateway_id,observer_site_id,device_name,metadata")
    .eq("id", device.device_id)
    .eq("gateway_id", device.gateway_id)
    .eq("observer_site_id", device.observer_site_id)
    .eq("status", "delivered")
    .maybeSingle();
  const metadata = enrollment.data?.metadata && typeof enrollment.data.metadata === "object" ? enrollment.data.metadata : {};
  if (enrollment.error || !enrollment.data || metadata.device_type !== "SOFTWARE_CONNECTOR") return null;
  return { ...enrollment.data, metadata };
}

async function authenticateDevice(request: Request) {
  const secret = cloudSecret();
  if (!secret) return null;
  const device = verifyGatewayDeviceAccessToken(request.headers.get("x-video-gateway-device-token") || "", secret);
  if (!device || request.headers.get("x-video-gateway-id") !== device.gateway_id) return null;
  const admin = createAdminClient();
  const enrollment = await enrolledConnector(admin, device);
  return enrollment ? { device, enrollment, admin } : null;
}

function noStore<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status, headers: { "cache-control": "private, no-store, max-age=0" } });
}

async function publishDiscovery(request: Request) {
  const auth = await authenticateDevice(request);
  if (!auth) return fail("Connector identity is invalid or revoked.", 401);
  const payload = discoverySchema.parse(await parseBoundedJson(request, 12 * 1024));
  if (payload.gateway_id !== auth.device.gateway_id || payload.observer_site_id !== auth.device.observer_site_id) {
    return fail("Connector discovery scope mismatch.", 403);
  }
  const results = [];
  for (const candidate of payload.candidates) {
    const fingerprint = privateAddressFingerprint(payload.observer_site_id, payload.gateway_id, candidate.host);
    const existing = await auth.admin.from("camera_source_registry" as any)
      .select("id,registration_status,metadata")
      .contains("metadata", { observer_site_id: payload.observer_site_id, connector_gateway_id: payload.gateway_id, discovery_fingerprint: fingerprint })
      .maybeSingle();
    const id = existing.data?.id ?? randomUUID();
    const metadata = {
      ...(existing.data?.metadata && typeof existing.data.metadata === "object" ? existing.data.metadata : {}),
      observer_site_id: payload.observer_site_id,
      connector_gateway_id: payload.gateway_id,
      connector_device_id: auth.device.device_id,
      device_type: "SOFTWARE_CONNECTOR",
      discovery_fingerprint: fingerprint,
      discovery_source: "local_port_capability_probe",
      vendor: candidate.vendor,
      model: candidate.model ?? null,
      protocols: candidate.protocols,
      onvif_port: candidate.onvif_port ?? null,
      private_address_encrypted: true,
      discovered_at: new Date().toISOString(),
      install_intent_id: auth.enrollment.metadata?.install_intent_id ?? null,
      no_credentials_received: true
    };
    const row = {
      id,
      camera_id: null,
      garden_id: null,
      home_test_site_id: null,
      source_type: "ip_camera",
      brand: "generic",
      host: null,
      port: candidate.rtsp_port ?? 554,
      channel: 1,
      stream_quality: "sub",
      secret_reference: `camera_source_registry:${id}`,
      manual_rtsp_encrypted: encryptField(candidate.host),
      gateway_provider: "custom",
      registration_status: existing.data?.registration_status === "registered" ? "registered" : "pending_gateway",
      last_test_status: "discovered",
      last_test_at: new Date().toISOString(),
      masked_connection_summary: { vendor: candidate.vendor, protocols: candidate.protocols, local_address_present: true },
      no_secrets_exposed: true,
      metadata,
      updated_at: new Date().toISOString()
    };
    const write = existing.data?.id
      ? await auth.admin.from("camera_source_registry" as any).update(row).eq("id", id)
      : await auth.admin.from("camera_source_registry" as any).insert(row);
    if (write.error) throw Object.assign(new Error("CONNECTOR_DISCOVERY_PERSIST_FAILED"), { code: write.error.code });
    results.push({ candidate_id: id, vendor: candidate.vendor, model: candidate.model ?? null, protocols: candidate.protocols,
      install_intent_id: auth.enrollment.metadata?.install_intent_id ?? null });
  }
  return noStore({ status: "DISCOVERED", candidates: results }, 201);
}

async function deviceConfiguration(request: Request) {
  const auth = await authenticateDevice(request);
  if (!auth) return fail("Connector identity is invalid or revoked.", 401);
  const rows = await auth.admin.from("camera_source_registry" as any)
    .select("id,port,username_encrypted,password_encrypted,manual_rtsp_encrypted,registration_status,metadata")
    .contains("metadata", { observer_site_id: auth.device.observer_site_id, connector_gateway_id: auth.device.gateway_id, device_type: "SOFTWARE_CONNECTOR" })
    .in("registration_status", ["testing", "registered"])
    .order("updated_at", { ascending: false })
    .limit(32);
  if (rows.error) throw Object.assign(new Error("CONNECTOR_CONFIG_READ_FAILED"), { code: rows.error.code });
  const cameras = (rows.data ?? []).map((row: any) => {
    const host = decryptField(row.manual_rtsp_encrypted);
    const username = decryptField(row.username_encrypted);
    const password = decryptField(row.password_encrypted);
    if (!host || !username || !password || !isPrivateLanAddress(host)) return null;
    return {
      credential_id: row.id,
      camera_source_id: row.metadata?.camera_source_id ?? null,
      endpoint: host,
      port: Number(row.port || 554),
      username,
      password,
      vendor: "generic",
      channel_count: 1,
      stream_namespace: row.metadata?.stream_namespace ?? streamNamespace(auth.device.gateway_id),
      gateway_stream_id: row.metadata?.gateway_stream_id ?? null
    };
  }).filter(Boolean);
  return noStore({
    version: Number(auth.enrollment.metadata.connector_config_version || 1),
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    cameras
  });
}

async function userRead(request: Request) {
  const query = z.object({ observer_site_id: siteSchema, install_intent_id: z.string().uuid().optional() }).parse(Object.fromEntries(new URL(request.url).searchParams));
  const session = await getDigitalObserverApiUser(request);
  if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
  const site = await getObserverSiteAccess(session.supabase, session.profile, query.observer_site_id, { manage: true });
  if (!site) return fail("אין הרשאה לנהל חיבור באתר הזה.", 403);
  const admin = createAdminClient();
  const enrollments = await admin.from("video_gateway_device_enrollments" as any)
    .select("id,gateway_id,device_name,status,metadata,updated_at")
    .eq("observer_site_id", site.id)
    .eq("status", "delivered")
    .order("updated_at", { ascending: false });
  if (enrollments.error) throw Object.assign(new Error("CONNECTOR_LIST_FAILED"), { code: enrollments.error.code });
  const connectorRows = (enrollments.data ?? []).filter((row: any) => row.metadata?.device_type === "SOFTWARE_CONNECTOR"
    && (!query.install_intent_id || row.metadata?.install_intent_id === query.install_intent_id));
  const connectors = connectorRows.map((row: any) => ({
    gateway_id: row.gateway_id,
    name: row.device_name,
    status: row.metadata?.health?.status ?? (row.metadata?.last_heartbeat_at ? "CONNECTED" : "ENROLLED"),
    last_seen_at: row.metadata?.last_heartbeat_at ?? null,
    version: row.metadata?.software_version ?? null
  }));
  const candidates = await admin.from("camera_source_registry" as any)
    .select("id,registration_status,last_test_status,last_test_at,masked_connection_summary,metadata")
    .contains("metadata", { observer_site_id: site.id, device_type: "SOFTWARE_CONNECTOR" })
    .order("updated_at", { ascending: false })
    .limit(64);
  if (candidates.error) throw Object.assign(new Error("CONNECTOR_CANDIDATE_LIST_FAILED"), { code: candidates.error.code });
  const candidateRows = (candidates.data ?? []).filter((row: any) => !query.install_intent_id || row.metadata?.install_intent_id === query.install_intent_id);
  const sourceIds = candidateRows.map((row: any) => row.metadata?.camera_source_id).filter(Boolean);
  const sources = sourceIds.length ? await admin.from("digital_observer_camera_sources" as any)
    .select("id,display_name,location_label,source_mode,status,health_status,last_seen_at,capabilities,metadata")
    .eq("observer_site_id", site.id)
    .in("id", sourceIds) : { data: [], error: null };
  const sourceById = new Map((sources.data ?? []).map((row: any) => [row.id, row]));
  return ok({
    site: { id: site.id, name: site.name },
    connectors,
    onboarding_session_id: query.install_intent_id ?? null,
    candidates: candidateRows.map((row: any) => {
      const source = sourceById.get(row.metadata?.camera_source_id) as any;
      return {
        id: row.id,
        connector_gateway_id: row.metadata?.connector_gateway_id ?? null,
        name: row.metadata?.model ? `${row.metadata?.vendor === "tapo" ? "Tapo" : "IP Camera"} ${row.metadata.model}` : row.metadata?.vendor === "tapo" ? "מצלמת Tapo" : "מצלמת IP",
        vendor: row.metadata?.vendor ?? "generic",
        model: row.metadata?.model ?? null,
        protocols: Array.isArray(row.metadata?.protocols) ? row.metadata.protocols : [],
        credentials_saved: Boolean(row.metadata?.credentials_configured_at),
        registration_status: row.registration_status,
        camera_source: source ? {
          id: source.id,
          display_name: source.display_name,
          location_label: source.location_label,
          source_mode: source.source_mode,
          status: source.status,
          health_status: source.health_status,
          last_seen_at: source.last_seen_at,
          active_monitoring: source.metadata?.active_monitoring === true
        } : null
      };
    })
  });
}

async function configureCandidate(payload: z.infer<typeof configureSchema>, session: NonNullable<Awaited<ReturnType<typeof getDigitalObserverApiUser>>>, site: any) {
  const admin = createAdminClient();
  const enrollment = await admin.from("video_gateway_device_enrollments" as any)
    .select("id,gateway_id,observer_site_id,status,metadata")
    .eq("gateway_id", payload.gateway_id).eq("observer_site_id", site.id).eq("status", "delivered").maybeSingle();
  if (enrollment.error || !enrollment.data || enrollment.data.metadata?.device_type !== "SOFTWARE_CONNECTOR") return fail("Software Connector מאומת לא נמצא באתר הזה.", 409);
  const candidate = await admin.from("camera_source_registry" as any)
    .select("id,port,manual_rtsp_encrypted,registration_status,metadata")
    .eq("id", payload.candidate_id).maybeSingle();
  if (candidate.error || !candidate.data || candidate.data.metadata?.observer_site_id !== site.id || candidate.data.metadata?.connector_gateway_id !== payload.gateway_id) {
    return fail("המצלמה שנבחרה אינה שייכת לחיבור הזה.", 403);
  }
  const family = candidate.data.metadata?.vendor === "tapo" && candidate.data.metadata?.model === "C211" ? "tapo-c211" : "generic-rtsp";
  const { plan } = await assessAuthorizedCameraSystem(site.id, family, "YES");
  if (!candidate.data.metadata?.camera_source_id && (plan.preferredStrategy !== "SOFTWARE_CONNECTOR" || plan.nextAction !== "DISCOVER")) {
    return fail("אפשרויות החיבור השתנו. חזרו למצא את המצלמות שלי כדי לבחור את המסלול המתאים.", 409);
  }
  const host = decryptField(candidate.data.manual_rtsp_encrypted);
  if (!host || !isPrivateLanAddress(host)) return fail("כתובת המצלמה המקומית אינה תקפה.", 422);
  const namespace = streamNamespace(payload.gateway_id);
  const gatewayStreamId = expectedStreamId(host, namespace);
  const now = new Date().toISOString();
  const sourceId = typeof candidate.data.metadata?.camera_source_id === "string" ? candidate.data.metadata.camera_source_id : randomUUID();
  const sourcePayload = {
    id: sourceId,
    observer_site_id: site.id,
    camera_stream_id: null,
    display_name: payload.display_name,
    location_label: payload.location_label || "בית",
    connector_type: "rtsp",
    connector_provider: candidate.data.metadata?.vendor === "tapo" ? "tapo" : "generic",
    source_mode: "readiness",
    status: "testing",
    health_status: "unknown",
    stream_protocol: "rtsp_tcp",
    gateway_provider: "custom",
    secret_reference: `camera_source_registry:${candidate.data.id}`,
    capabilities: { preview: false, live_view: false, event_clips: false, credentials_saved: true, connector_transport: "software_connector", canonical_connection_capabilities: ["LIVE_STREAM", "HEALTH"], production_connection_eligible: false },
    monitoring_targets: ["person", "entry_exit", "camera_obstruction", "after_hours"],
    metadata: {
      product: "digital_observer",
      source: "software_connector_onboarding",
      gateway_id: payload.gateway_id,
      gateway_stream_id: gatewayStreamId,
      dvr_channel: 1,
      connector_device_type: "SOFTWARE_CONNECTOR",
      connection_method: "SOFTWARE_CONNECTOR",
      adapter_type: "rtsp_gateway",
      adapter_version: "1.0.0",
      connectivity_registry_version: connectivityRegistryVersion,
      connection_orchestrator_version: connectionOrchestratorVersion,
      connectivity_attempt_id: randomUUID(),
      connectivity_family: candidate.data.metadata?.vendor === "tapo" && candidate.data.metadata?.model === "C211" ? "tapo-c211" : "generic-rtsp",
      connection_requirement_reason: "EXISTING_AUTHORIZED_LOCAL_BRIDGE",
      connection_technical_capability: plan.technicalCapability,
      connection_product_coverage: plan.productCoverage,
      connection_observed_success: plan.observedSuccess,
      connection_requirement_basis: plan.requirementBasis,
      install_intent_id: enrollment.data.metadata?.install_intent_id ?? null,
      connector_local_port: enrollment.data.metadata?.install_intent_id ? 18084 : 18083,
      software_connector_verified: true,
      private_network_only: true,
      credentials_server_side: true,
      credentials_local_delivery_pending: true,
      no_rtsp_exposed: true,
      no_live_claim: true,
      active_monitoring: false,
      onboarding_test_scope: true
    },
    created_by: session.profile.id,
    updated_at: now
  };
  const existing = await admin.from("digital_observer_camera_sources" as any).select("id,created_at").eq("id", sourceId).maybeSingle();
  const sourceWrite = existing.data?.id
    ? await admin.from("digital_observer_camera_sources" as any).update(sourcePayload).eq("id", sourceId)
    : await admin.from("digital_observer_camera_sources" as any).insert({ ...sourcePayload, created_at: now });
  if (sourceWrite.error) throw Object.assign(new Error("CONNECTOR_CAMERA_SOURCE_WRITE_FAILED"), { code: sourceWrite.error.code });
  const credentialWrite = await admin.from("camera_source_registry" as any).update({
    username_encrypted: encryptField(payload.username),
    password_encrypted: encryptField(payload.password),
    registration_status: "testing",
    last_test_status: "connector_sync_pending",
    last_test_at: now,
    metadata: {
      ...candidate.data.metadata,
      camera_source_id: sourceId,
      stream_namespace: namespace,
      gateway_stream_id: gatewayStreamId,
      credentials_configured_at: now,
      credentials_configured_by: session.profile.id,
      no_plaintext_credentials: true
    },
    updated_at: now
  }).eq("id", candidate.data.id);
  if (credentialWrite.error) throw Object.assign(new Error("CONNECTOR_CREDENTIAL_WRITE_FAILED"), { code: credentialWrite.error.code });
  const currentVersion = Number(enrollment.data.metadata?.connector_config_version || 1);
  await admin.from("video_gateway_device_enrollments" as any).update({
    metadata: { ...enrollment.data.metadata, connector_config_version: currentVersion + 1, camera_configuration_pending: true },
    updated_at: now
  }).eq("id", enrollment.data.id);
  await admin.from("camera_gateway_audit_events" as any).insert({
    camera_id: null, garden_id: null, home_test_site_id: null, actor_id: session.profile.id, actor_role: session.profile.role,
    action: "credentials_updated", status: "success", gateway_provider: "custom", no_secrets_exposed: true,
    metadata: { observer_site_id: site.id, camera_source_id: sourceId, connector_gateway_id: payload.gateway_id, credential_values_logged: false }
  });
  return ok({ status: "CREDENTIALS_STORED", camera_source_id: sourceId, connector_config_version: currentVersion + 1 });
}

async function activateCamera(payload: z.infer<typeof activateSchema>, site: any, profileId: string) {
  const admin = createAdminClient();
  const source = await admin.from("digital_observer_camera_sources" as any)
    .select("id,observer_site_id,status,health_status,last_seen_at,secret_reference,capabilities,metadata")
    .eq("id", payload.camera_source_id).eq("observer_site_id", site.id).maybeSingle();
  if (source.error || !source.data) return fail("מקור המצלמה לא נמצא באתר הזה.", 404);
  if (source.data.status !== "connected" || source.data.health_status !== "healthy" || !source.data.secret_reference || source.data.metadata?.connector_device_type !== "SOFTWARE_CONNECTOR") {
    return fail("המצלמה עדיין לא השלימה בדיקת זרם ו-AI.", 409);
  }
  const enrollment = await admin.from("video_gateway_device_enrollments" as any)
    .select("id,metadata").eq("gateway_id", source.data.metadata.gateway_id)
    .eq("observer_site_id", site.id).eq("status", "delivered").maybeSingle();
  const fresh = (value: unknown) => {
    const age = Date.now() - Date.parse(typeof value === "string" ? value : "");
    return Number.isFinite(age) && age >= 0 && age < 120000;
  };
  if (enrollment.error || enrollment.data?.metadata?.device_type !== "SOFTWARE_CONNECTOR"
    || !fresh(enrollment.data.metadata.last_heartbeat_at) || !fresh(source.data.last_seen_at)
    || String(enrollment.data.metadata.health?.status).toUpperCase() !== "HEALTHY") {
    return fail("נדרשת בדיקת חיבור עדכנית לפני ההפעלה. ודאו שהמצלמה והמחשב המקומי פועלים.", 409);
  }
  if (source.data.metadata.active_monitoring === true) return ok({ status: "ACTIVE_MONITORING", camera_source_id: source.data.id });
  const now = new Date().toISOString();
  const updated = await admin.from("digital_observer_camera_sources" as any).update({
    source_mode: "live",
    capabilities: { ...(source.data.capabilities ?? {}), preview: true, live_view: true, local_event_insights: true, production_connection_eligible: true },
    metadata: { ...source.data.metadata, connection_method: "SOFTWARE_CONNECTOR", adapter_type: "rtsp_gateway", adapter_version: "1.0.0", active_monitoring: true, activated_at: now, activated_by: profileId, onboarding_test_scope: false, no_live_claim: false },
    updated_at: now
  }).eq("id", source.data.id).eq("status", "connected").select("id").maybeSingle();
  if (updated.error || !updated.data) throw Object.assign(new Error("CONNECTOR_CAMERA_ACTIVATION_FAILED"), { code: updated.error?.code });
  const credentialId = String(source.data.secret_reference).startsWith("camera_source_registry:") ? String(source.data.secret_reference).split(":")[1] : null;
  if (credentialId) await admin.from("camera_source_registry" as any).update({ registration_status: "registered", last_test_status: "healthy", last_test_at: now, updated_at: now }).eq("id", credentialId);
  await recordConnectivityOutcome({
    attemptId: source.data.metadata.connectivity_attempt_id ?? source.data.id, siteId: site.id,
    family: source.data.metadata.connectivity_family ?? "generic-rtsp", strategy: "SOFTWARE_CONNECTOR",
    registryVersion: connectivityRegistryVersion, orchestratorVersion: connectionOrchestratorVersion,
    firmware: null, outcome: "ACTIVATED", failure: null, durationMs: payload.effort?.elapsed_ms ?? null,
    interactions: payload.effort?.product_actions ?? null, manualFields: payload.effort?.technical_actions ?? null,
    externalAppSteps: payload.effort?.external_app_actions ?? null, installationRequired: true,
    manualSupportRequired: payload.effort?.support_required ?? null, stability: null, occurredAt: now, provenance: "PRODUCTION", zeroInstallVerified: false,
    commercial: { productActions: payload.effort?.product_actions ?? null, technicalActions: payload.effort?.technical_actions ?? null,
      installerActions: payload.effort?.installer_actions ?? null, discoverySucceeded: true,
      technicalCapability: "LOCAL_PATH_VERIFIED", digitalObserverCoverage: "IMPLEMENTED", observedSuccess: "REAL_DEPLOYMENT", requirementBasis: "PRODUCT_COVERAGE" }
  }, { siteId: site.id, actorId: profileId });
  return ok({ status: "ACTIVE_MONITORING", camera_source_id: source.data.id });
}

export async function GET(request: Request) {
  try {
    return request.headers.get("x-video-gateway-device-token") ? await deviceConfiguration(request) : await userRead(request);
  } catch (error) {
    return handleSafeRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("x-video-gateway-device-token")) return await publishDiscovery(request);
    assertTrustedMutationOrigin(request);
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const payload = userMutationSchema.parse(await parseBoundedJson(request, 8 * 1024));
    const site = await getObserverSiteAccess(session.supabase, session.profile, payload.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לנהל חיבור באתר הזה.", 403);
    await assertRateLimit(privateRateLimitIdentifier({ userId: session.profile.id, tenantId: site.id, headers: request.headers }), "/api/digital-observer/software-connector", 12, 60);
    if (payload.action === "configure") return await configureCandidate(payload, session, site);
    if (payload.action === "activate") return await activateCamera(payload, site, session.profile.id);
    if (payload.action === "configure_batch") {
      const configured = [];
      for (const camera of payload.cameras) {
        const response = await configureCandidate({ action: "configure", observer_site_id: payload.observer_site_id,
          gateway_id: payload.gateway_id, ...camera }, session, site);
        if (!response.ok) return response;
        configured.push((await response.json()).data);
      }
      return ok({ status: "CAMERAS_CONFIGURED", cameras: configured });
    }
    const activated = [];
    for (const cameraSourceId of payload.camera_source_ids) {
      const response = await activateCamera({ action: "activate", observer_site_id: payload.observer_site_id,
        camera_source_id: cameraSourceId, effort: payload.effort }, site, session.profile.id);
      if (!response.ok) return response;
      activated.push((await response.json()).data);
    }
    return ok({ status: "ACTIVE_MONITORING", cameras: activated });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
