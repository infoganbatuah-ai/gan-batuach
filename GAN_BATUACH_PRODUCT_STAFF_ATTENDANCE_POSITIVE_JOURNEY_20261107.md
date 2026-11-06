# GB-PRODUCT-STAFF-ATTENDANCE-POSITIVE-JOURNEY-20261107

## Scope and source

- Source Development SHA: `e9b5f20a79775f9d0c201e11db03ac9511720733`.
- Branch: `codex/product-staff-attendance-positive-20261107`.
- Isolated local Product: canonical `integration/development` worktree only; expected backend `LOCAL_SUPABASE` and `DEVELOPMENT / INTEGRATION` label.
- Product change: none prepared. This unit is a focused positive Staff browser journey; source correction is permitted only for an observed defect.
- No migration, RLS/grant, package, provider, camera, Digital Observer core, `main`, or Production change.

## Preflight and synthetic data

The canonical QA fixture already provides active Staff A (`…301`) with an active Garden A employment, attendance teaching scope, and Classroom A1 assignment. Existing Child A (`…901`) already had a current-day attendance row, so it was preserved without reset or correction. A guarded transaction through the repository's isolated `local-database.mjs` helper created one dedicated synthetic child file, Child `00000000-0000-4000-8000-00000000a712`, active enrollment, and current Classroom A1 assignment: four QA fixture rows total. It did not alter Staff permissions or any existing QA record. A separate read-only query confirmed the child has the existing Staff scope, an active enrollment, and zero current-day attendance rows before the browser attempt.

Private bounded QA scripts and eventual receipt are under `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/product-staff-attendance-positive-20261107/`. They assert the exact Development SHA, isolated database identity, and no Production access before exercising the UI. No credentials are printed or committed.

The fixture transaction completed against the guarded isolated DB: `fixtureRows=4`, `attendanceRows=0`. The independent read-only audit confirmed active profile/employment/teaching scope, Staff and Child classroom assignments, active enrollment, and no current-day attendance. The prepared scripts passed `node --check` but **were not executed as a browser journey**. SHA-256: `fixture-audit.mjs` `ec8e1d22eb2c60f3d3b18d4d7d4964ec0b652b8cbbe48d4810a76577db6b7bd5`; `provision-synthetic-child.mjs` `36203d97b0ceeeb1b9cee39d72f2553cac3efbe49457bf98df78c85ea2db9a6b`; `browser-positive.mjs` `40423048fdc06d9497e5494f9e0fd3fc32664659e2c6509c946ea0311e8febac`.

## Focused Product verification

PENDING_RESOURCE_ADMISSION. Runtime admission requires load1 ≤ 8, memory free ≥ 20%, external volume ≥ 1 GiB, and no direct conflict with Digital Observer work. Memory was 42–53% free and the external volume had >1 TiB free; port 3000 was free and the worktree/evidence paths are disjoint from DO. Load1 was 12.37, 11.00, 13.14, briefly 7.84/7.50 during preparation, then rose to 22.88, 18.13, 16.62, 21.19 during bounded admission rechecks. No Next/Development server was started at high load. The planned journey is Staff A UI arrival → existing API → one canonical attendance row attributed to Staff A → Staff reload → Manager A read of the same child; narrow foreign-Garden, foreign-Classroom, and no-attendance-scope denials; one idempotent repeat with no extra attendance row. The Product RPC also writes its canonical audit/notification side effects; "one" refers to the attendance row, not total DB writes.

Recovery point: after a newly observed resource change and a fresh admission check, launch only the canonical `npm run dev:integration` on exact `e9b5f20a79775f9d0c201e11db03ac9511720733` with external-volume temporary/cache paths and pinned Next.js. Run the private `browser-positive.mjs` once; it refuses any pre-existing current-day attendance for the dedicated child. If an attempt fails after the click, inspect `arrival-attempt.json`, `arrival-response.json` if present, and the DB read-only before any retry. Do not reprovision the child or duplicate the arrival. On success, stop the server, record the private receipt checksum, finish the report and ledger entry, commit/push, require exact-head CI, merge to Development, and verify the final head. No source change should be invented if the Product journey works.

Do not treat prepared scripts, fixture provisioning, or prior Parent/Manager evidence as a positive Staff browser PASS. Do not rerun the prior 29-check journey. All-in ₪15 per active paying user, broad all-role Product QA, and owner visual acceptance remain unverified.
