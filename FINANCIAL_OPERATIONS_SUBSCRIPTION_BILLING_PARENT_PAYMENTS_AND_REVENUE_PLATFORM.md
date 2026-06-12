# Financial Operations, Subscription Billing, Parent Payments & Revenue Platform

## Purpose

This phase defines Gan Batuach as the financial backbone for two separate money flows:

1. **Gan Batuach subscription revenue**
   Kindergarten pays Gan Batuach an annual SaaS subscription.

2. **Parent tuition payments**
   Parent pays the kindergarten directly through the kindergarten payout account or provider account.

Gan Batuach facilitates parent payment visibility, approval and audit, but does not receive tuition funds.

## Revenue Separation

| Revenue type | Payer | Receiver | Platform role |
| --- | --- | --- | --- |
| Gan Batuach subscription | Kindergarten | Gan Batuach company account | Billing, invoices, renewal, suspension |
| Parent tuition | Parent | Kindergarten account | Facilitation, status tracking, audit |

Rules:

- Raw card data is never stored.
- Payment provider token references may be stored.
- Parent tuition must be routed directly to the kindergarten payout destination.
- Financial audit logs track subscriptions, payment outcomes, discounts, payout changes and revenue separation.

## Kindergarten Subscription Model

Gan Batuach subscription is annual.

Supported statuses:

- `active`
- `pending_payment`
- `suspended`
- `expired`

Existing historical states such as trial/cancelled remain supported for migration compatibility.

Activation flow:

1. Registration
2. Complete profile
3. Select annual plan
4. Pay
5. Activate kindergarten

Before payment, the manager can complete profile, parent setup and child setup. Advanced features remain limited.

## Parent Payment Model

Kindergarten configures:

- Bank account destination, or
- Payment provider account: Meshulam, Tranzila, Cardcom, Pelecard

Parent payment flow:

```text
Parent -> Payment Provider -> Kindergarten Account
```

Never:

```text
Parent -> Gan Batuach -> Kindergarten
```

## Age Group Pricing

The fee group model supports:

- Monthly price
- Annual price
- Enrollment fee
- Activity fee
- Parent billing cycle: monthly or annual
- Parent approval requirement

## Parent Approval Flow

Parent sees:

- Kindergarten details
- Child/payment plan
- Amount
- Billing cycle
- Payment method

Parent approves before payment authorization becomes active.

## Invoices & Receipts

Gan Batuach invoices:

- Generated for kindergarten subscription payments.
- Sent by email when provider/configuration is active.
- Stored for audit and export.

Kindergarten/parent payment records:

- Track invoice and receipt URLs if provided by the kindergarten payment provider.
- Remain separate from Gan Batuach company revenue.

## Audit Coverage

Financial audit events include:

- Subscription created
- Plan changed
- Discount applied
- Payment received
- Payment failed
- Invoice generated
- Refund issued
- Payout configuration changed
- Parent payment authorized
- Parent payment received
- Parent payment failed
- Suspension/reactivation

## Remaining Production Work

- Connect real provider APIs.
- Configure real invoice/PDF provider.
- Add secure UI for payout configuration edits.
- Add parent checkout flow with provider tokenization.
- Add export generation for PDF/Excel/CSV.
- Run accounting/legal review before live payments.
