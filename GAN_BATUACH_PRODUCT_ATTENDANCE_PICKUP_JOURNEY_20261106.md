# Gan Batuach attendance and pickup Product journey — 2026-11-06

## Source and scope

- Source `origin/integration/development`: `b7c1b78d0d438390ad6371b1202a717428c9ddae`.
- Feature branch: `codex/product-attendance-pickup-journey-20261106`.
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
- Production build: passed on the feature branch; must be repeated by exact-head CI after publication.
- Existing bounded synthetic API→isolated Development database→Parent read/reload journey: 14 checks passed on source `b7c1b78d0d438390ad6371b1202a717428c9ddae`, including authorized arrival/release, idempotency, revoked contact, Parent/Staff/Garden isolation, and Inspector denial. Private receipt: `/private/tmp/gb-m35-attendance-pickup.json`, SHA-256 `9e12d0d30bc0ddd9c2eaedc3ec8132d917255b18b17d1c97db64b8a233ddca4b`. This baseline journey predates the source correction and does not qualify it as a browser or post-merge pass.

## Remaining qualification and handoff

- Run a fresh authenticated browser→API→isolated Development transaction→reload/read journey on the corrected merged Product, with bounded synthetic fixtures and no global reset. Check the wrong-Garden and wrong-classroom denials, Parent isolation, idempotency, and timezone at the Product boundary.
- Publish this branch, register it in the canonical Development ledger, obtain all six required exact-head CI gates and applicable Management/security checks, and merge into `integration/development` only after those gates pass. Verify the remote merged head and rerun relevant post-merge QA.
- This source report is not owner visual acceptance, full Product QA, release readiness, or a Production deployment. Visual UX-V11 and owner review remain separate. Production/main and Digital Observer core remain untouched.
