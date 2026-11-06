# UXV11 — Platform Admin primary screen

## Scope and source

- Task: `GB-UXV11-PLATFORM-ADMIN-PRIMARY-20261106`.
- Source Development SHA: `2b44a0610834c78a6f8efa656b49ae0a9bfa71fd`.
- Product merge SHA after the three scoped PRs: `a3bb46a0809ad78201e0e24542b7e076c0f5ada3`.
- Branch: `codex/ux-v11-platform-admin-primary-20261106`; source commits: `8244d8bfb54a871ca07677820c756bbd76684839`, `59accd0da678b7522a0bca8de9a77f7c38621a35`, `a725eb039b58891f7d0fca46f5331f9d60aabc65`.
- PRs [#309](https://github.com/infoganbatuah-ai/gan-batuach/pull/309), [#310](https://github.com/infoganbatuah-ai/gan-batuach/pull/310), [#311](https://github.com/infoganbatuah-ai/gan-batuach/pull/311) merged to `integration/development` after six exact-head CI gates, Management context, canonical quality and Snyk passed for each.
- Changed Product paths: `app/dashboard/admin/page.tsx`, `app/styles/ux-v6-true-reference-correction.css`. No schema, dependency, provider activation, Digital Observer core, main or Production change.

## Actual Product result

The primary `/dashboard/admin` now places its title, six live-source KPIs, Garden growth chart, role counts, system/service status, recent activity and three operational tables together in a right-rail Desktop control-center layout. Mobile shows the KPIs as compact cards, then activity and the canonical navigation. The series uses available dated Garden rows and a bounded total count; it never invents monthly Garden or role data. Provider-dependent status stays qualified rather than displaying an unverified active state.

The exact merged Development Product was started by the guarded `npm run dev:integration` launcher at `http://127.0.0.1:3000`, labeled `DEVELOPMENT / INTEGRATION`, with `LOCAL_SUPABASE`; schema drift passed 259/259, `productionAccess: false`. Fresh authenticated synthetic Admin captures at 1440×1024 and 390×844, plus five Mobile Admin destinations, are indexed in private manifest `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/uxv11-admin-final-a3bb46a0/manifest.json` (SHA256 `5dbb98904c51353019f2ee0fc923c5fb15660ab16c798f4728166c81ecf59c5b`). All seven captured routes returned 200, with no browser page errors, 500 responses or horizontal overflow. Some secondary Admin data sources log unavailable query warnings; the interface does not substitute a confirmed healthy value for missing data.

The direct primary reference/actual Desktop and Mobile crops, side-by-sides, 50% overlays and annotated Desktop difference board are indexed in `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/uxv11-admin-final-a3bb46a0/boards/boards-manifest.json` (SHA256 `66cbd4c67b6ef56d2233c1ae281d66dec35d8a22b7042d70af8a887c6a1cdac4`). Reference: `GB_UX_REF_PLATFORM_ADMIN_FULL_PLATFORM.png` (SHA256 `ccdd55229842b15ab15adeb66dcb1232b82641dbb8135ed77092a9e43b6647d6`). These are actual Product screenshots; the reference image is used only in labeled comparison boards.

## Direct visual verdict and remaining work

**`NEEDS_VISUAL_CORRECTION` — external owner acceptance is not claimed.** The primary macro composition and first-viewport density improved substantially, but the actual utility header and sidebar identity differ from the approved panel, the real QA data produces a flatter Garden chart and fewer table rows than the reference, and the Mobile collage panel does not share the Product's full-viewport framing. The visual comparison board makes these differences visible. Fabricating Garden growth, payment, service, camera or person data to imitate the mockup is prohibited. A further scoped decision or correction must reconcile the remaining layout differences while preserving real data and accessibility.

## Validation and limits

- Exact-head CI for PRs #309–#311: all six Digital Observer gates plus Management context, canonical quality and Snyk green. Focused `npm run typecheck` and `git diff --check` passed for the last CSS correction.
- Post-merge canonical Development baseline drift: 259/259, isolated local backend only. No migration added.
- The existing historical UX17 visual source test still expects zero Digital Observer diff against its old UX17 base; it also fails on the unchanged Development baseline and is not evidence of a new regression.
- A separate synthetic browser role-boundary probe was attempted but did not complete after the Admin and Manager navigation stages; it was stopped and is **not** recorded as PASS. CI security/isolation passed; full live role/RLS authorization proof and all-domain Product QA remain separate gates.
- Existing QA personas and data were not reset. No paid dependency or new fixed monthly commitment was added. The invoice-backed all-in ₪15/user calculation was not performed in this UI unit and remains a release gate.
- Digital Observer core diff from source Development to Product merge: **0**. Production and `main` untouched. No RELEASE-GAP-01 work.

Next: coordinator/owner reviews the direct comparison; authorize only a scoped truthful Admin follow-up if the documented visual differences block acceptance. Do not label this domain owner-approved or UX complete.
