export const connectivityRegistryVersion = "connectivity-registry-v1";
export const connectionStrategies = [
  "VENDOR_CLOUD", "ACCOUNT_LINK", "VENDOR_P2P", "DIRECT_SECURE", "MOBILE_PROVISIONED",
  "ONVIF_DIRECT", "RTSP_DIRECT", "SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY", "ENTERPRISE_EDGE"
] as const;
export type ConnectionStrategy = typeof connectionStrategies[number];
export type CapabilityEvidence = "VERIFIED_REAL" | "VERIFIED_VENDOR_DOCUMENTATION" | "INTEGRATION_TESTED" | "INFERRED" | "UNKNOWN";
export const connectivityFamilyIds = ["unknown", "tapo-c211", "generic-onvif", "generic-rtsp", "generic-recorder", "nest-wired"] as const;
export type ConnectivityFamilyId = typeof connectivityFamilyIds[number];

export type ConnectivityCapability = {
  kind: "RTSP" | "ONVIF" | "VENDOR_API" | "P2P" | "MOBILE_PROVISIONING";
  evidence: CapabilityEvidence;
  reference: string | null;
  adapterImplemented: boolean;
  verifiedAt: string | null;
  firmwareScope: "UNKNOWN" | "EXACT";
};
export type ConnectivityFamily = {
  id: ConnectivityFamilyId;
  vendor: "UNKNOWN" | "TP_LINK" | "GENERIC" | "GOOGLE";
  label: string;
  model: string | null;
  capabilities: readonly ConnectivityCapability[];
  authentication: "CAMERA_ACCOUNT" | "VENDOR_OAUTH" | "IDENTIFY_FIRST";
  limitations: readonly string[];
};

// Claims are specific to the listed device/protocol. Endpoint reachability is
// not ONVIF profile/authentication QA, and vendor documentation is not our adapter.
export const connectivityRegistry: readonly ConnectivityFamily[] = [
  { id: "unknown", vendor: "UNKNOWN", label: "אני לא יודע איזו מערכת יש לי", model: null,
    capabilities: [], authentication: "IDENTIFY_FIRST", limitations: ["DEVICE_IDENTIFICATION_REQUIRED"] },
  { id: "tapo-c211", vendor: "TP_LINK", label: "TP-Link Tapo C211", model: "C211",
    capabilities: [
      { kind: "RTSP", evidence: "VERIFIED_REAL", reference: "DIGITAL_OBSERVER_PUSH_16C_TAPO_REAL_CONNECTOR_CLOSURE_REPORT.md", adapterImplemented: true, verifiedAt: "2026-09-07T17:48:39.034Z", firmwareScope: "UNKNOWN" },
      { kind: "ONVIF", evidence: "VERIFIED_VENDOR_DOCUMENTATION", reference: "https://www.tapo.com/us/faq/34/", adapterImplemented: true, verifiedAt: "2026-09-07T00:00:00Z", firmwareScope: "UNKNOWN" },
      { kind: "VENDOR_API", evidence: "UNKNOWN", reference: null, adapterImplemented: false, verifiedAt: null, firmwareScope: "UNKNOWN" },
      { kind: "P2P", evidence: "UNKNOWN", reference: null, adapterImplemented: false, verifiedAt: null, firmwareScope: "UNKNOWN" }
    ], authentication: "CAMERA_ACCOUNT", limitations: ["CAMERA_ACCOUNT_REQUIRED", "VERIFIED_PATH_REQUIRES_LOCAL_BRIDGE", "THIRD_PARTY_PERSISTENT_CLOUD_PATH_NOT_VERIFIED", "ONVIF_REAL_PROFILE_QA_PENDING"] },
  { id: "generic-onvif", vendor: "GENERIC", label: "מצלמה תואמת — זיהוי מתקדם", model: null,
    capabilities: [{ kind: "ONVIF", evidence: "INTEGRATION_TESTED", reference: "scripts/qa/check-digital-observer-camera-connection-layer.mjs", adapterImplemented: true, verifiedAt: "2026-09-07T00:00:00Z", firmwareScope: "UNKNOWN" }],
    authentication: "CAMERA_ACCOUNT", limitations: ["DEVICE_CAPABILITIES_MUST_BE_DISCOVERED", "REAL_DEVICE_PROFILE_QA_PENDING"] },
  { id: "generic-rtsp", vendor: "GENERIC", label: "מצלמת רשת אחרת", model: null,
    capabilities: [{ kind: "RTSP", evidence: "INTEGRATION_TESTED", reference: "scripts/qa/check-software-connector.mjs", adapterImplemented: true, verifiedAt: "2026-09-07T00:00:00Z", firmwareScope: "UNKNOWN" }],
    authentication: "CAMERA_ACCOUNT", limitations: ["DEVICE_CAPABILITIES_MUST_BE_DISCOVERED"] },
  { id: "generic-recorder", vendor: "GENERIC", label: "מערכת עם כמה מצלמות", model: null,
    capabilities: [], authentication: "IDENTIFY_FIRST", limitations: ["RECORDER_MODEL_REQUIRED", "EXISTING_GATEWAY_DOES_NOT_PROVE_HARDWARE_NECESSITY"] },
  { id: "nest-wired", vendor: "GOOGLE", label: "Google Nest Cam (indoor, wired)", model: "Nest Cam (indoor, wired)",
    capabilities: [{ kind: "VENDOR_API", evidence: "VERIFIED_VENDOR_DOCUMENTATION", reference: "https://developers.google.com/nest/device-access/api/camera-wired", adapterImplemented: false, verifiedAt: "2026-09-07T00:00:00Z", firmwareScope: "UNKNOWN" }],
    authentication: "VENDOR_OAUTH", limitations: ["ZERO_INSTALL_INTEGRATION_NOT_YET_AVAILABLE", "VENDOR_PROJECT_AUTHORIZATION_REQUIRED", "NO_PRODUCTION_ADAPTER"] }
];

export function connectivityFamily(id: ConnectivityFamilyId): ConnectivityFamily {
  return connectivityRegistry.find(family => family.id === id) ?? connectivityRegistry[0];
}

export function capabilityFreshness(capability: ConnectivityCapability, now: Date): "CURRENT" | "STALE" | "UNKNOWN" {
  if (!capability.verifiedAt) return "UNKNOWN";
  const age = now.getTime() - Date.parse(capability.verifiedAt);
  return Number.isFinite(age) && age >= 0 && age <= 90 * 86400_000 ? "CURRENT" : "STALE";
}
