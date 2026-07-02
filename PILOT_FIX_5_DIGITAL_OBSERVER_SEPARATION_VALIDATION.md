# PILOT FIX 5 - Digital Observer Separation Validation

Date: 2026-07-03

## Routes And APIs Reviewed

- `/digital-observer`
- `/digital-observer/dashboard`
- `/digital-observer/onboarding`
- `/digital-observer/sites`
- `/digital-observer/cameras`
- `/digital-observer/billing`
- `/dashboard/admin/digital-observer`
- `/dashboard/admin/digital-observer-separation`
- `/dashboard/admin/digital-observer-paid-beta`
- `/api/digital-observer/leads`
- Digital Observer domain modules under `lib/domain/digital-observer-product.ts`

## Result

| Check | Result | Notes |
|---|---|---|
| Public Digital Observer routes build | PASS | standalone product pages exist |
| Dashboard routes build | PASS | DO dashboard/site/billing surfaces exist |
| Admin separation surfaces exist | PASS | separation/readiness pages exist |
| Billing stream wording | STATIC_PASS | Digital Observer billing pages reference separate beta/customer billing |
| Cross-product RLS proof | MANUAL_REQUIRED | requires synthetic DO site + Gan Batuach parent/garden fixtures |
| Broader AI/camera capability leak proof | MANUAL_REQUIRED | requires policy/capability fixture testing |

## Required Negative Tests

- Gan Batuach parent cannot access Digital Observer site data.
- Digital Observer customer/admin cannot access kindergarten child records.
- Digital Observer billing does not appear as Gan Batuach subscription.
- Digital Observer camera/AI status does not enable Gan Batuach parent camera/AI features.

## Status

Digital Observer separation status: **READY_FOR_SYNTHETIC_E2E_WITH_MANUAL_RLS_REQUIRED**
