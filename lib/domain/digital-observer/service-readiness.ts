export type DigitalObserverServiceState = "disabled" | "mock" | "readiness" | "sandbox";

function configured(...names: string[]) {
  return names.every((name) => Boolean(process.env[name]));
}

export function getDigitalObserverServiceReadiness() {
  const gatewayConfigured = configured("DIGITAL_OBSERVER_CAMERA_GATEWAY_URL", "VIDEO_GATEWAY_SIGNING_SECRET")
    || configured("VIDEO_GATEWAY_URL", "VIDEO_GATEWAY_SIGNING_SECRET");
  const aiConfigured = configured("AI_INFERENCE_ENDPOINT", "AI_PROVIDER_API_KEY");
  const paymentConfigured = Boolean(process.env.DIGITAL_OBSERVER_PAYMENT_PROVIDER)
    && configured("PAYMENT_API_KEY", "PAYMENT_WEBHOOK_SECRET");
  const invoiceConfigured = Boolean(process.env.DIGITAL_OBSERVER_INVOICE_PROVIDER)
    && configured("INVOICE_API_KEY", "INVOICE_WEBHOOK_SECRET");

  return {
    product: "digital_observer" as const,
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
