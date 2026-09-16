import { ok } from "@/lib/api";
import { getFinancialProviderCapabilities } from "@/lib/domain/financial-provider-capability";

// Public capability projection. It contains no merchant credentials or private
// payment records; checkout remains unavailable until a verified adapter exists.
export async function GET() {
  const capability = getFinancialProviderCapabilities();
  return ok({
    payment_state: capability.payment.state,
    checkout_available: capability.payment.checkoutAvailable,
    live_charges_enabled: capability.payment.liveChargesEnabled,
    invoice_state: capability.invoice.state,
    tax_documents_available: capability.invoice.taxDocumentsAvailable,
    wallets: capability.wallets
  });
}
