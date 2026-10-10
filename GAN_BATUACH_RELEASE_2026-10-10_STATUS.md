# Gan Batuach consolidated Production release status — 2026-10-10

## Decision

`BLOCKED BEFORE MAIN — NO PRODUCTION MUTATION`

The owner explicitly authorized a consolidated release on 2026-10-10. The release candidate was frozen, validated and kept separate from PUSH 38. Mandatory live preflight gates still block the merge, migrations and deployment, so `main`, Supabase Production schema and the current Vercel Production deployment remain unchanged.

## Frozen release identity

- Production/main baseline: `8113d0607e4282dc8778540aa58c1502367f4221`.
- Included integration state: `2f8ed2b892201049731a810d118ec15317302692`.
- Exact release branch head after the release-preflight buffer fix: `408a7ef1e8829cc462c673e688b861416df99447`.
- Release branch: `codex/release-20261010-consolidated`.
- PUSH 38 code and its open PRs are excluded and untouched. The six later integration commits are PUSH 38 tracking documents only and are not in this RC.

## Validation completed

- Full local `ci:quality`: PASS.
- Typecheck and lint regression: PASS; no canonical-path lint findings or regressions.
- Domain gate: 30/30 PASS.
- Security and isolation gate: 11/11 PASS.
- Migration health: 244 migrations PASS; no duplicate timestamp or unreviewed destructive migration.
- Release contract: PASS.
- Next.js Production build: PASS; 541 static pages generated.
- Release snapshot preflight: PASS after raising the local Git inventory buffer for this repository's large tracked-file set.
- Integration ledger schema/ancestry check: PASS.

## Live provider evidence

### Vercel

- Pro billing cycle: 2026-10-08 through 2026-11-08.
- Included-credit use observed: USD 0.28 of USD 20.00.
- Current Production commit remains `8113d0607e4282dc8778540aa58c1502367f4221`.
- Required Production names still absent: `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `HEALTHCHECK_SECRET`, `FIELD_HASH_PEPPER`, `FIELD_ENCRYPTION_KEY_VERSION`.

### Supabase

- Organization is on Pro; Spend Cap is enabled.
- Current cycle has not exceeded an included quota.
- Observed usage: egress 4.701/250 GB, Storage 0.011/100 GB, MAU 1/100,000, Realtime messages 0/5,000,000 and Edge Function invocations 0/2,000,000.
- Latest completed physical backup observed: 2026-10-10 00:43:49 UTC. The dashboard explicitly states that database backups do not include Storage objects.
- Production migration history remains at `20260913194000`.
- Seventeen reviewed local migrations are pending Production, including the later `20260928010000_management_staff_candidate_manager_review.sql`. No migration was applied.

## Blocking release gates

1. The last verified credential inventory still has 22 legitimate legacy accounts without independent canonical recovery proof and one synthetic QA record. Migration 12 irreversibly drops the plaintext field and remains prohibited until the recovery/customer-communication workflow is completed and re-audited.
2. The five required Vercel Production settings listed above are not configured.
3. A current physical database backup exists, but a non-destructive provider restore has not been proven and a durable private-Storage recovery target/retention decision is not recorded.
4. The all-in maximum of ₪15 per active paying user is not certified. The live Supabase denominator is only one monthly active user, while the project already has at least the Vercel Pro and Supabase Pro fixed commitments; the active-paying-user denominator and complete supplier invoice allocation remain unavailable.

## Required next action

Keep the RC preserved without opening or merging the consolidated Production PR. Obtain explicit owner decisions for customer recovery communication, the temporary restore cost/alternative, private-Storage recovery retention, and the verified active-paying-user/supplier allocation. Then configure the five zero-fixed-cost Production settings, re-run the live credential and recovery gates, refresh the RC evidence, and only then open the single consolidated PR to `main`.
