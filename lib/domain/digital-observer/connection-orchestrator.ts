import { z } from "zod";
import { capabilityFreshness, connectivityFamily, connectivityFamilyIds, connectivityRegistryVersion, connectionStrategies, type ConnectionStrategy } from "./connectivity-registry";

export const connectionOrchestratorVersion = "connection-orchestrator-v2";
export const connectionPlanRequestSchema = z.object({
  action: z.literal("plan"),
  observer_site_id: z.string().uuid(),
  family: z.enum(connectivityFamilyIds),
  computer_available: z.enum(["YES", "NO", "UNKNOWN"]).default("UNKNOWN"),
  effort: z.object({ product_actions: z.number().int().min(0).max(1000),
    technical_actions: z.number().int().min(0).max(1000), elapsed_ms: z.number().int().min(0).max(7 * 86400000) }).strict().optional()
}).strict();

// Server-owned adapter results only. Never accept these proof flags from a
// browser or from aggregate learning. A registry describes capability, not access.
export type PersistentPathProof = {
  strategy: ConnectionStrategy;
  implemented: boolean;
  authorized: boolean;
  secureTransport: boolean;
  recoverable: boolean;
  survivesSetupDeviceDeparture: boolean;
  requiresCustomerService: boolean;
  requiresInboundExposure: boolean;
  privacyAllowed: boolean;
  measuredStability: number | null;
};
const zeroInstallStrategies = new Set<ConnectionStrategy>(["VENDOR_CLOUD", "ACCOUNT_LINK", "VENDOR_P2P", "DIRECT_SECURE", "MOBILE_PROVISIONED", "ONVIF_DIRECT", "RTSP_DIRECT"]);
export function isZeroInstallPath(proof: PersistentPathProof) {
  return zeroInstallStrategies.has(proof.strategy) && proof.implemented && proof.authorized
    && proof.secureTransport && proof.recoverable && proof.survivesSetupDeviceDeparture
    && !proof.requiresCustomerService && !proof.requiresInboundExposure && proof.privacyAllowed;
}
export function rankPersistentPaths(paths: readonly PersistentPathProof[]) {
  return paths.filter(isZeroInstallPath).map(path => ({
    strategy: path.strategy,
    // Usability order is deterministic; bounded stability is a tie-breaker.
    score: 1000 - connectionStrategies.indexOf(path.strategy) * 20
      + (Number.isFinite(path.measuredStability) ? Math.max(0, Math.min(1, path.measuredStability!)) * 10 : 0)
  })).sort((a, b) => b.score - a.score || a.strategy.localeCompare(b.strategy));
}

export type ConnectionPlan = {
  version: string;
  registryVersion: string;
  family: typeof connectivityFamilyIds[number];
  phase: "DISCOVER" | "IDENTIFY" | "CONNECT";
  classification: "ZERO_INSTALL_AVAILABLE" | "MOBILE_ASSISTED_ZERO_INSTALL_AVAILABLE" | "LOCAL_BRIDGE_REQUIRED" | "ZERO_INSTALL_INTEGRATION_NOT_YET_AVAILABLE" | "IDENTIFICATION_REQUIRED";
  preferredStrategy: ConnectionStrategy | null;
  zeroInstall: boolean;
  persistentMonitoringVerified: boolean;
  hardwareReason: "NO_ALWAYS_ON_HOST_FOR_VERIFIED_LOCAL_PATH" | null;
  candidates: { strategy: ConnectionStrategy; score: number }[];
  reason: string;
  nextAction: "CONNECT" | "DISCOVER" | "IDENTIFY" | "ASK_COMPUTER" | "INSTALL_CONNECTOR" | "LOCAL_DEVICE_OPTION" | "INTEGRATION_PENDING";
  limitations: string[];
  mobile: { supported: boolean; temporaryOnly: true; permissionText: string };
  technicalCapability: "PERSISTENT_PATH_VERIFIED" | "DOCUMENTED_REMOTE_CAPABILITY" | "LOCAL_CAPABILITY_ONLY" | "UNKNOWN";
  productCoverage: "PERSISTENT_ADAPTER_AVAILABLE" | "REMOTE_INTEGRATION_MISSING" | "LOCAL_ADAPTER_AVAILABLE" | "IDENTIFICATION_REQUIRED";
  observedSuccess: "PERSISTENCE_PROOF" | "NOT_VERIFIED_FOR_THIS_SYSTEM";
  requirementBasis: "NONE" | "CURRENT_SUPPORTED_PATH" | "NO_SUITABLE_HOST";
};

