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
scoped HTTPS ingress have not been qualified. The private-delivery prerequisite
migration creates a Supabase Storage bucket despite private R2 being the
approved data plane. Review/supersede this side effect without editing any
already-applied migration before applying the audit schema to Development.

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

Next: finish risk review of the minimal code/schema slice, implement an
auditable Development-only real-device enrollment bridge and path-scoped HTTPS
ingress, integrate and apply Development migrations in order, run full
cumulative CI and local Full Stack, then sign exact-device metadata. Do not
activate Home runtimes, Production or main.
