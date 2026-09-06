export const digitalObserverConnectorTypes = [
  "ip_camera",
  "nvr",
  "dvr",
  "rtsp",
  "onvif",
  "cloud_provider",
  "edge_gateway",
  "demo"
] as const;

export type DigitalObserverConnectorType = (typeof digitalObserverConnectorTypes)[number];

export type DigitalObserverConnectorDescriptor = {
  type: DigitalObserverConnectorType;
  label: string;
  description: string;
  transport: "gateway" | "provider_api" | "synthetic";
  credentialLocation: "server_secret_store" | "not_required";
  previewRequiresGateway: boolean;
  liveRequiresGateway: boolean;
  localBridgeMode: "none" | "software_or_gateway" | "physical_gateway";
};

export const digitalObserverConnectors: Record<DigitalObserverConnectorType, DigitalObserverConnectorDescriptor> = {
  ip_camera: { type: "ip_camera", label: "מצלמת IP", description: "מצלמה קיימת בחיבור ישיר מאובטח או דרך מחבר מקומי", transport: "gateway", credentialLocation: "server_secret_store", previewRequiresGateway: false, liveRequiresGateway: false, localBridgeMode: "software_or_gateway" },
  nvr: { type: "nvr", label: "NVR", description: "מערכת הקלטה קיימת; החיבור הדיגיטלי הבטוח נבדק לפני בחירת חומרה", transport: "gateway", credentialLocation: "server_secret_store", previewRequiresGateway: false, liveRequiresGateway: false, localBridgeMode: "software_or_gateway" },
  dvr: { type: "dvr", label: "DVR", description: "מערכת הקלטה קיימת; Gateway פיזי נבחר רק אם אין מסלול דיגיטלי בטוח", transport: "gateway", credentialLocation: "server_secret_store", previewRequiresGateway: false, liveRequiresGateway: false, localBridgeMode: "software_or_gateway" },
  rtsp: { type: "rtsp", label: "RTSP", description: "זרם תקני דרך חיבור מאובטח או מחבר תוכנה יוצא", transport: "gateway", credentialLocation: "server_secret_store", previewRequiresGateway: false, liveRequiresGateway: false, localBridgeMode: "software_or_gateway" },
  onvif: { type: "onvif", label: "ONVIF", description: "איתור תקני ברשת דרך חיבור ישיר או מחבר תוכנה מקומי", transport: "gateway", credentialLocation: "server_secret_store", previewRequiresGateway: false, liveRequiresGateway: false, localBridgeMode: "software_or_gateway" },
  cloud_provider: { type: "cloud_provider", label: "ספק ענן", description: "חיבור דיגיטלי דרך API מורשה של הספק", transport: "provider_api", credentialLocation: "server_secret_store", previewRequiresGateway: false, liveRequiresGateway: false, localBridgeMode: "none" },
  edge_gateway: { type: "edge_gateway", label: "Gateway מקומי", description: "חריג מאושר למערכת סגורה, ותיקה או בעלת דרישת עיבוד מקומי", transport: "gateway", credentialLocation: "server_secret_store", previewRequiresGateway: true, liveRequiresGateway: true, localBridgeMode: "physical_gateway" },
  demo: { type: "demo", label: "מצלמת הדמיה", description: "בדיקת ממשק בטוחה ללא מקור וידאו או סיסמה", transport: "synthetic", credentialLocation: "not_required", previewRequiresGateway: false, liveRequiresGateway: false, localBridgeMode: "none" }
};

export function getDigitalObserverConnector(type: DigitalObserverConnectorType) {
  return digitalObserverConnectors[type];
}

export function buildDigitalObserverCameraReadiness(type: DigitalObserverConnectorType) {
  const connector = getDigitalObserverConnector(type);
  const synthetic = connector.transport === "synthetic";
  return {
    sourceMode: synthetic ? "demo" as const : "readiness" as const,
    status: synthetic ? "ready_to_test" as const : "draft" as const,
    healthStatus: "unknown" as const,
    capabilities: {
      preview: synthetic,
      live_view: false,
      event_clips: false,
      // Demo cameras expose the complete control contract so onboarding and
      // automated-guard flows can be verified without touching hardware.
      ...(synthetic ? { ptz: true, twoWayAudio: true, siren: true, lighting: true } : {}),
      credentials_saved: false,
      gateway_required: connector.liveRequiresGateway,
      local_bridge_mode: connector.localBridgeMode,
      connector_transport: connector.transport
    },
    metadata: {
      product: "digital_observer",
      synthetic_only: synthetic,
      credentials_required_server_side: connector.credentialLocation === "server_secret_store",
      digital_first_assessment_required: !synthetic,
      physical_gateway_is_exception: true,
      no_live_claim: true
    }
  };
}
