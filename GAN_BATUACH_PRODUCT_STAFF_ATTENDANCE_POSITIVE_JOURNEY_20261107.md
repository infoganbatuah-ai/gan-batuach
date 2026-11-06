# GB-PRODUCT-STAFF-ATTENDANCE-POSITIVE-JOURNEY-20261107

## Scope and source

- Exact Product under test: `origin/integration/development` at `e9b5f20a79775f9d0c201e11db03ac9511720733`, launched only from the canonical integration worktree with `npm run dev:integration`.
- Runtime: pinned Next.js `16.4.3`, `DEVELOPMENT / INTEGRATION`, `LOCAL_SUPABASE`, `http://127.0.0.1:3000`. The development version endpoint returned the same SHA and `production: false`.
- Feature branch: `codex/product-staff-attendance-positive-20261107`. This unit changes no Product source, API, schema, RLS, grants, provider, dependency, camera, Digital Observer core, `main`, or Production path. It records a positive Product journey and its limits.

## Synthetic fixture and bounded execution

The existing QA identities supplied active Staff A (`…301`) in Garden A (`…601`) with active attendance teaching scope and Classroom A1 assignment. Existing Child A already had a current-day attendance row and was left untouched. A guarded, isolated Development transaction created exactly four dedicated QA fixture rows: one child file, Child `00000000-0000-4000-8000-00000000a712`, active Garden A enrollment, and Classroom A1 assignment. It did not alter Staff permissions or globally reset QA data. Independent read-only inspection verified those prerequisites and zero attendance rows for this child on `2026-11-07` before the first browser click.

Private scripts, synthetic-only receipts, screenshots and runtime logs remain outside Git in `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/product-staff-attendance-positive-20261107/`. The admission check found load1 `5.38` on eight cores, memory free `61%`, more than 1 TiB free on the external volume, port 3000 free, and separate Digital Observer paths. The one canonical Development server was stopped after verification. No Production credentials, provider actions, camera commands or paid dependency were used.

## Observed positive journey

The Staff A browser loaded `/dashboard/staff/children-attendance` and clicked **צ׳ק אין** once for the dedicated child. The existing API returned HTTP `200`, `data.attendance.status = present`, `idempotent = false`, and attendance ID `2b99fdef-dbae-40ca-ad08-65ae31c48a2a`. Read-only SQL confirmed one persisted Staff-authored attendance row and one canonical arrival audit event.

The first QA script stopped **after** the successful click because it mistakenly expected an `ok` envelope field that this API does not return. It did not retry the arrival. A second, read-only diagnostic had earlier corrected a `networkidle` wait that was unsuitable for the current Next route; neither issue required Product source changes. A continuation verified the saved first response and DB state before making any further request.

The continuation passed 20 scoped checks: Staff reload showed the same child present with no second arrival button; Manager A saw the same present child on `/dashboard/garden/attendance`; Staff A attempts for a foreign Garden and foreign Classroom were denied; Staff B without attendance scope had no arrival action and its API attempt was denied. One deliberate repeat request returned `idempotent = true`; attendance and audit counts remained one. The browser reported zero page errors. The checks establish this positive local Product path and the named denials; they do not imply exhaustive role, data, or security coverage.

## Evidence and limitations

- Private receipt: `receipt.json`, SHA-256 `5ece6b6d5901fe7991caceef66162c3a96fb4c496d431d6406f967fd1a36d31b`.
- QA script SHA-256: first-click `browser-positive.mjs` `a45d8f969d64eed70ed536b1cd854405addae2147d8a063b9ef31307fbb75c23`; continuation `browser-positive-continuation.mjs` `98a4a9e896776a4c9a9e6dd77c4c8deff2742154d14192dfd7ce8ebe144c4bb9`.
- Browser screenshots: `staff-before-arrival.png` SHA-256 `6028f71ab848bbc1e94eda9a3defe40591d463e9f6d7445e2113b4f95b159329`; `staff-after-arrival-desktop.png` `7de9177e88fa68d2db311b722237d74208f8b5ad44ec9101bef275c4df3e2e04`; `manager-after-staff-arrival-desktop.png` `454f90293ec951531814e8288a11c2843b8dacb88c59de0c848e5f94505a7532`.
- The receipt lists all 20 assertions, exact runtime identity, synthetic row count, attendance ID, and no Production access. Evidence is private; no credentials or personal Production data are committed.
- This is one synthetic Staff positive journey, not all-role Product QA, external owner visual acceptance, live-provider readiness, or invoice-backed proof of the all-in ₪15 ceiling. No new fixed monthly commitment was introduced by this unit. Digital Observer core diff: `0`.

## Preservation and next gate

The evidence-only branch must be committed, pushed, registered in the canonical Development ledger, reviewed through the six exact-head CI gates and any required Management/scanner checks, and merged into `integration/development` by one integration owner. After merge, verify the remote head and clean canonical Development worktree. `main`, Production, and RELEASE-GAP-01 remain out of scope. The coordinator may then assess the separate Parent selected-child documents candidate by provenance before any integration; its unrelated Digital Observer ancestry must not be merged wholesale.
