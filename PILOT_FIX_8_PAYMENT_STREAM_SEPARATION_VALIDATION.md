# PILOT FIX 8 - Payment Stream Separation Validation

Date: 2026-07-05

## Required Streams

| Stream | Direction | Status | Validation result |
|---|---|---|---|
| Gan Batuach subscription | Kindergarten/business -> Gan Batuach | Manual/readiness | Separated in manager subscription UI and admin subscription manager. |
| Parent tuition | Parent -> kindergarten/provider account | Readiness/manual | Child payment API and parent payment screens treat this separately from platform subscription. |
| Digital Observer subscription | Digital Observer customer -> Digital Observer product account | Readiness/manual | Separate observer billing surfaces exist and must remain product-scoped. |

## Reviewed Surfaces

- Manager subscription page labels Gan Batuach subscription as separate from parent tuition.
- Admin subscription manager describes manual billing and future provider adapters.
- Parent payment flow is tied to child tuition/payment states and does not create platform subscription revenue.
- Digital Observer billing/admin surfaces are separate from Gan Batuach parent tuition.
- Webhook handler only applies subscription side effects to `gan_batuach_subscription` events.

## Risks

| Risk | Severity | Status |
|---|---:|---|
| Parent tuition counted as Gan Batuach MRR | high | No current evidence in reviewed UI; keep revenue dashboards explicit. |
| Gan Batuach subscription shown as parent tuition | high | Not found in reviewed manager subscription UI. |
| Digital Observer billing mixed with kindergarten subscription | high | Not found in reviewed separation docs; still needs real provider mapping verification. |
| Invoice label mismatch | medium | Manual/legal accounting review required before live invoices. |

## Result

Payment stream separation is acceptable for manual/sandbox pilot prep. It is not approved for live billing until provider mappings, invoice labels, and revenue reporting are manually verified in the real environment.
