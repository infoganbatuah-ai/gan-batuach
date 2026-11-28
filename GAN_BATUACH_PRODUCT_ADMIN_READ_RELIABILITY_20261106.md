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

## Merged Development result

- Source commit `aa9d36199d28963c266cbadbef383572e223f4ea` is preserved on the remote feature branch. [PR #313](https://github.com/infoganbatuah-ai/gan-batuach/pull/313) passed all six exact-head Digital Observer CI gates and canonical quality (run `42280543277`), Management tenant context (run `42280543236`) and Snyk, then merged by ancestry-preserving commit `8a3dc2267c82e01e103e23f0514c5125d0c2756d` to `integration/development` only.
- Exact merged Development drift: **259/259 PASS** against `LOCAL_SUPABASE`, no Production access or new migration.
- Exact merged Development Admin query contracts: **10/10 PASS**. Private post-merge receipt SHA-256 `d9f52007aa7a5d149da21f34ee1cf56386f1384d7b645a5c7f80bd8f1add48b4`.
- Exact merged Development local HTTP check: three Admin routes rendered for the QA Admin; four other role personas rendered zero Admin markup across twelve requests. No Admin data-error alert or HTTP 500 was observed. Private receipt SHA-256 `9265d2bcab98dafd8734f702048c59c7c276f2678dc3e139b53fac0b2c5872b8`.
- The new source adds no paid supplier or fixed monthly commitment. It does not prove invoice-backed all-in cost compliance or external owner visual acceptance. Digital Observer core diff: 0. Production remains untouched.

## Remaining owner-level work

The UXV11 direct visual boards still report `NEEDS_VISUAL_CORRECTION`; this read-reliability unit does not self-approve them. Broader full-role Product, live-provider and supplier-cost release gates remain separate. No `main`, Production or RELEASE-GAP-01 work is authorized here.
