import type { DigitalObserverConnectorType } from "@/lib/domain/digital-observer/connectors";
import type { ObserverCameraPairingMethod, ObserverPairingPayloadKind } from "@/lib/domain/digital-observer/camera-connection-methods";

export const cameraConnectionContractVersion = "camera-source-v1";
export const cameraConnectionResolverVersion = "digital-first-resolver-v1";
export const cameraConnectionConfigurationVersion = 1;

export const cameraConnectionMethods = [
  "VENDOR_CLOUD_API",
  "DIRECT_SECURE",
  "RTSP",
  "ONVIF",
  "DVR_NVR",
  "SOFTWARE_CONNECTOR",
  "PHYSICAL_GATEWAY",
  "ENTERPRISE_EDGE",
  "DEMO"
] as const;
export type CameraConnectionMethod = (typeof cameraConnectionMethods)[number];

export const cameraConnectionCapabilities = [
  "LIVE_STREAM",
  "CAMERA_DISCOVERY",
  "CHANNEL_DISCOVERY",
  "NATIVE_MOTION_EVENTS",
  "NATIVE_PERSON_EVENTS",
  "LINE_CROSSING_EVENTS",
  "PTZ",
  "RECORDING_ACCESS",
  "HEALTH",
  "REMOTE_CONFIGURATION"
] as const;
export type CameraConnectionCapability = (typeof cameraConnectionCapabilities)[number];

export const cameraConnectionHealthStates = [
  "HEALTHY",
  "DEGRADED",
  "AUTH_FAILED",
  "OFFLINE",
  "NO_FRAMES",
  "HIGH_LATENCY",
  "UNSTABLE",
  "UNSUPPORTED",
  "CONFIG_REQUIRED"
] as const;
export type CameraConnectionHealthState = (typeof cameraConnectionHealthStates)[number];

export const cameraStreamLifecycleStates = [
  "DISCOVERED",
  "CONFIGURED",
  "CONNECTING",
  "STREAMING",
  "DEGRADED",
  "RECONNECTING",
  "OFFLINE"
] as const;
export type CameraStreamLifecycleState = (typeof cameraStreamLifecycleStates)[number];

export const cameraConnectionRecommendations = [
  "DIRECT_CONNECTION_AVAILABLE",
  "SOFTWARE_CONNECTOR_REQUIRED",
  "PHYSICAL_GATEWAY_REQUIRED",
  "ENTERPRISE_EDGE_RECOMMENDED",
  "UNSUPPORTED_SYSTEM"
] as const;
export type CameraConnectionRecommendation = (typeof cameraConnectionRecommendations)[number];

export type CameraConnectionAssessmentInput = {
  tenantId?: string | null;
  siteId: string;
  sourceId?: string | null;
  connectorType: DigitalObserverConnectorType;
  provider?: string | null;
  pairingMethod?: ObserverCameraPairingMethod | null;
  pairingPayloadKind?: ObserverPairingPayloadKind | null;
  vendorCloudAvailable?: boolean;
  vendorCloudAuthorized?: boolean;
  vendorCloudTls?: boolean;
  directSecureAvailable?: boolean;
  directSecureReachable?: boolean;
  directSecureTls?: boolean;
  directSecureOutboundOnly?: boolean;
  rtspAvailable?: boolean;
  rtspReachable?: boolean;
  rtspTls?: boolean;
  rtspInternetExposed?: boolean;
  onvifAvailable?: boolean;
  onvifReachable?: boolean;
  onvifTls?: boolean;
  privateNetworkOnly?: boolean;
  softwareConnectorAvailable?: boolean;
  softwareConnectorInstalled?: boolean;
  softwareConnectorOutboundOnly?: boolean;
  physicalGatewayAvailable?: boolean;
  physicalGatewayEnrolled?: boolean;
  physicalGatewayOutboundOnly?: boolean;
  enterpriseEdgeRequired?: boolean;
  enterpriseEdgeAvailable?: boolean;
  legacySystem?: boolean;
  privacyRequiresLocalProcessing?: boolean;
  credentialReferenceConfigured?: boolean;
  endpointReferenceConfigured?: boolean;
  discoveredCapabilities?: CameraConnectionCapability[];
};

export type CameraConnectionAlternative = {
  method: CameraConnectionMethod;
  eligible: boolean;
  automaticFallbackAllowed: boolean;
  reasonCodes: string[];
};

