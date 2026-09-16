export type FinancialProviderState = "not_configured" | "disabled" | "sandbox" | "verified_test" | "live";

export type FinancialProviderEvidence = {
  requestedMode: string;
  providerConfigured: boolean;
  credentialsPresent: boolean;
  credentialsVerified: boolean;
  webhookSecretPresent: boolean;
  webhookVerified: boolean;
  adapterVerified: boolean;
  liveEnabled: boolean;
};

export function evaluateFinancialProviderEvidence(evidence: FinancialProviderEvidence) {
  const verified = evidence.providerConfigured && evidence.credentialsPresent && evidence.credentialsVerified &&
    evidence.webhookSecretPresent && evidence.webhookVerified && evidence.adapterVerified;
  const state: FinancialProviderState = evidence.requestedMode === "disabled" ? "disabled"
    : verified && ["live", "production"].includes(evidence.requestedMode) && evidence.liveEnabled ? "live"
    : verified && ["sandbox", "test"].includes(evidence.requestedMode) ? "verified_test"
    : evidence.providerConfigured && evidence.credentialsPresent && ["sandbox", "test", "mock"].includes(evidence.requestedMode) ? "sandbox"
    : "not_configured";
  return { state, checkoutAvailable: state === "live" || state === "verified_test", liveChargesEnabled: state === "live" };
}

export function normalizeFinancialEventType(eventType: string) {
  const types: Record<string, string> = {
    payment_success: "payment_succeeded",
    payment_failed: "payment_failed",
    subscription_cancelled: "subscription_cancelled",
    invoice_created: "invoice_issued",
    invoice_failed: "invoice_generation_failed",
    receipt_created: "receipt_issued"
  };
  return types[eventType] ?? "unsupported";
}
