import type { DigitalObserverConnectorType } from "@/lib/domain/digital-observer/connectors";
import type { ObserverCameraPairingMethod, ObserverPairingPayloadKind } from "@/lib/domain/digital-observer/camera-connection-methods";
import type { CameraConnectionAssessment, CameraConnectionRecommendation } from "@/lib/domain/digital-observer/camera-connection-layer";

export const cameraOnboardingContractVersion = "camera-onboarding-v1";

export const cameraOnboardingStates = [
  "START",
  "SYSTEM_IDENTIFICATION",
  "ASSESSING",
  "CREDENTIALS_REQUIRED",
  "DISCOVERY",
  "CONNECTION_RECOMMENDED",
  "TESTING",
  "CAMERA_MAPPING",
  "READY_TO_ACTIVATE",
  "ACTIVE",
  "DEGRADED",
  "ACTION_REQUIRED",
  "UNSUPPORTED"
] as const;
export type CameraOnboardingState = (typeof cameraOnboardingStates)[number];

export const cameraSystemKinds = ["UNKNOWN", "VENDOR_CLOUD", "DVR_NVR", "IP_CAMERAS", "RTSP", "ONVIF", "OTHER"] as const;
export type CameraSystemKind = (typeof cameraSystemKinds)[number];

export type SafeOnboardingMapping = {
  stableChannelReference: string;
  suggestedName: string;
  locationLabel: string | null;
  selected: boolean;
  duplicateCandidate: boolean;
};

export type CameraOnboardingSession = {
  contractVersion: typeof cameraOnboardingContractVersion;
  observerSiteId: string;
  diagnosticId: string;
  state: CameraOnboardingState;
  systemKind: CameraSystemKind;
  connectorType: DigitalObserverConnectorType | null;
  connectorProvider: string | null;
  pairingMethod: ObserverCameraPairingMethod | null;
  pairingPayloadKind: ObserverPairingPayloadKind | null;
  credentialState: "NOT_REQUIRED" | "REQUIRED" | "SECURE_ENROLLMENT_REQUIRED" | "VERIFIED";
  assessment: CameraConnectionAssessment | null;
  mappings: SafeOnboardingMapping[];
  sourceId: string | null;
  lastErrorCategory: string | null;
  updatedAt: string;
};

const legalTransitions: Record<CameraOnboardingState, readonly CameraOnboardingState[]> = {
  START: ["SYSTEM_IDENTIFICATION", "ASSESSING", "CREDENTIALS_REQUIRED", "CONNECTION_RECOMMENDED", "ACTION_REQUIRED", "UNSUPPORTED"],
  SYSTEM_IDENTIFICATION: ["ASSESSING", "ACTION_REQUIRED", "UNSUPPORTED"],
  ASSESSING: ["CREDENTIALS_REQUIRED", "CONNECTION_RECOMMENDED", "UNSUPPORTED", "ACTION_REQUIRED"],
  CREDENTIALS_REQUIRED: ["DISCOVERY", "CONNECTION_RECOMMENDED", "TESTING", "CAMERA_MAPPING", "ACTION_REQUIRED"],
  DISCOVERY: ["TESTING", "CAMERA_MAPPING", "ACTION_REQUIRED", "UNSUPPORTED"],
  CONNECTION_RECOMMENDED: ["CREDENTIALS_REQUIRED", "DISCOVERY", "TESTING", "CAMERA_MAPPING", "ACTION_REQUIRED", "UNSUPPORTED"],
  TESTING: ["CAMERA_MAPPING", "READY_TO_ACTIVATE", "DEGRADED", "ACTION_REQUIRED"],
  CAMERA_MAPPING: ["TESTING", "READY_TO_ACTIVATE", "ACTION_REQUIRED"],
  READY_TO_ACTIVATE: ["ACTIVE", "TESTING", "ACTION_REQUIRED", "DEGRADED"],
  ACTIVE: ["DEGRADED", "ACTION_REQUIRED"],
  DEGRADED: ["TESTING", "READY_TO_ACTIVATE", "ACTION_REQUIRED", "ACTIVE"],
  ACTION_REQUIRED: ["SYSTEM_IDENTIFICATION", "ASSESSING", "CREDENTIALS_REQUIRED", "DISCOVERY", "TESTING", "CAMERA_MAPPING", "UNSUPPORTED"],
  UNSUPPORTED: ["SYSTEM_IDENTIFICATION", "ASSESSING", "ACTION_REQUIRED"]
};

