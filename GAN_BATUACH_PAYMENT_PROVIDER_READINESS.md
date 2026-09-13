# GB-M28 payment and invoice provider readiness

Assessment: 2026-09-13. No credential values were read or copied. Production `production_integrations` and `production_webhook_readiness` were inspected read-only. The latter has generic `configured` endpoint rows but no recorded successful webhook test; these rows are not payment verification.

| Provider | Use case | Production configuration / mode | Credentials | Webhook verified | Live charge verified | Wallets | Invoice / receipt | Blockers and review |
|---|---|---|---|---|---|---|---|---|
| Cardcom | Hosted card candidate | `not_configured` / `disabled` | Unverified | No | No | Unverified | Separate issuer required | Confirm merchant account, hosted checkout API, exact signature specification, settlement account and financial/legal allocation of Parent tuition. |
| Meshulam | Hosted card candidate | `not_configured` / `disabled` | Unverified | No | No | Unverified | Separate issuer required | Same provider-specific integration and merchant review. |
| Pelecard | Hosted card candidate | `not_configured` / `disabled` | Unverified | No | No | Unverified | Separate issuer required | Same provider-specific integration and merchant review. |
| Tranzila | Hosted card candidate | `not_configured` / `disabled` | Unverified | No | No | Unverified | Separate issuer required | Same provider-specific integration and merchant review. |
| Stripe future | Future payment candidate | `disabled` | Unverified | No | No | Unverified | Separate issuer required | No active adapter or account verification. |
| Green Invoice | Tax document candidate | `not_configured` / `mock` | Unverified | No | N/A | N/A | No authorized issuance verified | Confirm issuer account, tax-document type, API, webhook and accountant review. |
| iCount | Tax document candidate | `not_configured` / `mock` | Unverified | No | N/A | N/A | No authorized issuance verified | Same. |
| Morning | Tax document candidate | `not_configured` / `mock` | Unverified | No | N/A | N/A | No authorized issuance verified | Same. |
| PayBox | External/manual only if a Garden explicitly supports it | No embedded integration | N/A | No | No embedded charge | N/A | No | Do not display as verified in-app collection. |

`PAYMENT_MODE`/`INVOICE_MODE`, credential presence and generic HMAC transport alone are insufficient for `live`. The app currently registers no provider-specific checkout, account verification, webhook parser, settlement or authorized document adapter. Its canonical capability projection therefore keeps checkout, live charges, wallets and tax documents unavailable. No real payment, refund, invoice or receipt was issued by GB-M28.

The Garden platform subscription merchant is Gan Batuach; Parent tuition is owed to each Garden. Before live tuition collection, the selected provider and legal/accounting owners must verify who is merchant of record, payout routing, refund responsibility and Israeli document issuance. This is an open product/accounting review, not a legal conclusion.
