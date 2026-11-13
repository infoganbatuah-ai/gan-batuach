# Gan Batuach attendance and pickup Product journey — 2026-11-06

## Source and scope

- Source `origin/integration/development`: `b7c1b78d0d438390ad6371b1202a717428c9ddae`.
- Feature branch: `codex/product-attendance-pickup-journey-20261106`.
- Source correction commit: `231fcc2f053f5d166114dd42fc83542316946450`; ledger commit `4fce98bdf73f2215746a9bbf0a4ac95321c03270`; [Development PR #315](https://github.com/infoganbatuah-ai/gan-batuach/pull/315) merged as `c6e703a0eeec7bc7c4baed9189004c18eb601686`.
- Owner/Manager, classroom-scoped Staff, and assigned Parent attendance/pickup presentation and API reliability only. No schema, migration, RLS, grant, Digital Observer core, provider, package, or Production change.
- All mutations in the journey use existing authenticated APIs and the existing `management_child_arrival` / `management_child_release` database functions. Camera/face data are not release authority.

## Findings and correction

1. Parent attendance could treat a permanent child-file ID as a Garden attendance child ID. A non-primary guardian's enrolled Child could also be absent from the Parent pickup page. Both pages now derive only Garden child IDs from the authorized family context, retaining separate Garden contexts for a shared file.
2. A failed or incomplete Garden, Staff, or Parent read could render empty/zero operational state. Required read errors, missing Garden context and bounded-source overflows now show explicit unavailable states and withhold arrival/release actions. The Parent pickup API also refuses a failed scope or event read instead of returning an apparently empty result.
3. Arrival action UI now prevents concurrent duplicate submissions and reports connection failures. Release UI preserves idempotent results, avoids duplicate event rows, reports unavailable event detail honestly, and contains dialog keyboard focus.
4. Gate 3 now includes four focused child-context tests for non-primary guardian, file-ID refusal, deduplication and multi-Garden separation.

## Verification performed on the source branch

- `npm ci --offline`: pinned dependency install passed; no dependency changes.
- `node --experimental-strip-types --test scripts/qa/check-management-attendance-pickup-journey.mjs`: 4/4 passed.
- `npm run qa:ux06-focused`: 8/8 passed.
- `npm run typecheck`: passed.
- `npm run lint:ci`: passed with zero regressions against the repository's recorded legacy baseline; this is not a claim that legacy lint findings are zero.
- `npm run qa:migrations`: passed, 259 existing migrations, no new migration.
- `npm run qa:release-contract`: passed.
- `git diff --check`: passed.
- Production build: passed on the feature branch and the exact PR head in CI, without live activation.
- Existing bounded synthetic API→isolated Development database→Parent read/reload journey: 14 checks passed on source `b7c1b78d0d438390ad6371b1202a717428c9ddae`, including authorized arrival/release, idempotency, revoked contact, Parent/Staff/Garden isolation, and Inspector denial. Private receipt: `/private/tmp/gb-m35-attendance-pickup.json`, SHA-256 `9e12d0d30bc0ddd9c2eaedc3ec8132d917255b18b17d1c97db64b8a233ddca4b`. This baseline journey predates the source correction and does not qualify it as a browser or post-merge pass.

## Exact-head CI and merged Development Product

- PR #315 exact head `4fce98bdf73f2215746a9bbf0a4ac95321c03270`: all six required Digital Observer CI gates plus canonical quality succeeded in run `42291274768`; Management tenant context run `42291274786` and Snyk succeeded. The PR was merged by ancestry to Development `c6e703a0eeec7bc7c4baed9189004c18eb601686`.
- The canonical Product was run at `http://127.0.0.1:3000` with `DEVELOPMENT / INTEGRATION`, `LOCAL_SUPABASE`, and pinned Next.js 16.4.3. An initial local launch used stale Next 16.4.1 and was discarded as evidence; the locked offline install restored 16.4.3 before the qualifying browser journey.
- A bounded synthetic browser→authenticated API→isolated Development DB→reload/read journey completed **29 checks** across Garden B Manager, Staff permission-denial and Parent contexts. It observed one authorized arrival, one human-approved pickup, one pickup event and departure row, idempotent repeated release, wrong-Garden and wrong-classroom denials, Parent isolation, no horizontal overflow, no browser page errors, and final state after reload. Staff B had a classroom assignment but no canonical attendance scope and correctly saw no arrival actions; positive post-merge Staff browser mutation remains unverified. The earlier Staff A API positive belongs to the pre-correction baseline.
- The browser journey used one synthetic Child and one synthetic contact without resetting QA personas. Two bounded attempts completed the actual contact/arrival/release writes before QA-only assertions about the API envelope and page label were corrected. The final 29-check continuation did not repeat the writes and verified their persisted state. Private receipt: `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/product-attendance-pickup-c6e703a0/receipt.json`, SHA-256 `ff20e990009c47d8ae7b10b666832a35b255063813702eb796a17ad8d1153193`. The same private directory holds five final-state screenshots, checksums and a manifest; no pre-state screenshot is claimed.
- Post-merge isolated Development migration drift passed 259/259 at the exact Product SHA. Focused child-context tests passed 4/4 and UX06 domain checks passed 8/8. No new migration, paid dependency, Digital Observer core change, main or Production action occurred.

## Remaining qualification and handoff

- The canonical coordinator selects the next scoped Product or truthful visual correction unit. If positive Staff browser mutation is required, use an existing synthetic Staff identity with canonical attendance scope and an unused authorized Child fixture; do not widen a persona's permission merely for QA.
- Full all-role Product QA, UX-V11 direct owner visual review, invoice-backed all-in ₪15 cost qualification and any Production release gate remain separate and open. This scoped Product journey is not owner visual acceptance or release readiness. No RELEASE-GAP-01.
