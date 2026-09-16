import { getIntegrationSafetyModes, getProviderMissingConfiguration } from "@/lib/domain/provider-integration-safety";
import { evaluateFinancialProviderEvidence, type FinancialProviderState } from "@/lib/domain/financial-provider-policy";

type FinancialCapability = {
  provider: string | null;
  state: FinancialProviderState;
  requestedMode: string;
  credentialsPresent: boolean;
  webhookSecretPresent: boolean;
  providerAdapterVerified: boolean;
  webhookVerified: boolean;
  checkoutAvailable: boolean;
  liveChargesEnabled: boolean;
  taxDocumentsAvailable: boolean;
  blockers: string[];
};

// No provider-specific checkout, signature or tax-document adapter is registered.
// Environment variables are configuration hints, never proof of an active merchant account.
export function getFinancialProviderCapabilities(): { payment: FinancialCapability; invoice: FinancialCapability; wallets: { applePay: false; googlePay: false; payBoxEmbedded: false } } {
  const modes = getIntegrationSafetyModes();
  const paymentProvider = process.env.PAYMENT_PROVIDER || null;
  const invoiceProvider = process.env.INVOICE_PROVIDER || null;
  const paymentCredentialsPresent = Boolean(paymentProvider) && getProviderMissingConfiguration("payment", paymentProvider).length === 0;
  const invoiceCredentialsPresent = Boolean(invoiceProvider) && getProviderMissingConfiguration("invoice", invoiceProvider).length === 0;
  const capability = (provider: string | null, requestedMode: string, credentialsPresent: boolean, webhookSecretPresent: boolean, kind: "payment" | "invoice"): FinancialCapability => {
    const evidence = evaluateFinancialProviderEvidence({ requestedMode, providerConfigured: Boolean(provider), credentialsPresent,
      credentialsVerified: false, webhookSecretPresent, webhookVerified: false, adapterVerified: false, liveEnabled: false });
    return {
      provider,
      state: evidence.state,
      requestedMode,
      credentialsPresent,
      webhookSecretPresent,
      providerAdapterVerified: false,
      webhookVerified: false,
      checkoutAvailable: evidence.checkoutAvailable,
      liveChargesEnabled: evidence.liveChargesEnabled,
      taxDocumentsAvailable: false,
      blockers: [
        `${kind}_provider_adapter_not_verified`,
        ...(webhookSecretPresent ? [] : [`${kind}_webhook_secret_missing`]),
        ...(credentialsPresent ? [] : [`${kind}_credentials_missing`])
      ]
    };
  };

  return {
    payment: capability(paymentProvider, modes.payment, paymentCredentialsPresent, Boolean(process.env.PAYMENT_WEBHOOK_SECRET), "payment"),
    invoice: capability(invoiceProvider, modes.invoice, invoiceCredentialsPresent, Boolean(process.env.INVOICE_WEBHOOK_SECRET), "invoice"),
    wallets: { applePay: false, googlePay: false, payBoxEmbedded: false }
  };
}
