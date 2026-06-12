# Financial Operations, Subscription Billing And Revenue Platform

## Purpose

Gan Batuach needs a commercial engine for subscriptions, recurring billing, invoices, renewals, payment recovery and revenue visibility.

This phase prepares the production billing architecture. It does not activate real charging and does not store raw credit card data.

## Subscription Lifecycle

Lifecycle:

1. Kindergarten registers.
2. Manager selects a plan.
3. Checkout session is created.
4. Payment provider returns tokenized payment method.
5. Subscription becomes active.
6. Invoice is generated.
7. Invoice PDF is stored.
8. Invoice is emailed.
9. Renewal is scheduled.
10. Failed payments enter retry and recovery.

Supported plans:

- Monthly
- Annual
- Promotional
- Enterprise
- Pilot trial

Existing tables extended:

- `subscription_plans`
- `kindergarten_subscriptions`
- `subscription_payments`
- `billing_invoices`
- `billing_receipts`
- `subscription_reminders`

## Billing Workflow

The central admin dashboard is:

`/dashboard/admin/billing`

It shows:

- Active subscriptions
- MRR
- ARR
- Active customers
- Trial customers
- Failed payments
- Renewals
- Cancellations
- Invoices
- Receipts
- Refunds
- Credit notes
- Gateway readiness
- Financial audit events

## Payment Workflow

Prepared gateways:

- Tranzila
- Meshulam
- Cardcom
- Pelecard
- Stripe
- Apple Pay readiness
- Google Pay readiness
- Manual billing

Security rules:

- Raw card numbers are never stored.
- Only token references are stored.
- Gateway secrets stay in server environment variables.
- Payment actions are auditable.
- Production charging must be explicitly enabled.

## Invoice Workflow

After a successful payment:

1. Invoice generation job is created.
2. Invoice record is created.
3. PDF is generated.
4. Invoice is stored.
5. Invoice is emailed.
6. Accounting export status is tracked.

Company billing settings are stored in `company_billing_settings`:

- Company name
- VAT number
- Billing email
- Support details
- Invoice footer
- Default currency
- VAT rate

## Failed Payment Recovery

Failed payments are tracked through:

- `subscription_payments`
- `payment_retry_attempts`
- `billing_notifications`

Recovery model:

1. Payment fails.
2. Retry attempt is scheduled.
3. Customer notification is queued.
4. Admin sees the failure in billing center.
5. After retry failure, account moves to manual review or past due.

## Renewal Workflow

Renewals are based on:

- `renewal_date`
- `current_period_end`
- `billing_cycle`
- `auto_renew`

Reminder channels:

- In-app
- Email
- SMS
- WhatsApp
- Push

## Refunds And Credit Notes

Refunds and credits are tracked in `billing_refund_credit_notes`.

Supported types:

- Refund
- Partial refund
- Credit
- Adjustment

Each refund should be approved, processed and audited.

## Network Billing

Multi-kindergarten billing is prepared through:

- `billing_network_accounts`
- `billing_network_gardens`

This supports:

- Network-level billing
- Multiple gardens under one account
- Centralized invoices

## Revenue Reporting

Revenue snapshots are stored in `revenue_snapshots`.

Tracked metrics:

- MRR
- ARR
- Active customers
- Trial customers
- Churned customers
- Failed payments
- Renewals
- Collection rate

## Financial Audit Trail

Financial audit events are stored in `financial_audit_events`.

Tracked events:

- Subscription created
- Plan changed
- Invoice generated
- Payment received
- Payment failed
- Refund issued
- Credit note created
- Subscription cancelled
- Billing settings changed
- Gateway status changed

Audit events must not include raw card data or provider secrets.

## Accounting Readiness

Accounting export readiness is tracked in `accounting_export_batches`.

Prepared exports:

- Invoices
- Payments
- Receipts
- Refunds
- Full bookkeeping export

## Remaining Production Work

- Choose production payment provider.
- Configure server-only provider secrets.
- Implement provider-specific checkout/session endpoints.
- Implement payment webhooks and signature validation.
- Connect PDF invoice generator.
- Connect email delivery for invoices.
- Validate Israeli tax requirements with an accountant.
- Run test payments before production activation.
- Add manager self-service purchase UI actions.
