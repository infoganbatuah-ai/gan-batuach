# Management Admin privacy scope and legal-hold atomicity

Source Development SHA: `591825c7b4a6747aeff23f243dc4a41f34072e64`. This change affects only Management Admin privacy actions and their database transaction boundary. It does not execute deletion, export, anonymization or a legal decision, change Digital Observer core, or touch Production.

## Verified defect

The old Admin server action issued scope deletion, insertion, request update and audit as separate requests, ignoring write errors. In a fresh restored disposable QA database, a synthetic request with one scope item lost that item after an injected insert failure while still becoming `scoped`. The legal-hold action likewise marked the request `blocked_by_legal_hold` with `hold_id: null` after an injected hold-insert failure. Protected baseline log SHA-256: `b5598cc5923fd581fe65525676cd1271490f4b49d5b8fdcc5b632cd49664d29c`. No canonical database was used as a write target.

## Correction

Forward migration `20261114210000_management_privacy_scope_hold_atomicity.sql` adds Admin-only RPCs. Scope replacement locks the Management request; validates a bounded, nonempty item set; replaces only that request's calculated items; computes summary and retention conflicts; updates the request; and inserts immutable audit evidence in one PostgreSQL transaction. Any error rolls the entire action back. Direct authenticated writes to scope items are revoked. The resolver now fails closed when a source count fails or is absent, so unavailable data cannot silently become zero records.

Legal-hold creation locks the request; validates a documented reason; reuses an existing active hold on retry; inserts a hold when needed; updates the request with its real ID; and inserts immutable audit evidence in the same transaction. A database trigger rejects a blocked Management request without a persisted active hold whose metadata references that request. Digital Observer requests retain their separate workflow.

## Isolated QA and limits

The candidate migration applied successfully to a newly restored disposable database from a fresh full local QA dump (SHA-256 `bb62fea4c75a43fe78d6646882dcccbdf1a0a800e1725abf2aff8ce1d1b3e4ce`). A rollback-only ten-case SQL matrix passed: injected scope insert and audit failures preserved old items/status; invalid items preserved old scope; Manager and Parent were denied; successful replacement and repeat did not duplicate items; injected hold insert and audit failures preserved state; a direct phantom blocked status was denied; and an active linked hold, audit and idempotent retry succeeded. Log SHA-256 `333c92762494a2972243486324292e00636d2ab08ba67637607224a12f341ea0`. A separate rollback-only `authenticated` Admin RPC test passed under actual grants and RLS, SHA-256 `c9069e612af9fc54973e45f3e8bc9f99ca787e62569866a263bd2194609ee0b4`. Authenticated direct scope DML was denied; service-role insert remained granted. Both disposable databases were dropped; canonical QA remained 15 Gardens and 27 Auth users. Evidence is under `exports/restricted/gb-privacy-atomicity-20261114/` outside Git.

Typecheck, migration health (270 ordered), lint baseline (zero regressions), release-contract and domain gate (56/56) passed locally. The broad local security gate could not pass two unrelated PUSH44 CH1 tests because this host reported `CH1_VOLUME_OWNERSHIP_REQUIRED`; the remote exact-commit gate remains required. The standard local Turbopack build cannot resolve a symlinked shared `node_modules` in this isolated worktree; an explicit Next Webpack build is being used for local compilation, and remote exact-commit build remains required.

The isolated QA proves database atomicity under injected errors and role checks; it is not a full Product/browser, concurrent multi-session, Production provider, or legal-review proof. The source change adds no paid dependency or fixed monthly commitment. Canonical Development migration application and post-merge Product readback require separate reviewed QA lease and exact-head integration evidence.
