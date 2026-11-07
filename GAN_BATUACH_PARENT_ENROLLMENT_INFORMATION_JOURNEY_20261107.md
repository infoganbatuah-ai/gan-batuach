# Parent enrollment information journey — 2026-11-07

Task: `GB-PRODUCT-PARENT-ENROLLMENT-INFORMATION-JOURNEY-20261107`
Source Development SHA: `cefccf88c19053066effaba348674a1296496eeb`
Branch: `codex/parent-enrollment-information-20261107`

## Scope and behavior

The existing Parent discovery form submits one enrollment request for an authorized permanent Child file to an accepting Garden. The Garden manager can review and request information through the existing scoped decision endpoint. The Parent dashboard now displays the specific information request in the selected Child context, accepts a response, and refreshes to show `resubmitted` and the sent answer. No approval, reservation, payment, activation, external delivery, or new product domain is introduced. A retry for the same active Child/Garden request remains idempotent in the existing database function. The Parent API list and Garden reservation lookup are bounded to 100 rows.

The Garden request page previously crashed when optional service-role enrichment was unavailable in safe Feature QA. It now retains the RLS-scoped request and permitted decision controls, displaying an explicit notice when enrichment cannot run. No service-role credential is injected into Feature QA and no authorization boundary is relaxed. Full Child/Parent details require the existing server-only enrichment configuration in the canonical environment; masked fallback is a documented limitation.

The scoped request surfaces render the canonical `not_requested` payment state in Hebrew. The QA screenshot helper waits for the actual request card and settled UI before saving evidence; an earlier functional PASS receipt contained transient loading-frame Mobile images and those images are not used as visual proof.

Synthetic QA prerequisite: Parent A's existing authorized Child file ending `4901` has a birth date, no active enrollment, and one already-submitted request in Garden A. A read-only preflight found that every otherwise eligible local synthetic Child already had a request in this Garden; an initial runner attempt timed out while compiling the version route, before any action. The resumed path therefore uses the existing `submitted` request, as authorized by the coordinator's fallback. It does not prove a fresh Parent UI submission in this run; it does test the same-request API retry. The Garden is accepting, public, and has matching active classrooms. The QA runner requires exact local Development identity and exact feature commit, allows only the intended UI actions, checks foreign Parent/Manager, Staff and guest known-ID denial, and records redacted evidence outside Git. Failed runs require state inspection before resume.

The guarded run reached `information_required` after the Manager's review and information request, then stopped waiting for the Parent dashboard while it compiled. A read-only check confirmed the Parent form and note render on the exact feature build. The runner can resume from that verified state without repeating either Manager transition.

## Verification and remaining gates

- Source/Next guidance: relevant installed Next route-handler, forms and refresh guides inspected at the pinned Development dependency version.
- Focused static/domain, typecheck, lint baseline, build and guarded local journey: pending final execution/recording.
- Local Development data/role verification: pending guarded run; no Production access authorized.
- Security review: existing guardian Child access, Garden context, database role checks and local RLS remain authoritative; no schema or authorization changes.
- Cost: no new dependency/provider, no paid service or fixed monthly commitment.
- Digital Observer core: no changes expected; verify focused diff before publication.
- Publication and cumulative Product verification: pending exact-candidate CI, PR merge to `integration/development`, remote-head verification, and postmerge no-write readback. This report is not evidence of Product-wide or Production readiness.

## Final scoped Development verification

Feature source `9b2f077582794322a53a7398f137599cba7e38a5` was pushed and ancestry-merged by [PR #351](https://github.com/infoganbatuah-ai/gan-batuach/pull/351) to exact Development SHA `4176554589cf5b06118bc1a852d9d2d6d39a5063`. All six exact-head Digital Observer CI gates, Canonical quality, Management context and Snyk passed. Local typecheck, baseline lint, build, focused lifecycle 7/7, domain 54/54, migration health 260/260 and release contract passed. The full local security gate was blocked by the unrelated external PUSH44 operator-journal volume ownership requirement; its exact-head GitHub CI gate passed. No volume permissions were changed.

The guarded local existing-request journey passed 19/19 (private receipt SHA256 `9d2f93091e2607a37ab23343e395b0fa90faa98f4dbc26df69c3b52acab79827`). Exact final feature-head no-write capture receipt SHA256 `c753ea1bf9274bc2f9e20527cf97d7579386ad43d52ab4ed6c94eb3b7d511747`. The exact merged canonical Product, `DEVELOPMENT / INTEGRATION` at loopback 3000 and `LOCAL_SUPABASE`, passed 7/7 no-write role/data checks with four fresh Parent/Manager 1440×1024 and 390×844 captures. The request remained `resubmitted` and database state was byte-unchanged; private receipt SHA256 `d19a6908658b60e6231a55e602a28c3cb53e762ddcdbb3de632e46e712318f15`. Isolated Development migration drift passed 260/260. The owned Product server stopped after capture.

The pre-existing one-request fallback did not exercise fresh Parent UI submission. Optional Manager service enrichment was unavailable only in safe Feature QA; scoped request and actions remained visible. This is scoped synthetic Product evidence, not Product-wide, Production, external owner visual, live provider, full security or invoice-backed cost qualification. New fixed monthly commitment: ₪0. Digital Observer core diff: 0. Main/Production unchanged. The earlier pending wording above describes the stage before these final checks.
