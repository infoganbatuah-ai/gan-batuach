# Broken Navigation Repair Report

RESCUE 1 audit date: 2026-06-23

## Scanner Method

Static internal `href` values were scanned in `app` and `components` and compared against served app routes. Dynamic template routes were reviewed separately where the scanner cannot infer `[slug]`.

## Fixed

| Source | Old target | New target | Reason |
| --- | --- | --- | --- |
| Admin commercial launch page | `/COMMERCIAL_LAUNCH_READINESS_AND_SALES_OPERATIONS_PLATFORM.md` | `/dashboard/admin/docs/COMMERCIAL_LAUNCH_READINESS_AND_SALES_OPERATIONS_PLATFORM` | Root Markdown file was not a served app route. |
| Admin legal review page | `/GAN_BATUACH_LEGAL_ARCHITECTURE_PACK.md` | `/dashboard/admin/docs/GAN_BATUACH_LEGAL_ARCHITECTURE_PACK` | Internal documentation viewer added. |
| Admin legal review page | `/CAMERA_COMPLIANCE_EXTERNAL_REVIEW_PACK.md` | `/dashboard/admin/docs/CAMERA_COMPLIANCE_EXTERNAL_REVIEW_PACK` | Internal documentation viewer added. |
| Admin legal review page | `/DPIA_EXTERNAL_REVIEW_PACK.md` | `/dashboard/admin/docs/DPIA_EXTERNAL_REVIEW_PACK` | Internal documentation viewer added. |
| Admin legal review page | `/DATA_PROCESSING_AGREEMENT_READINESS.md` | `/dashboard/admin/docs/DATA_PROCESSING_AGREEMENT_READINESS` | Internal documentation viewer added. |
| Admin mobile release page | `/APP_STORE_GOOGLE_PLAY_SUBMISSION_READINESS.md` | `/dashboard/admin/docs/APP_STORE_GOOGLE_PLAY_SUBMISSION_READINESS` | Internal documentation viewer added. |
| Admin security review page | `/PENETRATION_TEST_RULES_OF_ENGAGEMENT.md` | `/dashboard/admin/docs/PENETRATION_TEST_RULES_OF_ENGAGEMENT` | Internal documentation viewer added. |
| Admin security review page | `/SECURITY_ARCHITECTURE_EXTERNAL_REVIEW_PACK.md` | `/dashboard/admin/docs/SECURITY_ARCHITECTURE_EXTERNAL_REVIEW_PACK` | Internal documentation viewer added. |
| Admin security review page | `/EXTERNAL_SECURITY_REVIEW_CHECKLIST.md` | `/dashboard/admin/docs/EXTERNAL_SECURITY_REVIEW_CHECKLIST` | Internal documentation viewer added. |
| Admin security review page | `/EXTERNAL_PENETRATION_TEST_AND_SECURITY_REVIEW_PREPARATION.md` | `/dashboard/admin/docs/EXTERNAL_PENETRATION_TEST_AND_SECURITY_REVIEW_PREPARATION` | Internal documentation viewer added. |
| Admin communications page | `/dashboard/admin/search` | `/dashboard/admin/users` | `/dashboard/admin/search` is not a served page route. |

## New Support Route

`/dashboard/admin/docs/[slug]`

- Requires admin role.
- Uses a whitelist of known internal readiness documents.
- Reads Markdown server-side and renders it in the authenticated admin app.
- Does not expose private repository files as direct public URLs.

## Remaining Notes

The static scanner still reports the new `/dashboard/admin/docs/...` URLs because they resolve through `[slug]`. Those are intentional and now served by the new dynamic route.