export function planCameraConnection(input: {
  family: typeof connectivityFamilyIds[number];
  computerAvailable: "YES" | "NO" | "UNKNOWN";
  connectorOnline: boolean;
  nativeDiscoveryAvailable: boolean;
  persistentPaths: readonly PersistentPathProof[];
}, now = new Date()): ConnectionPlan {
  const family = connectivityFamily(input.family);
  const candidates = rankPersistentPaths(input.persistentPaths);
  const preferred = candidates[0]?.strategy ?? null;
  const plan: ConnectionPlan = {
    version: connectionOrchestratorVersion, registryVersion: connectivityRegistryVersion,
    family: family.id, phase: "IDENTIFY", classification: "IDENTIFICATION_REQUIRED",
    preferredStrategy: null, zeroInstall: false, persistentMonitoringVerified: false,
    hardwareReason: null, candidates, reason: "נזהה את המערכת לפי המצלמות שנמצאו, שם האפליקציה או הדגם שעל המכשיר.",
    nextAction: "IDENTIFY", limitations: [...family.limitations],
    technicalCapability: "UNKNOWN", productCoverage: "IDENTIFICATION_REQUIRED", observedSuccess: "NOT_VERIFIED_FOR_THIS_SYSTEM", requirementBasis: "NONE",
    mobile: { supported: input.nativeDiscoveryAvailable, temporaryOnly: true,
      permissionText: "נדרשת גישה זמנית לרשת המקומית כדי למצוא את המצלמות שלך." }
  };
  if (preferred) return {
    ...plan, phase: "CONNECT", classification: preferred === "MOBILE_PROVISIONED" ? "MOBILE_ASSISTED_ZERO_INSTALL_AVAILABLE" : "ZERO_INSTALL_AVAILABLE",
    preferredStrategy: preferred, zeroInstall: true, persistentMonitoringVerified: true,
    technicalCapability: "PERSISTENT_PATH_VERIFIED", productCoverage: "PERSISTENT_ADAPTER_AVAILABLE", observedSuccess: "PERSISTENCE_PROOF",
    nextAction: "CONNECT", reason: "נמצא מסלול מאובטח ומתמשך, ללא התקנת רכיב נוסף בבית. נבדוק את המצלמות לפני ההפעלה."
  };
  const documentedRemote = family.capabilities.some(capability =>
    ["VENDOR_API", "P2P", "MOBILE_PROVISIONING"].includes(capability.kind)
      && ["VERIFIED_REAL", "VERIFIED_VENDOR_DOCUMENTATION", "INTEGRATION_TESTED"].includes(capability.evidence)
      && !capability.adapterImplemented && capabilityFreshness(capability, now) === "CURRENT");
  if (documentedRemote) return { ...plan, classification: "ZERO_INSTALL_INTEGRATION_NOT_YET_AVAILABLE",
    technicalCapability: "DOCUMENTED_REMOTE_CAPABILITY", productCoverage: "REMOTE_INTEGRATION_MISSING",
    nextAction: "INTEGRATION_PENDING", reason: "ליצרן יש מסלול חיבור מתועד, אך החיבור שלו לתצפיתן עדיין אינו זמין. אין בכך הוכחה שנדרשת רכישת חומרה." };
  if (family.id === "unknown" || family.id === "generic-recorder") {
    return { ...plan, phase: input.connectorOnline || input.nativeDiscoveryAvailable ? "DISCOVER" : "IDENTIFY",
      nextAction: input.connectorOnline || input.nativeDiscoveryAvailable ? "DISCOVER" : "IDENTIFY" };
  }
  const localCandidate = family.capabilities.some(capability => ["RTSP", "ONVIF"].includes(capability.kind)
    && capability.adapterImplemented && capability.evidence !== "UNKNOWN" && capability.evidence !== "INFERRED"
    && capabilityFreshness(capability, now) === "CURRENT");
  if (!localCandidate) return { ...plan, limitations: [...plan.limitations, "CAPABILITY_REVALIDATION_REQUIRED"] };
  plan.classification = "LOCAL_BRIDGE_REQUIRED";
  plan.technicalCapability = "LOCAL_CAPABILITY_ONLY";
  plan.productCoverage = "LOCAL_ADAPTER_AVAILABLE";
  plan.requirementBasis = "CURRENT_SUPPORTED_PATH";
  plan.reason = "נבדקו אפשרויות החיבור ללא התקנה. למערכת הזו אומת אצלנו כרגע מסלול מקומי בלבד, שדורש רכיב חיבור במקום. אין בכך קביעה שהמצלמה אינה מסוגלת להתחבר בדרך אחרת.";
  plan.limitations.push("LOCAL_REQUIREMENT_IS_FOR_VERIFIED_PATHS_ONLY");
  if (input.connectorOnline) return { ...plan, preferredStrategy: "SOFTWARE_CONNECTOR", nextAction: "DISCOVER", phase: "DISCOVER" };
  if (input.computerAvailable === "UNKNOWN") return { ...plan, nextAction: "ASK_COMPUTER" };
  if (input.computerAvailable === "YES") return { ...plan, preferredStrategy: "SOFTWARE_CONNECTOR", nextAction: "INSTALL_CONNECTOR" };
  return { ...plan, preferredStrategy: "PHYSICAL_GATEWAY", nextAction: "LOCAL_DEVICE_OPTION",
    requirementBasis: "NO_SUITABLE_HOST",
    hardwareReason: "NO_ALWAYS_ON_HOST_FOR_VERIFIED_LOCAL_PATH" };
}

