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
};

export const digitalObserverConnectors: Record<DigitalObserverConnectorType, DigitalObserverConnectorDescriptor> = {
  ip_camera: { type: "ip_camera", label: "מצלמת IP", description: "מצלמה ברשת המקומית דרך Gateway מאובטח", transport: "gateway", credentialLocation: "server_secret_store", previewRequiresGateway: true, liveRequiresGateway: true },
  nvr: { type: "nvr", label: "NVR", description: "מערכת הקלטה מרובת מצלמות", transport: "gateway", credentialLocation: "server_secret_store", previewRequiresGateway: true, liveRequiresGateway: true },
  dvr: { type: "dvr", label: "DVR", description: "מערכת הקלטה אנלוגית או היברידית", transport: "gateway", credentialLocation: "server_secret_store", previewRequiresGateway: true, liveRequiresGateway: true },
  rtsp: { type: "rtsp", label: "RTSP", description: "זרם RTSP שנקלט ומומר בצד השרת", transport: "gateway", credentialLocation: "server_secret_store", previewRequiresGateway: true, liveRequiresGateway: true },
  onvif: { type: "onvif", label: "ONVIF", description: "איתור ותאימות מצלמות דרך Gateway", transport: "gateway", credentialLocation: "server_secret_store", previewRequiresGateway: true, liveRequiresGateway: true },
  cloud_provider: { type: "cloud_provider", label: "ספק ענן", description: "חיבור דרך API של ספק מורשה", transport: "provider_api", credentialLocation: "server_secret_store", previewRequiresGateway: true, liveRequiresGateway: true },
  edge_gateway: { type: "edge_gateway", label: "Edge Gateway", description: "מחבר מקומי לרשת שאינה חשופה לאינטרנט", transport: "gateway", credentialLocation: "server_secret_store", previewRequiresGateway: true, liveRequiresGateway: true },
  demo: { type: "demo", label: "מצלמת הדמיה", description: "בדיקת ממשק בטוחה ללא מקור וידאו או סיסמה", transport: "synthetic", credentialLocation: "not_required", previewRequiresGateway: false, liveRequiresGateway: false }
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
      credentials_saved: false,
      gateway_required: connector.liveRequiresGateway,
      connector_transport: connector.transport
    },
    metadata: {
      product: "digital_observer",
      synthetic_only: synthetic,
      credentials_required_server_side: connector.credentialLocation === "server_secret_store",
      no_live_claim: true
    }
  };
}
