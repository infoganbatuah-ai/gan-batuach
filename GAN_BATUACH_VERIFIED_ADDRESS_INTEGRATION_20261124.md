# Gan Batuach verified address integration — Development

## Source and boundary

- Source Development commit: `0725f262fa48b9423d6419916183b8e34549e1e9`.
- Feature branch: `codex/gan-verified-address-20261124`.
- Scope: public garden lead, self-service registration, manager garden application and garden onboarding address entry.
- Digital Observer core, Production, `main`, provider keys and billing settings are unchanged.

## Behavior

- Users explicitly search Places API (New) through two same-origin Management routes. No request is made per keystroke.
- A selected place is resolved for the interface and independently resolved on final write. The final request does not reuse the completed browser session token.
- Server accepts a verified status only for a matching Israeli provider result inside a bounded Israel coordinate region. Full-address verification also requires street and building number. Manual entries remain `unverified`, with no invented coordinates.
- The client shows an explicit unverified state and retains manual entry when the provider is unavailable. Provider errors never turn manual text into verified data.
- A durable database rate limiter enforces eight requests per client per minute and fifty Google Places requests globally per day across autocomplete, selection and final verification. This is an application cap, not a Google billing hard cap.
- The former ten-city/five-street demo selector is removed from user-facing Gan forms.

## Data and permissions

- No migration or new table. Lead qualification, restricted self-service profile metadata and garden onboarding profile data carry verification state and provider place ID where verified. No raw coordinates are persisted by this change.
- Existing garden onboarding authorization, self-service account activation restrictions and role isolation remain in place. Public endpoints use same-origin request checks, bounded JSON and durable rate limits.

## Validation

- TypeScript typecheck: passed locally.
- Focused behavior tests: four passed (valid and invalid place selection, manual/foreign/implausible refusal, shared budget, result bound).
- Existing atomic onboarding and candidate decision/classroom regression tests: passed after updating the candidate test's dependency stub for the new address component.
- Focused ESLint: new Management routes, address component/helper, manager application and self-service registration passed. Broader lint still reports pre-existing baseline findings in legacy files; it is not claimed clean here.
- Full Next.js Webpack build: passed locally on 2026-11-24. The repository's default Turbopack `npm run build` then compiled, typechecked and generated all 561 pages in the permitted local environment, but exited 1 at its final security check because pinned Next.js 16.4.3 is affected by an upstream advisory. Thus the default build gate is **BLOCKED**, not PASS. The first restricted-environment attempt was denied an internal loopback bind; the permitted retry reached the final security check. The feature worktree has an isolated external-drive dependency copy. No dependency was changed in this address unit.
- Local domain gate: passed after completing the feature worktree checkout. All 57 suites passed, zero failed, including the new verified-address suite and existing Management and Digital Observer regressions. Earlier attempts were interrupted or encountered the sparse-checkout missing-file condition; neither was counted as a pass.
- Local lint baseline: first run found one new `no-explicit-any` finding in the changed onboarding route. It was corrected; the isolated rerun passed with zero regressions (4,646 existing errors and 153 existing warnings, versus baseline 5,363 and 213).
- Migration health: passed with 276 existing migrations and no new migration. Release-contract preflight: passed its local clean/dirty/secret/target checks, with no Production mutation.
- Security gate: **BLOCKED** in the existing Digital Observer `push44-ch1-private-media` suite, which requires operator-journal volume ownership. In restricted execution it also lacked DiskManagement and loopback access; the permitted retry cleared those environment denials but returned `CH1_VOLUME_OWNERSHIP_REQUIRED`. This change does not modify that suite or Digital Observer core. The security gate is not claimed PASS.
- Live provider proof, authenticated end-to-end QA, exact-head CI, remote preservation, ledger registration and Development integration remain pending.

## Provider and cost truth

- Google Places pricing and free usage depend on the project's actual billable SKU and cumulative usage. The fifty-per-day application cap is not a hard currency cap and the existing ₪50 billing alert is not a hard stop. No live paid call was made during source tests. A current provider usage/cost and all-in ₪15-per-paying-user preflight remains required before live activation.

## Recovery and next action

Keep this branch and worktree intact. Inspect the exact diff, commit and preserve remotely with a draft PR while the independent Next.js security update and operator-journal ownership gate are resolved by their owners. Before Development merge, verify no Preview deployment is triggered and all required exact-head CI gates are green; run authenticated UI/API verification when an isolated Development backend is available. Production remains untouched.
