# Product Admin read reliability — 2026-11-06

## Source and scope

- Source `integration/development`: `edcc6af9b788b584421b02b8b34a29c1dbc9b466`.
- Branch: `codex/product-admin-read-reliability-20261106`.
- Surfaces: `/dashboard/admin`, `/dashboard/admin/kindergartens`, `/dashboard/admin/system-health`.
- No schema, RLS, role, payment, provider activation, Digital Observer core, or Production changes.

## Observed defect and correction

Authenticated read-only QA Admin probes against the isolated Development database identified three failing query contracts: an invalid `documents.status` enum filter (`pending`, `replacement_required`; actual enum uses `pending_review`), the absent `communication_delivery_logs` table (canonical `provider_delivery_logs`), and absent `production_integrations.production_verified_at`. The old pages could convert those failures into apparently valid zero counts or empty results.

The pages now use existing schema fields and bounded reads with exact counts. A missing result, query error, invalid count, or capped result is displayed as unavailable or partial. A verified empty result remains empty. Gardens retains successfully read rows while marking failed related counts unknown. System Health does not infer Production provider readiness from a configured row, mock mode, or missing health metrics. The dashboard delivery counters use the canonical provider log. The shared Admin error banner announces failures to assistive technology.

## Verification

- Focused deterministic Admin read tests: **7/7 PASS**. These are simulated result and rendering checks, not live provider proof.
- UX-17 Admin regression: **9/9 PASS** with base ref pinned to this unit's source SHA. The test's historic default ref is unsuitable for later work because Digital Observer changed in other units after UX-17.
- Typecheck: **PASS**.
- Lint regression baseline: **PASS**, zero new regressions. The repository still contains pre-existing lint findings; direct lint of the affected legacy pages reports them.
- Locked-dependency build: **PASS** after local offline install. Earlier build attempts using a temporary cross-worktree dependency link and then the restricted port sandbox failed for environment reasons; the successful build used local pinned dependencies and permitted temporary internal build operations.
- Migration audit: **PASS**, 259 migration files, no new migration.
- Release contract: **PASS**; no Production mutation.
- Isolated Development QA Admin read contract: **10/10 source queries and count metadata PASS**. Private receipt SHA-256 `ddb2aae81322392ab59ef20c67c6fe11b5fb1ce2253933109e6febbdb9fe4e6d`; receipt contains only source labels and read status, not rows or credentials. This proves the read projections and filters, not all rendered product routes or provider availability.
- Local broad domain gate: **NOT PASS** in this worktree because `DIGITAL_OBSERVER_BENCHMARK_DATASET_CONTRACT.md` is absent here. The source Development candidate's corresponding hosted CI was green; exact feature-candidate CI is still required.
- Local broad security gate: **NOT PASS** under the restricted sandbox because unrelated Digital Observer hardware tests require DiskManagement and a loopback listener. Exact feature-candidate hosted CI and scoped role checks are still required.

## Remaining gates

Review the exact commit diff and security findings; push the scoped feature branch; register the remote commit in the canonical Development ledger; run the six exact-candidate CI gates plus Management tenant context; merge only after all required gates are green; verify the remote Development head and post-merge Admin reads and role boundary. No Production release is authorized.
