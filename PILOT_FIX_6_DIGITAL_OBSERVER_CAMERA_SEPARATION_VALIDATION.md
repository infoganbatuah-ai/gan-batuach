# PILOT FIX 6 - Digital Observer Camera Separation Validation

Date: 2026-07-03

## Expected Separation

- Digital Observer sites/cameras are scoped separately.
- Gan Batuach kindergarten cameras are scoped separately.
- Billing/customer context is separate.
- Product mode/feature flags are separate.
- Viewing tokens include garden/site context and must be product-scoped.
- Audit logs should include product context where shared infrastructure is used.

## Static Result

| Check | Result |
|---|---|
| Digital Observer routes exist separately | PASS |
| Gan Batuach dashboard camera routes exist separately | PASS |
| Digital Observer billing pages exist separately | PASS |
| Shared camera core supports `garden_id`, `kindergarten_id`, `observer_site_id` patterns | PARTIAL |
| Runtime cross-product denial | MANUAL_REQUIRED |
| Product context in every camera audit | PARTIAL |

## Required Negative Tests

- Digital Observer user cannot access Gan Batuach cameras unless explicitly authorized and scoped.
- Gan Batuach parent cannot access Digital Observer cameras.
- Digital Observer live flags cannot enable Gan Batuach parent viewing.

Status: **SEPARATION_STATICALLY_PRESENT / MANUAL_RLS_REQUIRED**
