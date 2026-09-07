# GB-M02 — Management tenant authority foundation

## Scope and sequencing

The final roadmap was derived and saved in `GAN_BATUACH_MANAGEMENT_ROADMAP.md` before implementation, using GB-M01 at `dc50fca02db7d866c7ecc5416940da34e764b033`. GB-M02 is the identity/tenant authority foundation, not the earlier conversation's Observer boundary implementation. Astra was recommended for this security-sensitive change ([official model guidance](https://developers.openai.com/api/docs/models)).

## Result

A shared Management operational guard now authenticates the actor, verifies profile identity, requires an explicitly active manager/owner, and asks the session-scoped `can_manage_garden` RPC before allowing any operational work. A stored `profile.garden_id` is insufficient by itself. No service-role client participates in the authorization decision.

- Missing session/profile or mismatched actor: HTTP 401.
- Unsupported role, inactive/unknown activation state, missing garden or denied DB decision: HTTP 403.
- Authentication/database lookup errors or unavailable RPC: HTTP 503, without private error details.
- Only boolean `true` without a database error grants access.

This closes the bypass of existing database authority by manager/owner-only operational routes. It does not replace the legacy authority's schema: current SQL still uses the active profile garden. Canonical family linking, owner memberships and employment authority are later roadmap work. Target-record checks remain necessary, and existing checks were preserved.

## Adoption inventory

All 18 manager/owner-only operational garden POST handlers use the guard before payload processing or operational effects:

- child-payments
- child-transfer-requests/[id]
- children/[id]/approve
- children/[id]/status
- communication
- create-staff
- enrollment-requests/[id]
- fee-groups
- leads/[id]/convert
- leads/[id]/status
- parent-invitations
- payout-configuration
- pickup-events
- staff-applications/[id]
- staff-openings
- staff/[id]/approve
- subscription
- subscription/sandbox-checkout

## Preserved and deferred boundaries

No changes to Digital Observer core, shared auth/API/Supabase/RLS helpers, migrations, provider activation, billing amounts or UI. The original checkout and its in-progress changes were left intact; implementation uses a clean branch from the committed audit.

`manager-application` remains the pre-garden bootstrap; `create-parent` remains a rejecting compatibility endpoint. Mixed-role `attendance-action`, `day-close`, `children/[id]/operations`, admin-capable `face-match-results` and `observer-journal` retain their existing policies. Their role/candidate semantics need the GB-M03 review; this report does not claim all 195 Management APIs have been migrated. The existing parent/child IDOR, phone ownership and non-atomic lifecycle findings remain open under their roadmap pushes.

## Validation

Validated with `npm ci` from the unchanged committed lockfile, Node 24.16.0 (within package.json's supported range), Next.js 16.3.2. CI uses the repository's Node 22 setting.

| Check | Result |
|---|---|
| Management executable guard/route suite | PASS, 44 tests, including 22 denial cases exercised against each of 18 real route handlers with mocked infrastructure; two successful writes reject payload-selected gardens |
| Typecheck | PASS |
| Lint baseline | PASS, 5,363 baseline errors / 213 warnings; 0 regressions; canonical scope 0 errors / 0 warnings |
| Management contract QA | PASS, 20/20 static contract checks |
| Domain regression | PASS, 18/18 suites |
| Security regression | PASS, 7/7 suites in committed config |
| Migration health | PASS, 190 committed migrations; existing duplicate descriptive-name warning |
| Production build | PASS, locked Next.js 16.3.2 production build, live activation disabled |
| Protected paths / patch whitespace | PASS, no changes in Observer core, shared authority helpers, migrations or lockfile |

The initial dependency symlink was rejected by Turbopack; it was replaced with a local locked installation. The sandboxed build then stalled and was interrupted; the required build was retried outside the sandbox. No source workaround was introduced.

## Audit environment reconciliation

The clean audit commit contains 190 migrations and 7 configured security suites. The original worktree contains an additional untracked Observer migration and modified CI config, consistent with GB-M01 reporting 191 and 9. Its lint snapshot also differs: the committed baseline is 5,363 errors / 213 warnings, versus GB-M01's 5,355 / 213. Preserve the accepted audit and report the exact tested baseline instead of importing unrelated work.

Live authenticated database/RLS/IDOR probes are not represented by mocked route tests. No live test environment is configured in this isolated checkout. Production verification remains open, including the role-boundary probe blocked during GB-M01. No production data or schema was modified.
