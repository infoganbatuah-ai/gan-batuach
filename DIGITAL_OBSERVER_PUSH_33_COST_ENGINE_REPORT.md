# DIGITAL OBSERVER — PUSH 33 COST ENGINE REPORT

Date: 2026-09-10

## FINAL STATUS

`PASS ON VERIFIED PR MERGE`

PUSH 33 is canonical `DONE` only after this scoped branch passes required checks, its Pull Request is merged to `main`, and `origin/main` is verified to contain the merge.

## COST ENGINE

`observer-cost-usage-v1` is the one normalized operational usage/cost contract. It supports AI, compute, bandwidth, storage, database/hosting, notification and external-provider resources. Infrastructure cost remains separate from customer price, subscriptions and billing.

## AI / EXECUTION TARGET ATTRIBUTION

The existing portable inference worker can emit a post-result usage observation. The canonical meter validates AI job/result/target identity and preserves tenant, Site, camera, model/version, inference duration, route decision and execution target. PUSH 32 routing behavior is unchanged.

## RATES / RECONCILIATION

Rate catalogs are versioned and effective-dated. QA proved an exact 250 ms inference quantity at a test-only USD 0.000002/ms rate produces USD 0.0005. The same calculated USD 0.0005 reconciled exactly to a deterministic QA provider total with variance 0.

No authorized real provider invoice/rate source was available. Current real provider reconciliation is `NOT AVAILABLE`; current Home monetary cost is `NOT CALCULABLE`, not zero.

## ATTRIBUTION / EMPTY DVR

Direct, provider-reconciled, allocated, estimated and unknown evidence are distinct. Shared-cost allocation QA used 11 expected physical cameras and excluded all six `CHANNEL_EMPTY` slots. Empty-slot camera-specific AI jobs and camera-specific AI cost are both zero.

## ADMIN UI / API / EXPORT

`/digital-observer/admin/costs` and `/api/digital-observer/admin/costs` require the Digital Observer platform-admin claim. The API supports tenant/Site/camera/resource/time filters and authorized CSV export. Missing telemetry/rates render as unavailable rather than fake zero. RLS-protected cost tables are append-oriented and separate from existing billing tables.

## QUALITY / PRIVACY SAFETY

Cost cannot make an ineligible target eligible. Deterministic QA rejects cost optimization unless target eligibility, privacy permission and the quality gate all pass. No automatic routing or Production AI threshold change was introduced.

## CURRENT HOME BASELINE

Read-only duration: **32,064 ms**.

- Topology: 10 physical DVR cameras + 1 Tapo; six empty DVR slots excluded.
- Health: DVR 10/10 progressing; Tapo 1/1 progressing; stuck streams 0; duplicate Site/device/source 0.
- Playback: preserved by read-only test; Product UI was not reopened during this cost run.
- Directly metered sample: 1 real Tapo AI job, `ssd_mobilenet_v1_10`, `EDGE_LOCAL`, queue wait 3 ms, inference 918 ms.
- Monetary cost: unknown; no approved local hardware/electricity/provider rate was available.
- Bandwidth/storage/platform monetary baseline: unknown/not metered in this bounded window.

Preprocessing comparison reused a fresh real-input run: 22 baseline AI jobs versus 11 optimized jobs, 11 avoided, **50% AI-work reduction**; total-system cost reduction is not calculable.

Adaptive sampling comparison reused a fresh real-input run: 33 fixed jobs versus 11 adaptive jobs, 22 avoided, **66.6667% AI-work reduction**; total-system cost reduction is not calculable.

## PROJECTIONS

Linear projection assumptions: source is one bounded 32,064 ms observation over 11 physical cameras; workload shape and provider rates are assumed unchanged; known monetary cost is absent. Results are resource projections, not economics proof:

| Physical cameras | Projected AI jobs | Projected inference ms | Known monetary cost |
|---:|---:|---:|---|
| 10 | 0.909091 | 834.545455 | Not calculable |
| 100 | 9.090909 | 8,345.454545 | Not calculable |
| 1,000 | 90.909091 | 83,454.545455 | Not calculable |

## SECURITY / REGRESSION

Secret-shaped provenance fields are rejected. Tenant filters, idempotency, rate versioning, reconciliation, allocation, anomaly signals and safety guards pass deterministic QA. Full canonical quality/security/build/release gates and the PR checks are the final merge gate. The deferred PUSH 25 billing-role RLS finding remains open and unchanged.

## NORTH-STAR

- Cost-aware optimization: `NOT STARTED → FOUNDATION` because measured cost inputs and safety gate exist, but routing is not automatically cost-optimized.
- Per-camera economics: `NOT STARTED → IMPLEMENTED — NEEDS REAL PROOF` because camera/Site/tenant attribution is executable, while real provider reconciliation and sustained duration are absent.
- Scale economics: `NOT STARTED → FOUNDATION` because labeled 10/100/1,000 resource projection exists, but no scaled real cohort exists.

Counts become 24 DONE + REAL PROOF, 32 IMPLEMENTED — NEEDS REAL PROOF, 63 FOUNDATION, 18 PARTIAL, 52 NOT STARTED, 1 EXTERNAL; total 190 and 0 without canonical owner.

## EXTERNAL EVIDENCE GAPS

- Authorized Vercel/Supabase/provider invoice or usage export.
- Approved local hardware amortization and electricity assumptions.
- Real Cloud inference provider cost (no provider is configured).
- Sustained real pilot/cohort cost and provider reconciliation.

## GIT / PR COMPLETION

Dedicated branch and scoped commit are required. PR number, implementation SHA, merge SHA and verified `origin/main` SHA are recorded in the final response after completion; they are intentionally not guessed in this pre-merge report.

## PUSH 34 READINESS

`YES ON VERIFIED PR MERGE`; otherwise `NO`.