export function assertCameraOnboardingTransition(from: CameraOnboardingState, to: CameraOnboardingState) {
  if (from === to || legalTransitions[from].includes(to)) return;
  throw new Error("INVALID_CAMERA_ONBOARDING_TRANSITION");
}

export function onboardingStateForAssessment(assessment: CameraConnectionAssessment, credentialVerified = false): CameraOnboardingState {
  if (assessment.recommendation === "UNSUPPORTED_SYSTEM") return "UNSUPPORTED";
  if (!assessment.productionEligible) {
    return assessment.recommendation === "SOFTWARE_CONNECTOR_REQUIRED" ? "CONNECTION_RECOMMENDED" : "ACTION_REQUIRED";
  }
  if (!credentialVerified && assessment.preferredMethod !== "DEMO") return "CREDENTIALS_REQUIRED";
  return "DISCOVERY";
}

export function credentialStateForAssessment(assessment: CameraConnectionAssessment | null, credentialVerified = false): CameraOnboardingSession["credentialState"] {
  if (!assessment || assessment.preferredMethod === "DEMO") return "NOT_REQUIRED";
  if (credentialVerified) return "VERIFIED";
  if (assessment.recommendation === "SOFTWARE_CONNECTOR_REQUIRED" || assessment.recommendation === "PHYSICAL_GATEWAY_REQUIRED") return "SECURE_ENROLLMENT_REQUIRED";
  return "REQUIRED";
}

export function simpleConnectionReason(recommendation: CameraConnectionRecommendation, reasonCodes: string[]) {
  if (recommendation === "DIRECT_CONNECTION_AVAILABLE") return "נמצא חיבור דיגיטלי מאובטח. אין צורך בחומרה נוספת אם בדיקת ההרשאה והווידאו תעבור.";
  if (recommendation === "SOFTWARE_CONNECTOR_REQUIRED") return "המערכת נמצאת ברשת מקומית, ולכן נדרש Connector יוצא ומאומת לפני חיבור הווידאו.";
  if (recommendation === "PHYSICAL_GATEWAY_REQUIRED") return "למערכת זו אין מסלול דיגיטלי מאובטח מאומת; Gateway מקומי נדרש בגלל מגבלת המקור הקיימת.";
  if (recommendation === "ENTERPRISE_EDGE_RECOMMENDED") return "הגדרת האתר מחייבת עיבוד מקומי ארגוני; החיבור יושלם רק עם Edge מאומת.";
  return reasonCodes.includes("NO_VERIFIED_SAFE_CONNECTION_PATH")
    ? "עדיין לא נמצא מסלול חיבור בטוח. אפשר לעדכן את סוג המערכת או לבקש סיוע." 
    : "נדרשים פרטי מערכת נוספים לפני שאפשר להמליץ על חיבור.";
}

export function isActiveMonitoringSource(source: { status?: string | null; health_status?: string | null; source_mode?: string | null; last_seen_at?: string | null }) {
  return ["connected", "active"].includes(String(source.status))
    && source.health_status === "healthy"
    && ["live", "gateway_test"].includes(String(source.source_mode))
    && Boolean(source.last_seen_at);
}

export function safeOnboardingSession(value: Partial<CameraOnboardingSession>): CameraOnboardingSession {
  const now = new Date().toISOString();
  return {
    contractVersion: cameraOnboardingContractVersion,
    observerSiteId: String(value.observerSiteId || ""),
    diagnosticId: String(value.diagnosticId || ""),
    state: cameraOnboardingStates.includes(value.state as CameraOnboardingState) ? value.state as CameraOnboardingState : "START",
    systemKind: cameraSystemKinds.includes(value.systemKind as CameraSystemKind) ? value.systemKind as CameraSystemKind : "UNKNOWN",
    connectorType: value.connectorType ?? null,
    connectorProvider: value.connectorProvider ?? null,
    pairingMethod: value.pairingMethod ?? null,
    pairingPayloadKind: value.pairingPayloadKind ?? null,
    credentialState: value.credentialState ?? "NOT_REQUIRED",
    assessment: value.assessment ?? null,
    mappings: Array.isArray(value.mappings) ? value.mappings.slice(0, 64).map((item) => ({
      stableChannelReference: String(item.stableChannelReference).slice(0, 80),
      suggestedName: String(item.suggestedName).slice(0, 100),
      locationLabel: item.locationLabel ? String(item.locationLabel).slice(0, 100) : null,
      selected: Boolean(item.selected),
      duplicateCandidate: Boolean(item.duplicateCandidate)
    })) : [],
    sourceId: value.sourceId ?? null,
    lastErrorCategory: value.lastErrorCategory ?? null,
    updatedAt: value.updatedAt ?? now
  };
}
