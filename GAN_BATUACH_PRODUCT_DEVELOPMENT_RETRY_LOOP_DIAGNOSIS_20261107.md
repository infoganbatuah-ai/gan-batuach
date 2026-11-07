# Development retry-loop diagnosis — bounded evidence unit

Task: `GB-PRODUCT-DEVELOPMENT-RETRY-LOOP-DIAGNOSIS-20261107`
Source Development: `2b920cafb578f1720ed660baf26227d998e20e69`
Branch: `codex/development-retry-loop-diagnosis-20261107`
Scope: read-only Inspector due-page diagnosis and QA guard only. No Product, schema, Auth, RLS, provider, package, Digital Observer core, main or Production change.

## Facts and limits of the existing evidence

- The earlier Parent Documents default-Turbopack canonical run timed out before `domcontentloaded` after 90 seconds, with repeated HTTP 200 responses and a generic React Suspense client-render fallback. Its protected redacted report is `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/parent-documents-postmerge-8b9dd0fe/evidence/POST_MERGE_RUNTIME_FAILURE.md` (reported SHA256 `849447e4b071a332a8122b6c63e27de78e21bda1f27d64be19c86ca664d9e8bb`). A separate Webpack diagnostic passed on a later Development SHA; this mode difference is not root-cause proof.
- The first Inspector draft post-merge attempt reported 87 due-page requests in five seconds and zero rendered links despite HTML with seven links. It produced no persisted failure receipt. A later read-only check and the unchanged draft journey passed. The first failure is therefore reported evidence, not a reproducible cause or a permanent fix.
- The installed Next 16.4.3 development guide says routes compile lazily on navigation and Turbopack is the default. React's bundled client source emits the generic Suspense fallback text. Next's installed `fetch-server-response.js` can fall back to browser navigation after a failed RSC fetch. None of those source facts identifies the first failed RSC/server/compiler/Auth/HMR operation in these two incidents.
- `app/layout.tsx` mounts `AppMotionShell` and `DashboardLiveExperience` globally; the latter calls `router.push` only for user link clicks and `router.refresh` after profile save. The Inspector due route is an async server component with scoped Inspector reads. `proxy.ts` calls `updateSession`; local integration strips the service-role key and targets isolated Supabase. Source review did not find a proven unconditional navigation loop. Product source/config is unchanged.
- The old Inspector draft journey runner had a 240-second hard `process.exit` and no pre-request cap or persisted failure receipt. That QA gap is proven independently of the Product root cause.

## Correction and safety contract

New `scripts/qa/inspector-retry-guard.mjs` caps exact Inspector due-page document/RSC requests at six; an attempted seventh is aborted by Playwright routing **before network send**. The standalone `run-inspector-due-retry-diagnostic.mjs` uses one existing synthetic assigned Inspector and only loads the due page. It checks exact Development SHA and `LOCAL_SUPABASE`, performs no save, submit, upload, seed or Product mutation, and records only categorized requests, timestamps, target response statuses and hashed first error/stack. It stores no cookies, tokens, HTML, private query strings or user content. It stops at the first page/console/server error or cap, uses a 35-second work deadline and two bounded three-second cleanup calls within the 45-second diagnostic envelope, and writes a protected exclusive JSON receipt in `finally`. Receipts are limited to 1 MiB. The guard is intentionally scoped to one route; it is not a general browser firewall.

The deterministic guard tests cover mixed document/RSC cap behavior, exact-path and query-string privacy, deadline failure receipt and bounded cleanup. Syntax, tests and diff checks must be recorded with actual results below. A source-level guard test is not proof that the browser or Product behaves correctly.

## Runtime admission and outcome

At preparation, `memory_pressure -Q` reported 60% free and the external volume had more than 1 GiB available, but `uptime` reported 1-minute load above 20 (the card's threshold is at most 8). Port 3000 was free. **The canonical browser attempt was not admitted at that time.** Do not call the symptom fixed or call the route verified from source tests. If a later single safe attempt is admitted, append its exact SHA, resource admission, protected receipt path/hash, request count, exit and cleanup outcome here. If it does not reproduce, use `NOT_REPRODUCED_UNRESOLVED` and retain the earlier incident; do not run a retry chain.

## Validation / preservation

`node --check` passed for the guard and runner. The deterministic `node --test scripts/qa/check-inspector-retry-guard.mjs` passed 4/4. No browser runtime, network provider test or Inspector Product assertion is claimed from these checks. Scope is three new QA files plus this report and canonical Development ledgers. Exact-head CI and Development integration remain pending until recorded below. Full Product/security and release eligibility remain open. No new paid supplier or fixed monthly commitment was added. No QA persona or synthetic data was reset. Digital Observer core diff: 0. Production and main are untouched.