export const connectionFailureCategories = ["CREDENTIALS_INVALID", "DEVICE_OFFLINE", "NETWORK_UNREACHABLE", "VENDOR_AUTH_EXPIRED", "LOCAL_PERMISSION_DENIED", "UNSUPPORTED_FIRMWARE", "NO_PERSISTENT_PATH", "CONNECTOR_REQUIRED", "INSTALLER_UNAVAILABLE", "ENROLLMENT_EXPIRED", "DISCOVERY_FAILED", "INTEGRATION_MISSING", "MANUAL_SUPPORT_REQUIRED", "UNKNOWN"] as const;
export function connectionRecovery(category: typeof connectionFailureCategories[number]) {
  const instructions = {
    CREDENTIALS_INVALID: "בדקו את חשבון המצלמה והזינו את הפרטים המעודכנים בטופס המאובטח.",
    DEVICE_OFFLINE: "בדקו שהמצלמה מחוברת לחשמל ופועלת באפליקציה שלה.",
    NETWORK_UNREACHABLE: "בדקו שהמצלמה ורכיב החיבור מחוברים לאותה רשת.",
    VENDOR_AUTH_EXPIRED: "חברו מחדש את חשבון היצרן.",
    LOCAL_PERMISSION_DENIED: "אפשרו גישה זמנית לרשת המקומית בהגדרות האפליקציה, ונסו שוב.",
    UNSUPPORTED_FIRMWARE: "הגרסה הזו טרם אומתה. ניתן לשמור את הבדיקה להמשך התאמה.",
    NO_PERSISTENT_PATH: "נדרש מסלול שיישאר זמין גם כשהטלפון יוצא מהבית.",
    CONNECTOR_REQUIRED: "נדרש רכיב חיבור קטן על מחשב שנשאר זמין במקום.",
    INSTALLER_UNAVAILABLE: "חבילת ההתקנה למחשב הזה אינה זמינה כרגע. אפשר לנסות שוב או לשמור מספר בדיקה לתמיכה.",
    ENROLLMENT_EXPIRED: "בקשת החיבור פגה. התחילו בקשה חדשה מאותו אשף.",
    DISCOVERY_FAILED: "רכיב החיבור פעיל, אך טרם נמצאו מצלמות. בדקו שהמצלמות פועלות באותה רשת ונסו שוב.",
    INTEGRATION_MISSING: "החיבור ליצרן עדיין אינו זמין במוצר. ניתן לשמור בקשת התאמה.",
    MANUAL_SUPPORT_REQUIRED: "לא הצלחנו להשלים את החיבור אוטומטית. אפשר לפנות לתמיכה עם מספר הבדיקה.",
    UNKNOWN: "לא הצלחנו להשלים את הבדיקה. נסו שוב; אם התקלה נמשכת, השתמשו במספר הבדיקה."
  };
  return { category, message: instructions[category], automaticRetries: ["DEVICE_OFFLINE", "NETWORK_UNREACHABLE"].includes(category) ? 2 : 0 };
}
