export type DigitalObserverServiceState = "disabled" | "mock" | "readiness" | "sandbox";

const placeholderMarkers = [
  "your-domain",
  "example.com",
  "replace-with",
  "changeme",
  "placeholder",
  "dummy",
  "test-key"
];

function configuredValue(name: string) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  return Boolean(value) && !placeholderMarkers.some((marker) => value.includes(marker));
}

function configured(...names: string[]) {
  return names.every(configuredValue);
}

export function getDigitalObserverServiceReadiness() {
  const cameraMode = String(process.env.DIGITAL_OBSERVER_CAMERA_MODE ?? process.env.CAMERA_GATEWAY_MODE ?? "disabled").toLowerCase();
  const aiMode = String(process.env.DIGITAL_OBSERVER_AI_MODE ?? process.env.AI_PROVIDER_MODE ?? "mock").toLowerCase();
  const gatewayConfigured = !["", "disabled", "mock"].includes(cameraMode) && (
    configured("DIGITAL_OBSERVER_CAMERA_GATEWAY_URL", "VIDEO_GATEWAY_SIGNING_SECRET")
    || configured("VIDEO_GATEWAY_URL", "VIDEO_GATEWAY_SIGNING_SECRET")
  );
  const aiConfigured = !["", "disabled", "mock"].includes(aiMode) && configured("AI_INFERENCE_ENDPOINT", "AI_PROVIDER_API_KEY");
  const addressConfigured = configuredValue("GOOGLE_MAPS_PLATFORM_API_KEY") || configuredValue("GOOGLE_MAPS_API_KEY");
  const paymentConfigured = configuredValue("DIGITAL_OBSERVER_PAYMENT_PROVIDER")
    && configured("PAYMENT_API_KEY", "PAYMENT_WEBHOOK_SECRET");
  const invoiceConfigured = configuredValue("DIGITAL_OBSERVER_INVOICE_PROVIDER")
    && configured("INVOICE_API_KEY", "INVOICE_WEBHOOK_SECRET");

  return {
    product: "digital_observer" as const,
    address: { state: addressConfigured ? "readiness" as const : "disabled" as const, configured: addressConfigured, verifiedAddressRequiredForEmergency: true },
    cameraGateway: { state: gatewayConfigured ? "readiness" as const : "disabled" as const, configured: gatewayConfigured, live: false },
    ai: { state: aiConfigured ? "sandbox" as const : "mock" as const, configured: aiConfigured, shadowOnly: true, humanReviewRequired: true, live: false },
    billing: { state: paymentConfigured ? "sandbox" as const : "mock" as const, configured: paymentConfigured, chargeEnabled: false, sourceKey: "digital_observer" },
    invoices: { state: invoiceConfigured ? "sandbox" as const : "mock" as const, configured: invoiceConfigured, productionIssueEnabled: false, sourceKey: "digital_observer" },
    notifications: {
      inApp: "mock" as DigitalObserverServiceState,
      push: "mock" as DigitalObserverServiceState,
      email: "mock" as DigitalObserverServiceState,
      sms: "disabled" as DigitalObserverServiceState,
      whatsapp: "disabled" as DigitalObserverServiceState,
      voice: "disabled" as DigitalObserverServiceState,
      productionSendEnabled: false,
      sourceKey: "digital_observer"
    },
    ganBatuachIntegration: { state: "disabled" as const, active: false, auditedApiRequired: true }
  };
}
