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
