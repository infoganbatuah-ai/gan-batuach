# TECHQA 1 Navigation And Link Audit

Date: 2026-06-27

## Static Link Scan

Static scan scope:

- `app/**/*.ts`
- `app/**/*.tsx`
- `components/**/*.ts`
- `components/**/*.tsx`
- `lib/**/*.ts`
- `lib/**/*.tsx`

Patterns checked:

- static `href="/..."`
- static `router.push("/...")`
- static `router.replace("/...")`
- static `redirect("/...")`

Results:

- Static internal references scanned: 1,037.
- App page routes known from filesystem: 296.
- Broken static internal links found: 0.
- Initial scan produced false positives for `/`; those were route-normalization artifacts, not broken links.

## Route Health By Journey

| Journey | Result |
|---|---|
| Public homepage to `/app` | Route exists and builds. |
| `/app` to login/register | Routes exist and build. |
| Register role cards to role-specific entries | `/app/register/parent`, `/kindergarten`, `/staff`, `/inspector` exist and build. |
| Parent dashboard links | Parent route group builds; dynamic child/report routes require authenticated data for manual QA. |
| Manager dashboard links | Manager route group builds; dynamic child/inspection routes require authenticated data for manual QA. |
| Staff dashboard links | Staff route group builds. |
| Inspector dashboard links | Inspector route group builds. |
| Admin dashboard links | Admin route group builds. |
| Digital Observer links | Public, onboarding, dashboard, site and billing routes build. |

## Broken Links Fixed

None. No safe static broken link was found in this pass.

## Known Follow-Up

| Classification | Finding | Recommendation |
|---|---|---|
| manual_review_required | Dynamic links with runtime IDs cannot be fully verified by static route matching. | Validate with seeded authenticated users in SECQA/TECHQA follow-up. |
| medium | `npm run lint` does not run because `next lint` is no longer accepted by the installed Next.js CLI. | Add a flat ESLint config and replace the script with an ESLint command in a dedicated tooling cleanup. |
| manual_review_required | Download/export/report/PDF routes build but require real scoped data to verify all runtime files exist. | Validate in provider/storage QA with seeded documents and reports. |