export type CameraConnectionAssessment = {
  contractVersion: typeof cameraConnectionContractVersion;
  resolverVersion: typeof cameraConnectionResolverVersion;
  assessedAt: string;
  recommendation: CameraConnectionRecommendation;
  preferredMethod: CameraConnectionMethod | null;
  adapterType: string | null;
  adapterVersion: string | null;
  productionEligible: boolean;
  reasonCodes: string[];
  missingRequirements: string[];
  securityNotes: string[];
  capabilities: CameraConnectionCapability[];
  transportProfile: {
    relayMode: "CLOUD_PROVIDER" | "DIRECT" | "LOCAL_CONNECTOR" | "LOCAL_GATEWAY" | "ENTERPRISE_EDGE" | "DEMO" | "UNKNOWN";
    estimatedBandwidthMode: "VENDOR_DEPENDENT" | "STREAM_ON_DEMAND" | "METADATA_AND_EVENT_MEDIA" | "LOCAL_PROCESSING" | "NONE" | "UNKNOWN";
    nativeEventSupport: boolean;
  };
  alternatives: CameraConnectionAlternative[];
  automaticFallbackEnabled: false;
};

export type CanonicalCameraSource = {
  contractVersion: typeof cameraConnectionContractVersion;
  sourceId: string;
  tenantId: string | null;
  siteId: string;
  cameraStreamId: string | null;
  channel: number | null;
  displayName: string;
  vendor: string | null;
  systemType: string;
  connectionMethod: CameraConnectionMethod;
  protocol: string | null;
  adapterType: string;
  adapterVersion: string;
  configurationVersion: number;
  capabilities: CameraConnectionCapability[];
  credentialReferenceConfigured: boolean;
  endpointReferenceConfigured: boolean;
  gatewayOrConnectorRequired: boolean;
  health: {
    state: CameraConnectionHealthState;
    reason: string | null;
    checkedAt: string | null;
    lastSeenAt: string | null;
    latencyMs: number | null;
  };
  stream: {
    state: CameraStreamLifecycleState;
    lastSuccessfulFrameAt: string | null;
    reconnectCount: number;
    fallbackMethod: CameraConnectionMethod | null;
  };
};

export type CameraConnectionAdapter = {
  readonly type: string;
  readonly version: string;
  readonly status: "PRODUCTION_VERIFIED" | "REAL_DATA_CAPABLE" | "EXISTS_NEEDS_REAL_DEVICE_QA" | "FOUNDATION_READY" | "CONTRACT_ONLY" | "MOCK";
  readonly methods: readonly CameraConnectionMethod[];
  readonly connectorTypes: readonly DigitalObserverConnectorType[];
  readonly capabilities: readonly CameraConnectionCapability[];
  discover(input: unknown): Promise<unknown>;
  assess(input: CameraConnectionAssessmentInput): Promise<CameraConnectionAssessment>;
  connect(input: unknown): Promise<unknown>;
  getStream(input: unknown): Promise<unknown>;
  getHealth(input: unknown): Promise<unknown>;
  getNativeEvents(input: unknown): Promise<unknown>;
  disconnect(input: unknown): Promise<void>;
};

export type CameraConnectionAdapterDescriptor = Pick<CameraConnectionAdapter, "type" | "version" | "status" | "methods" | "connectorTypes" | "capabilities">;

export const cameraConnectionAdapters: readonly CameraConnectionAdapterDescriptor[] = [
  {
    type: "private_dvr_gateway",
    version: "1.0.0",
    status: "PRODUCTION_VERIFIED",
    methods: ["DVR_NVR", "PHYSICAL_GATEWAY"],
    connectorTypes: ["dvr", "nvr"],
    capabilities: ["LIVE_STREAM", "CHANNEL_DISCOVERY", "RECORDING_ACCESS", "HEALTH"]
  },
  {
    type: "rtsp_gateway",
    version: "1.0.0",
    status: "REAL_DATA_CAPABLE",
    methods: ["RTSP", "SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY"],
    connectorTypes: ["rtsp", "ip_camera"],
    capabilities: ["LIVE_STREAM", "RECORDING_ACCESS", "HEALTH"]
  },
  {
    type: "video_gateway",
    version: "1.0.0",
    status: "REAL_DATA_CAPABLE",
    methods: ["PHYSICAL_GATEWAY"],
    connectorTypes: ["edge_gateway", "ip_camera"],
    capabilities: ["LIVE_STREAM", "CAMERA_DISCOVERY", "CHANNEL_DISCOVERY", "RECORDING_ACCESS", "HEALTH"]
  },
  {
    type: "onvif_gateway",
    version: "1.0.0",
    status: "EXISTS_NEEDS_REAL_DEVICE_QA",
    methods: ["ONVIF", "SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY"],
    connectorTypes: ["onvif", "ip_camera"],
    capabilities: ["CAMERA_DISCOVERY", "LIVE_STREAM", "HEALTH"]
  },
  {
    type: "vendor_cloud_api",
    version: "1.0.0",
    status: "FOUNDATION_READY",
    methods: ["VENDOR_CLOUD_API"],
    connectorTypes: ["cloud_provider"],
    capabilities: []
  },
  {
    type: "direct_secure",
    version: "1.0.0",
    status: "CONTRACT_ONLY",
    methods: ["DIRECT_SECURE"],
    connectorTypes: ["ip_camera", "rtsp", "onvif"],
    capabilities: []
  },
  {
    type: "software_connector",
    version: "1.0.0",
    status: "CONTRACT_ONLY",
    methods: ["SOFTWARE_CONNECTOR"],
    connectorTypes: ["ip_camera", "rtsp", "onvif", "dvr", "nvr"],
    capabilities: []
  },
  {
    type: "enterprise_edge",
    version: "1.0.0",
    status: "CONTRACT_ONLY",
    methods: ["ENTERPRISE_EDGE"],
    connectorTypes: ["edge_gateway"],
    capabilities: []
  },
  {
    type: "demo",
    version: "1.0.0",
    status: "MOCK",
    methods: ["DEMO"],
    connectorTypes: ["demo"],
    capabilities: []
  }
] as const;

