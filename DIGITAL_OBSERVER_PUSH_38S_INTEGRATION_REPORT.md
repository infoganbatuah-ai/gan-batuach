# PUSH 38S — scoped integration handoff (2026-09-19)

Status: **NOT READY FOR LIVE HOME_QA STAGING**. This is a development-only
handoff. No Home camera runtime, main branch, Production service or Production
database was changed.

## Exact accounting

The earlier 123-file figure was stale. The current comparison of
`integration/development` with `codex/push-38q-r2-auth` at `2175a5e9` contains
**124 files**. The machine-readable inventory records path, change kind,
domain, Git blob identity, originating and latest source commit for every file.
There are 32 evidence-only files and 92 non-equivalent files pending a scoped
integration decision. All source files remain on the remotely pushed feature
branch. Nothing was discarded or merged wholesale.

The dependency graph identifies the minimum 15-file *control-plane candidate*.
It is not yet a complete live-device integration: installed OTA/trust/client
modules remain separate, and secure real-device QA enrollment plus narrowly
scoped HTTPS ingress have not been qualified. The original private-delivery
prerequisite migration created an unnecessary Supabase Storage bucket and
collided with a Management migration at timestamp `20260913020000`.

A scoped candidate branch, `codex/push-38s-control-plane` at
`de20a223d5e9babd5c9f2491cfcdff065a119d26`, is remotely preserved. It
cherry-picks the relevant original source commits, retaining their provenance,
and adds an audit-only, unique-version `20260913020001` migration. The original
unapplied migration remains historical source, not selected for Development.
Candidate-only tests: HOME_QA publication 9 cases PASS, R2 authorization core
PASS, remote signer contract 14 cases PASS, trust rotation/revocation PASS,
synthetic OTA PASS, security 7/7 PASS, migration health PASS. Two TypeScript
attempts failed with Node heap exhaustion at 4 GiB and 6 GiB; full build and
cumulative exact-commit CI are **not PASS**. The candidate is not merged into
integration/development. See its own candidate report for exact boundaries.

## Domain regression

The benchmark contract document is tracked and present in the canonical
integration checkout. The feature worktree's sparse-checkout omitted tracked
Markdown; it was explicitly materialized there. The document was not replaced.

The failing throughput assertion compared four workers to one using 400
synthetic jobs with a 2 ms inference delay. On this host the measurement was
210.97 jobs/s (one) versus 291.45 jobs/s (four), a 1.38× gain below the
unchanged 1.5× requirement. The horizontal worker implementation is
byte-identical on source and integration. Its synchronous SQLite queue
bookkeeping dominates a 2 ms timer fixture. PUSH 36's canonical scale fixture
uses 8 ms; the qualification fixture was aligned to that existing workload,
not by lowering the pass threshold. Three repeated 8 ms measurements passed:
85.28→221.60 jobs/s (2.60×), 82.03→246.83 jobs/s (3.01×), and
87.29→211.88 jobs/s (2.43×).
The 2 ms queue-bound limit remains a measured capacity limitation, not a
claim that short jobs scale linearly. The correction is preserved in commit
`2175a5e9273f0f348838b6686cad514d3764aa68`. On that feature worktree, the complete
domain gate subsequently passed 30/30, including the 70.9-second reliability
qualification. This is not a cumulative integration-commit pass; the remaining
security, migration, build and release gates must still pass after integration.

## Safe Development state

The loopback-only cumulative Product answered `/api/health` with HTTP 200 and
Supabase `ok` at 19:51 UTC. Its `/api/development/version` identified SHA
`416125985b0a1cd6b53b0d4ff91aec423e69ec65`, so it is not a verification
of the newer unintegrated 38S source. A POST to the intended
`/api/video-gateway/edge-updates/download` returned HTTP 404 as expected for
an absent route. The QA ingress remains unexposed.

No PUSH 38 migration was applied to Development; Production migration status
is **UNVERIFIED**, not inferred to be `NO`. No exact-device manifests or live
trust registry were issued or installed in this step. The three existing R2
artifact round-trip proofs remain earlier PUSH 38Q evidence, not new tests.
The read-only canonical Development drift check passed at 19:58 UTC:
231 expected/231 accounted for, 227 historical baseline mappings plus four
post-baseline applications, zero missing. It does not imply the pending
PUSH 38 private-delivery or HOME_QA migrations were applied.

An isolated scratch worktree was created to evaluate a narrow integration but
its initial full checkout stopped before completion. That scratch worktree was
removed without a commit or merge; the source branch and canonical integration
checkout remained intact. No candidate code was represented as validated.

During the later candidate review, remote `integration/development` advanced
seven Management commits to `04323b20` and changed both canonical ledgers and
the migration ledger. This creates an overlapping integration handoff. The
PUSH 38S ledger update is preserved on its own branch, not pushed over the
newer remote integration head. A semantic reconciliation with the Management
changes is required before any cumulative merge or database application.

Next: resolve candidate TypeScript/CI memory or obtain exact-head CI proof,
implement an auditable public-key-only Development enrollment bridge and
path-scoped HTTPS ingress, then integrate and apply Development migrations in
order, verify drift and local Full Stack, and only then sign exact-device
metadata. The current Product issues HMAC sessions after Ed25519 proof; the
Development launcher strips the Production HMAC secret, so copying that secret
or accepting a caller-supplied device ID is not an acceptable shortcut. Do not
activate Home runtimes, Production or main.
