# Gan Batuach Management Release Runbook

This runbook is preparation only. It grants no authority to release. Production work begins only after a new explicit owner instruction.

## Preconditions

- Freeze one exact `integration/development` release-candidate SHA and enumerate included/excluded ledger units.
- All protected checks green for the exact candidate.
- The blockers in `GAN_BATUACH_MANAGEMENT_GB_M39_RELEASE_BLOCKERS.md` are closed with evidence.
- Current Production migration history re-read; exactly the reviewed 16 migrations remain pending.
- Recent provider backup is verified and an isolated restore path exists for database **and Storage objects**.
- Credential recovery/rotation is prepared for the 23 accounts whose recoverable temporary secrets will be erased.
- Current invoices, paying-user denominator and forecast satisfy the project cost gate.
- Owner explicitly approves the maintenance/release window and exact candidate.

## Release sequence

1. Record base `main`, candidate SHA, migration hashes, Vercel project and rollback deployment.
2. Announce the controlled maintenance window; stop conflicting release work.
3. Verify backup timestamps, integrity and recovery operator.
4. Apply migrations 1–11 one at a time, transactionally, with lock/statement timeouts and ledger verification after each.
5. Deploy the frozen application once through the existing `main`→Vercel integration.
6. Verify deployed commit, then apply migrations 12–16 immediately in order.
7. Reconcile schema/RLS/grants/indexes and the migration ledger.
8. Run `/api/health`, deep health, login and unauthenticated protected-route checks.
9. Run bounded role smoke: Owner, Parent, Staff, Inspector and Admin; canonical reports; private Storage authorization; invitation acceptance; manual tuition workflow.
10. Confirm optional providers degrade truthfully and no QA/internal route is reachable.
11. Monitor errors, DB connections, cron results, Auth, egress and provider usage; record the deployment ID and release evidence.

## Abort conditions

Abort immediately for migration-ledger mismatch, missing/untested backup, unexpected destructive SQL, lock timeout, partial/unknown migration state, missing core Auth/cron/encryption configuration, health failure, schema drift, cross-tenant authorization failure, plaintext credential exposure, incorrect deployed SHA, or unexplained cost/quota breach.

## Rollback decision tree

- **Application failure; DB remains backward compatible (before migration 12):** restore the recorded prior Vercel deployment and investigate.
- **Migration fails before commit:** stop, verify transaction rollback and ledger, then retry only after root cause is understood.
- **Migration committed and is additive:** prefer a reviewed forward fix. Never edit the applied file.
- **Failure after migration 12:** the prior app is incompatible with the dropped credential column. Keep the new compatible app or deploy a reviewed forward repair; restore only under the documented incident decision.
- **Data corruption:** stop writes, preserve evidence, assess forward repair versus isolated verified restore, and require the authorized incident/recovery owner.

## Post-deployment smoke

- Homepage/login, signup/Email verification, recovery and session refresh.
- `/api/health` 200; database OK; deep health authorized.
- Unauthenticated Management mutations 401/403; internal QA tools 404.
- Owner, Parent, Staff, Inspector and Admin canonical dashboards.
- Attendance/pickup, Staff time, messaging, notifications and role-aware reporting bounded checks.
- Private document/message/evidence object: authorized signed access succeeds; anonymous/unrelated access fails.
- Payment provider remains unavailable unless separately verified; manual tuition flow remains truthful.
- Camera/AI remains readiness/unavailable without verified Digital Observer capability.

## Evidence to retain

Release authorization, candidate SHA, included ledger units, migration hashes/status, backup/restore proof, deployment ID, health/smoke results, provider/cost snapshot, incidents and rollback decision. Never store secrets, customer content or invoices in Git.