function uniqueCapabilities(values: CameraConnectionCapability[]) {
  return Array.from(new Set(values)).filter((value): value is CameraConnectionCapability => cameraConnectionCapabilities.includes(value));
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function connectionMethodValue(value: unknown): CameraConnectionMethod | null {
  return typeof value === "string" && cameraConnectionMethods.includes(value as CameraConnectionMethod)
    ? value as CameraConnectionMethod
    : null;
}

function descriptorForMethod(method: CameraConnectionMethod | null, connectorType: DigitalObserverConnectorType) {
  if (!method) return null;
  return cameraConnectionAdapters.find((adapter) => adapter.methods.includes(method) && adapter.connectorTypes.includes(connectorType))
    ?? cameraConnectionAdapters.find((adapter) => adapter.methods.includes(method))
    ?? null;
}

function alternative(method: CameraConnectionMethod, eligible: boolean, reasonCodes: string[], automaticFallbackAllowed = false): CameraConnectionAlternative {
  return { method, eligible, automaticFallbackAllowed, reasonCodes };
}

export function assessCameraConnection(input: CameraConnectionAssessmentInput, now = new Date()): CameraConnectionAssessment {
  const reasonCodes: string[] = [];
  const missingRequirements: string[] = [];
  const securityNotes = ["CREDENTIALS_SERVER_SIDE_ONLY", "NO_BROWSER_SOURCE_ENDPOINT", "TENANT_SITE_SCOPE_REQUIRED"];
  const alternatives: CameraConnectionAlternative[] = [];
  let recommendation: CameraConnectionRecommendation = "UNSUPPORTED_SYSTEM";
  let preferredMethod: CameraConnectionMethod | null = null;
  let productionEligible = false;

  if (input.connectorType === "demo") {
    preferredMethod = "DEMO";
    reasonCodes.push("EXPLICIT_TEST_DEMO_ONLY");
    securityNotes.push("NOT_PRODUCTION_CAMERA_TRUTH");
  } else if (input.enterpriseEdgeRequired && input.enterpriseEdgeAvailable) {
    recommendation = "ENTERPRISE_EDGE_RECOMMENDED";
    preferredMethod = "ENTERPRISE_EDGE";
    reasonCodes.push("EXPLICIT_ENTERPRISE_LOCAL_PROCESSING_REQUIREMENT");
    productionEligible = true;
  } else if (input.vendorCloudAvailable && input.vendorCloudAuthorized && input.vendorCloudTls) {
    recommendation = "DIRECT_CONNECTION_AVAILABLE";
    preferredMethod = "VENDOR_CLOUD_API";
    reasonCodes.push("AUTHORIZED_VENDOR_API_AVAILABLE", "TLS_TRANSPORT_AVAILABLE");
    productionEligible = true;
  } else if (input.directSecureAvailable && input.directSecureReachable && input.directSecureTls && input.directSecureOutboundOnly) {
    recommendation = "DIRECT_CONNECTION_AVAILABLE";
    preferredMethod = "DIRECT_SECURE";
    reasonCodes.push("OUTBOUND_SECURE_DIRECT_PATH_AVAILABLE", "TLS_TRANSPORT_AVAILABLE");
    productionEligible = true;
  } else {
    const standardProtocol = input.onvifAvailable ? "ONVIF" as const : input.rtspAvailable ? "RTSP" as const : null;
    const standardDirectSafe = Boolean(
      standardProtocol
      && (input.onvifReachable || input.rtspReachable)
      && !input.privateNetworkOnly
      && !input.rtspInternetExposed
      && (standardProtocol === "ONVIF" ? input.onvifTls : input.rtspTls)
    );

    if (standardDirectSafe) {
      recommendation = "DIRECT_CONNECTION_AVAILABLE";
      preferredMethod = standardProtocol;
      reasonCodes.push("STANDARD_PROTOCOL_SECURELY_REACHABLE");
      productionEligible = true;
    } else if (standardProtocol && input.softwareConnectorAvailable) {
      recommendation = "SOFTWARE_CONNECTOR_REQUIRED";
      preferredMethod = "SOFTWARE_CONNECTOR";
      reasonCodes.push("STANDARD_PROTOCOL_IS_LAN_SCOPED", `UNDERLYING_PROTOCOL_${standardProtocol}`);
      if (input.softwareConnectorInstalled && input.softwareConnectorOutboundOnly) {
        reasonCodes.push("OUTBOUND_SOFTWARE_CONNECTOR_READY");
        productionEligible = true;
      } else {
        missingRequirements.push("INSTALL_AND_ENROLL_SOFTWARE_CONNECTOR");
      }
    } else if (
      input.physicalGatewayAvailable
      && input.physicalGatewayEnrolled
      && input.physicalGatewayOutboundOnly
      && (input.legacySystem || input.privateNetworkOnly || input.privacyRequiresLocalProcessing)
    ) {
      recommendation = "PHYSICAL_GATEWAY_REQUIRED";
      preferredMethod = "PHYSICAL_GATEWAY";
      reasonCodes.push(
        input.legacySystem ? "LEGACY_RECORDER_REQUIRES_LOCAL_BRIDGE" : "DIRECT_PATH_NOT_SAFELY_REACHABLE",
        "OUTBOUND_AUTHENTICATED_GATEWAY_AVAILABLE"
      );
      if (input.privacyRequiresLocalProcessing) reasonCodes.push("LOCAL_PROCESSING_REQUIRED_BY_POLICY");
      productionEligible = true;
    } else if ((input.legacySystem || input.privateNetworkOnly || input.privacyRequiresLocalProcessing) && !input.softwareConnectorAvailable) {
      recommendation = "PHYSICAL_GATEWAY_REQUIRED";
      preferredMethod = "PHYSICAL_GATEWAY";
      reasonCodes.push(input.legacySystem ? "LEGACY_RECORDER_REQUIRES_LOCAL_BRIDGE" : "DIRECT_PATH_NOT_SAFELY_REACHABLE");
      missingRequirements.push("ENROLL_OUTBOUND_PHYSICAL_GATEWAY");
      if (input.privacyRequiresLocalProcessing) reasonCodes.push("LOCAL_PROCESSING_REQUIRED_BY_POLICY");
    } else if (input.enterpriseEdgeRequired) {
      recommendation = "ENTERPRISE_EDGE_RECOMMENDED";
      preferredMethod = "ENTERPRISE_EDGE";
      reasonCodes.push("ENTERPRISE_EDGE_REQUIREMENT_NOT_PROVISIONED");
      missingRequirements.push("PROVISION_ENTERPRISE_EDGE");
    } else {
      if (input.vendorCloudAvailable && !input.vendorCloudAuthorized) missingRequirements.push("AUTHORIZE_VENDOR_CLOUD_ACCOUNT");
      if (input.vendorCloudAvailable && !input.vendorCloudTls) missingRequirements.push("VENDOR_API_TLS_REQUIRED");
      if (input.directSecureAvailable && !input.directSecureTls) missingRequirements.push("SECURE_DIRECT_TLS_REQUIRED");
      if (input.rtspInternetExposed && !input.rtspTls) securityNotes.push("INTERNET_EXPOSED_PLAINTEXT_RTSP_REJECTED");
      if (input.privateNetworkOnly && !input.softwareConnectorAvailable && !input.physicalGatewayAvailable) missingRequirements.push("LOCAL_CONNECTOR_OR_GATEWAY_REQUIRED");
      if (!missingRequirements.length) missingRequirements.push("SUPPORTED_CONNECTION_DETAILS_REQUIRED");
      reasonCodes.push("NO_VERIFIED_SAFE_CONNECTION_PATH");
    }
  }

  alternatives.push(
    alternative("VENDOR_CLOUD_API", Boolean(input.vendorCloudAvailable && input.vendorCloudAuthorized && input.vendorCloudTls), ["REQUIRES_AUTHORIZED_TLS_VENDOR_API"]),
    alternative("DIRECT_SECURE", Boolean(input.directSecureAvailable && input.directSecureReachable && input.directSecureTls && input.directSecureOutboundOnly), ["REQUIRES_OUTBOUND_TLS_DIRECT_PATH"]),
    alternative("ONVIF", Boolean(input.onvifAvailable && input.onvifReachable && input.onvifTls && !input.privateNetworkOnly), ["REQUIRES_SECURE_REACHABILITY"]),
    alternative("RTSP", Boolean(input.rtspAvailable && input.rtspReachable && input.rtspTls && !input.rtspInternetExposed && !input.privateNetworkOnly), ["PLAINTEXT_INTERNET_RTSP_IS_NOT_ALLOWED"]),
    alternative("SOFTWARE_CONNECTOR", Boolean((input.onvifAvailable || input.rtspAvailable) && input.softwareConnectorAvailable), ["OUTBOUND_LOCAL_BRIDGE_PREFERRED_BEFORE_HARDWARE"]),
    alternative("PHYSICAL_GATEWAY", Boolean(input.physicalGatewayAvailable && (input.legacySystem || input.privateNetworkOnly || input.privacyRequiresLocalProcessing)), ["ONLY_WHEN_LOCAL_OR_LEGACY_CONSTRAINT_JUSTIFIES_HARDWARE"]),
    alternative("ENTERPRISE_EDGE", Boolean(input.enterpriseEdgeRequired), ["EXPLICIT_ENTERPRISE_REQUIREMENT_ONLY"])
  );

  const descriptor = descriptorForMethod(preferredMethod, input.connectorType);
  const relayMode = preferredMethod === "VENDOR_CLOUD_API" ? "CLOUD_PROVIDER" as const
    : ["DIRECT_SECURE", "RTSP", "ONVIF"].includes(preferredMethod ?? "") ? "DIRECT" as const
      : preferredMethod === "SOFTWARE_CONNECTOR" ? "LOCAL_CONNECTOR" as const
        : preferredMethod === "PHYSICAL_GATEWAY" ? "LOCAL_GATEWAY" as const
          : preferredMethod === "ENTERPRISE_EDGE" ? "ENTERPRISE_EDGE" as const
            : preferredMethod === "DEMO" ? "DEMO" as const
              : "UNKNOWN" as const;
  const estimatedBandwidthMode = preferredMethod === "VENDOR_CLOUD_API" ? "VENDOR_DEPENDENT" as const
    : ["DIRECT_SECURE", "RTSP", "ONVIF"].includes(preferredMethod ?? "") ? "STREAM_ON_DEMAND" as const
      : ["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY"].includes(preferredMethod ?? "") ? "METADATA_AND_EVENT_MEDIA" as const
        : preferredMethod === "ENTERPRISE_EDGE" ? "LOCAL_PROCESSING" as const
          : preferredMethod === "DEMO" ? "NONE" as const
            : "UNKNOWN" as const;
  return {
    contractVersion: cameraConnectionContractVersion,
    resolverVersion: cameraConnectionResolverVersion,
    assessedAt: now.toISOString(),
    recommendation,
    preferredMethod,
    adapterType: descriptor?.type ?? null,
    adapterVersion: descriptor?.version ?? null,
    productionEligible,
    reasonCodes,
    missingRequirements: Array.from(new Set(missingRequirements)),
    securityNotes: Array.from(new Set(securityNotes)),
    capabilities: uniqueCapabilities(input.discoveredCapabilities ?? []),
    transportProfile: {
      relayMode,
      estimatedBandwidthMode,
      nativeEventSupport: Boolean(input.discoveredCapabilities?.some((capability) => ["NATIVE_MOTION_EVENTS", "NATIVE_PERSON_EVENTS", "LINE_CROSSING_EVENTS"].includes(capability)))
    },
    alternatives,
    automaticFallbackEnabled: false
  };
}

export function cameraConnectionMetadataForAssessment(assessment: CameraConnectionAssessment) {
  return {
    camera_source_contract_version: cameraConnectionContractVersion,
    connection_resolver_version: cameraConnectionResolverVersion,
    connection_configuration_version: cameraConnectionConfigurationVersion,
    connection_method: assessment.preferredMethod,
    adapter_type: assessment.adapterType,
    adapter_version: assessment.adapterVersion,
    connection_assessment: {
      assessed_at: assessment.assessedAt,
      recommendation: assessment.recommendation,
      preferred_method: assessment.preferredMethod,
      production_eligible: assessment.productionEligible,
      reason_codes: assessment.reasonCodes,
      missing_requirements: assessment.missingRequirements,
      security_notes: assessment.securityNotes,
      capabilities: assessment.capabilities,
      transport_profile: assessment.transportProfile,
      alternatives: assessment.alternatives,
      automatic_fallback_enabled: false
    },
    physical_gateway_is_exception: true
  };
}

export function buildPairingConnectionAssessmentInput(input: {
  siteId: string;
  connectorType: DigitalObserverConnectorType;
  provider?: string | null;
  pairingMethod?: ObserverCameraPairingMethod | null;
  pairingPayloadKind?: ObserverPairingPayloadKind | null;
}): CameraConnectionAssessmentInput {
  const cloudCandidate = input.connectorType === "cloud_provider";
  const onvifCandidate = input.connectorType === "onvif" || input.pairingPayloadKind === "onvif";
  const rtspCandidate = input.connectorType === "rtsp" || input.pairingPayloadKind === "rtsp";
  const recorderCandidate = input.connectorType === "dvr" || input.connectorType === "nvr" || input.pairingMethod === "recorder";
  const explicitGateway = input.connectorType === "edge_gateway" || input.pairingMethod === "secure_gateway";
  const knownProvider = Boolean(input.provider && !["unknown", "generic", "other"].includes(input.provider));
  return {
    siteId: input.siteId,
    connectorType: input.connectorType,
    provider: input.provider,
    pairingMethod: input.pairingMethod,
    pairingPayloadKind: input.pairingPayloadKind,
    vendorCloudAvailable: cloudCandidate && knownProvider,
    vendorCloudAuthorized: false,
    vendorCloudTls: cloudCandidate,
    rtspAvailable: rtspCandidate || recorderCandidate,
    onvifAvailable: onvifCandidate,
    privateNetworkOnly: onvifCandidate || rtspCandidate || recorderCandidate || explicitGateway,
    softwareConnectorAvailable: onvifCandidate || rtspCandidate || recorderCandidate,
    softwareConnectorInstalled: false,
    softwareConnectorOutboundOnly: true,
    physicalGatewayAvailable: explicitGateway,
    physicalGatewayEnrolled: false,
    physicalGatewayOutboundOnly: true,
    legacySystem: recorderCandidate || explicitGateway,
    credentialReferenceConfigured: false,
    endpointReferenceConfigured: false,
    discoveredCapabilities: []
  };
}

function capabilityMapFromRow(row: Record<string, unknown>): CameraConnectionCapability[] {
  const capabilities = objectValue(row.capabilities);
  const values: CameraConnectionCapability[] = [];
  if (capabilities.live_view === true || capabilities.preview === true) values.push("LIVE_STREAM");
  if (capabilities.event_clips === true) values.push("RECORDING_ACCESS");
  if (capabilities.ptz === true) values.push("PTZ");
  if (capabilities.native_motion_events === true) values.push("NATIVE_MOTION_EVENTS");
  if (capabilities.native_person_events === true) values.push("NATIVE_PERSON_EVENTS");
  if (capabilities.line_crossing_events === true) values.push("LINE_CROSSING_EVENTS");
  if (row.health_status || row.status) values.push("HEALTH");
  if (row.connector_type === "dvr" || row.connector_type === "nvr") values.push("CHANNEL_DISCOVERY");
  if (row.connector_type === "onvif") values.push("CAMERA_DISCOVERY");
  return uniqueCapabilities(values);
}

export function buildExistingSourceAssessmentInput(row: Record<string, unknown>): CameraConnectionAssessmentInput {
  const metadata = objectValue(row.metadata);
  const connectorType = String(row.connector_type ?? "ip_camera") as DigitalObserverConnectorType;
  const gatewayBound = Boolean(metadata.gateway_id || metadata.gateway_stream_id || metadata.video_gateway_stream_id || row.gateway_provider);
  const legacy = connectorType === "dvr" || connectorType === "nvr";
  return {
    tenantId: stringValue(row.tenant_id),
    siteId: String(row.observer_site_id),
    sourceId: String(row.id),
    connectorType,
    provider: stringValue(row.connector_provider),
    pairingMethod: (metadata.pairing_method as ObserverCameraPairingMethod | undefined) ?? null,
    pairingPayloadKind: (metadata.pairing_payload_kind as ObserverPairingPayloadKind | undefined) ?? null,
    vendorCloudAvailable: connectorType === "cloud_provider" && metadata.vendor_api_available === true,
    vendorCloudAuthorized: metadata.vendor_api_authorized === true,
    vendorCloudTls: metadata.vendor_api_tls === true,
    directSecureAvailable: metadata.direct_secure_available === true,
    directSecureReachable: metadata.direct_secure_reachable === true,
    directSecureTls: metadata.direct_secure_tls === true,
    directSecureOutboundOnly: metadata.direct_secure_outbound_only === true,
    rtspAvailable: connectorType === "rtsp" || legacy || String(row.stream_protocol ?? "").startsWith("rtsp"),
    rtspReachable: metadata.direct_rtsp_reachable === true,
    rtspTls: metadata.direct_rtsp_tls === true,
    rtspInternetExposed: metadata.internet_exposed_rtsp === true,
    onvifAvailable: connectorType === "onvif" || metadata.onvif_available === true,
    onvifReachable: metadata.direct_onvif_reachable === true,
    onvifTls: metadata.direct_onvif_tls === true,
    privateNetworkOnly: metadata.private_network_only !== false && (legacy || gatewayBound || connectorType === "rtsp" || connectorType === "onvif"),
    softwareConnectorAvailable: metadata.software_connector_available === true,
    softwareConnectorInstalled: metadata.software_connector_installed === true,
    softwareConnectorOutboundOnly: metadata.software_connector_outbound_only !== false,
    physicalGatewayAvailable: gatewayBound,
    physicalGatewayEnrolled: Boolean(metadata.gateway_id || metadata.gateway_stream_id),
    physicalGatewayOutboundOnly: metadata.gateway_outbound_only !== false,
    enterpriseEdgeRequired: metadata.enterprise_edge_required === true,
    enterpriseEdgeAvailable: metadata.enterprise_edge_available === true,
    legacySystem: legacy || metadata.legacy_system === true,
    privacyRequiresLocalProcessing: metadata.local_processing_required === true,
    credentialReferenceConfigured: Boolean(row.secret_reference || metadata.credentials_server_side),
    endpointReferenceConfigured: Boolean(metadata.endpoint_reference_present || metadata.gateway_stream_id),
    discoveredCapabilities: capabilityMapFromRow(row)
  };
}

export function normalizeCameraConnectionHealth(input: {
  status?: string | null;
  healthStatus?: string | null;
  authFailed?: boolean;
  configured?: boolean;
  supported?: boolean;
  lastFrameAt?: string | null;
  now?: Date;
  latencyMs?: number | null;
  reconnectCount?: number | null;
}): { state: CameraConnectionHealthState; lifecycle: CameraStreamLifecycleState; reason: string | null } {
  const now = input.now ?? new Date();
  const status = String(input.healthStatus ?? input.status ?? "").toLowerCase();
  const frameAgeMs = input.lastFrameAt ? now.getTime() - Date.parse(input.lastFrameAt) : null;
  if (input.supported === false) return { state: "UNSUPPORTED", lifecycle: "OFFLINE", reason: "ADAPTER_UNSUPPORTED" };
  if (input.configured === false) return { state: "CONFIG_REQUIRED", lifecycle: "DISCOVERED", reason: "CONFIGURATION_REQUIRED" };
  if (input.authFailed || status.includes("auth")) return { state: "AUTH_FAILED", lifecycle: "OFFLINE", reason: "AUTHENTICATION_FAILED" };
  if (["offline", "failed", "error", "disabled", "blocked"].includes(status)) return { state: "OFFLINE", lifecycle: "OFFLINE", reason: "CONNECTION_OFFLINE" };
  if (typeof frameAgeMs === "number" && Number.isFinite(frameAgeMs) && frameAgeMs > 15_000) return { state: "NO_FRAMES", lifecycle: "DEGRADED", reason: "FRAME_FRESHNESS_EXCEEDED" };
  if ((input.latencyMs ?? 0) > 5_000) return { state: "HIGH_LATENCY", lifecycle: "DEGRADED", reason: "LATENCY_EXCEEDED" };
  if ((input.reconnectCount ?? 0) >= 5) return { state: "UNSTABLE", lifecycle: "RECONNECTING", reason: "RECONNECT_RATE_HIGH" };
  if (["degraded", "stale", "reconnecting"].includes(status)) return { state: "DEGRADED", lifecycle: status === "reconnecting" ? "RECONNECTING" : "DEGRADED", reason: "SOURCE_DEGRADED" };
  if (["connected", "healthy", "online", "active", "streaming"].includes(status)) return { state: "HEALTHY", lifecycle: "STREAMING", reason: null };
  if (["configured", "ready_to_test", "ready"].includes(status)) return { state: "CONFIG_REQUIRED", lifecycle: "CONFIGURED", reason: "CONNECTION_TEST_REQUIRED" };
  return { state: "CONFIG_REQUIRED", lifecycle: "DISCOVERED", reason: "CONNECTION_STATE_UNKNOWN" };
}

export function canonicalCameraSourceFromRow(row: Record<string, unknown>): CanonicalCameraSource {
  const metadata = objectValue(row.metadata);
  const connectorType = String(row.connector_type ?? "ip_camera") as DigitalObserverConnectorType;
  const assessment = assessCameraConnection(buildExistingSourceAssessmentInput(row));
  const connectionMethod = connectionMethodValue(metadata.connection_method)
    ?? assessment.preferredMethod
    ?? (connectorType === "demo" ? "DEMO" : "DVR_NVR");
  const descriptor = descriptorForMethod(connectionMethod, connectorType);
  const normalized = normalizeCameraConnectionHealth({
    status: stringValue(row.status),
    healthStatus: stringValue(row.health_status),
    configured: Boolean(row.secret_reference || metadata.credentials_server_side || metadata.gateway_stream_id || connectorType === "demo"),
    supported: descriptor?.status !== "CONTRACT_ONLY",
    lastFrameAt: stringValue(row.last_seen_at),
    latencyMs: numberValue(metadata.gateway_latency_ms ?? row.gateway_latency_ms),
    reconnectCount: numberValue(metadata.reconnect_count) ?? 0
  });
  return {
    contractVersion: cameraConnectionContractVersion,
    sourceId: String(row.id),
    tenantId: row.tenant_id ? String(row.tenant_id) : null,
    siteId: String(row.observer_site_id),
    cameraStreamId: row.camera_stream_id ? String(row.camera_stream_id) : null,
    channel: Number.isFinite(Number(metadata.dvr_channel)) ? Number(metadata.dvr_channel) : null,
    displayName: String(row.display_name ?? "Camera"),
    vendor: row.connector_provider && row.connector_provider !== "generic" ? String(row.connector_provider) : null,
    systemType: connectorType,
    connectionMethod,
    protocol: row.stream_protocol ? String(row.stream_protocol) : null,
    adapterType: String(metadata.adapter_type ?? descriptor?.type ?? "unresolved"),
    adapterVersion: String(metadata.adapter_version ?? descriptor?.version ?? "0"),
    configurationVersion: Number(metadata.connection_configuration_version ?? cameraConnectionConfigurationVersion),
    capabilities: capabilityMapFromRow(row),
    credentialReferenceConfigured: Boolean(row.secret_reference || metadata.credentials_server_side),
    endpointReferenceConfigured: Boolean(metadata.endpoint_reference_present || metadata.gateway_stream_id),
    gatewayOrConnectorRequired: ["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY", "ENTERPRISE_EDGE"].includes(connectionMethod),
    health: {
      state: normalized.state,
      reason: normalized.reason,
      checkedAt: stringValue(row.last_health_check_at),
      lastSeenAt: stringValue(row.last_seen_at),
      latencyMs: numberValue(metadata.gateway_latency_ms ?? row.gateway_latency_ms)
    },
    stream: {
      state: normalized.lifecycle,
      lastSuccessfulFrameAt: stringValue(row.last_seen_at),
      reconnectCount: Number(metadata.reconnect_count ?? 0),
      fallbackMethod: connectionMethodValue(metadata.fallback_method)
    }
  };
}

export function cameraSourceClientView(source: CanonicalCameraSource) {
  return {
    contract_version: source.contractVersion,
    source_id: source.sourceId,
    site_id: source.siteId,
    camera_stream_id: source.cameraStreamId,
    channel: source.channel,
    display_name: source.displayName,
    vendor: source.vendor,
    system_type: source.systemType,
    connection_method: source.connectionMethod,
    protocol: source.protocol,
    adapter_type: source.adapterType,
    adapter_version: source.adapterVersion,
    configuration_version: source.configurationVersion,
    capabilities: source.capabilities,
    credential_reference_configured: source.credentialReferenceConfigured,
    endpoint_reference_configured: source.endpointReferenceConfigured,
    gateway_or_connector_required: source.gatewayOrConnectorRequired,
    health: source.health,
    stream: source.stream
  };
}

export function buildCameraDiscoveryIdentity(input: {
  tenantId: string;
  siteId: string;
  adapterType: string;
  stableDeviceReference?: string | null;
  channel?: number | string | null;
  vendor?: string | null;
  model?: string | null;
}) {
  const stable = String(input.stableDeviceReference ?? "").trim();
  const channel = String(input.channel ?? "").trim();
  if (stable && channel) {
    return {
      confidence: "EXACT" as const,
      autoMergeAllowed: true,
      identityKey: [input.tenantId, input.siteId, input.adapterType, stable, channel].join(":"),
      reason: "STABLE_DEVICE_AND_CHANNEL_MATCH"
    };
  }
  return {
    confidence: "AMBIGUOUS" as const,
    autoMergeAllowed: false,
    identityKey: null,
    reason: input.vendor || input.model ? "VENDOR_MODEL_REQUIRES_MANUAL_CONFIRMATION" : "STABLE_DEVICE_REFERENCE_REQUIRED"
  };
}

export function assertSafeCameraConnectionAssessmentPayload(value: unknown, path = "assessment") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeCameraConnectionAssessmentPayload(item, `${path}[${index}]`));
    return;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (/(password|secret|credential|token|cookie|authorization|rtsp_url|source_url|endpoint|host|private_ip)/i.test(key)) {
      if (!/(configured|available|reference|outbound|network)/i.test(key)) throw new Error(`UNSAFE_CAMERA_ASSESSMENT_FIELD:${path}.${key}`);
    }
    if (typeof item === "string" && (/rtsps?:\/\//i.test(item) || /:\/\/[^/\s]+@/.test(item))) {
      throw new Error(`UNSAFE_CAMERA_ASSESSMENT_VALUE:${path}.${key}`);
    }
    assertSafeCameraConnectionAssessmentPayload(item, `${path}.${key}`);
  }
}
