# PR #235 — secure compare-only design closure (preparation only)

> Subsequent private-executor implementation and the remaining Production
> privilege/transport gates are documented in
> `DIGITAL_OBSERVER_HOME_LEGACY_PRIVATE_EXECUTOR_PREACTIVATION_20261021.md`.
> The final access decision and corrected current caller inventory are in
> `DIGITAL_OBSERVER_HOME_LEGACY_PRODUCTION_ACCESS_APPROVAL_PACKAGE_20261021.md`.

Status: **Draft / no Production activation**. Production Supabase project `kuaywzvucllxjsxarogb` was inspected using SELECT-only catalog and enrollment-metadata queries on 2026-10-21. No verifier, local credential, Keychain value, or token was read. Gateway and Connector matches remain **UNKNOWN / UNKNOWN**. The two enrollment bindings below are identifiers, not authentication evidence.

| Kind | Enrollment ID | Device ID | Tenant and Site ID | Profile | Config version |
|---|---|---|---|---|---:|
| Gateway | `1c450dca-38a8-4e49-853f-c613ca498c27` | `62df97e2-3c0b-427f-9108-bde029bc10e7` | `cc1673b8-3eb0-4785-a12c-1fb88f425a41` | PHYSICAL_GATEWAY | 1 |
| Connector | `d7ee3c9f-0b2e-4943-947b-c410c6bc2a41` | `db267b52-6282-4944-bcee-5d4857698fb0` | `cc1673b8-3eb0-4785-a12c-1fb88f425a41` | SOFTWARE_CONNECTOR | 4 |

## Trust boundary and remaining deployment decision

The prior dedicated direct-LOGIN plan is **withdrawn**. Its pending migration `20261021010000_home_legacy_compare_reader_preparation.sql` is now an explicit no-op before any application. It creates no role, schema, function, grants, or verifier-returning RPC. Existing direct LOGIN grants in Production were not changed because none were made by this draft.

The preparation code now delegates a **single private `compareBoundCredential` capability**, not a verifier-read API, to the already existing authorization coordinator. The coordinator accepts only the two pinned devices and requires an authenticated platform administrator, purpose `HOME_TELEMETRY_LEGACY_MATCH`, exact tenant/Site, an unrevoked approval of at most five minutes, an atomic two-attempt limit, and append-only redacted audit acknowledgement. It rechecks expiry/revocation around the comparison. The private comparator reuses the existing SHA-256 / constant-time comparison and returns only MATCH, MISMATCH, or UNKNOWN. Its SQL contains exact enrollment, device, tenant, Site, profile, config-version, active status, and `LEGACY_HMAC` predicates; a second local binding check rejects changed context. No SQL, credential, verifier, or error text appears in the result/audit.

**Not yet Production-ready:** the `query` and `loadProtectedCredential` functions are *injected trusted-process capabilities in synthetic QA*, not connected to Production. An actual private execution host must be selected, security-reviewed, and separately approved. It must have a protected server-side database read path with no client-supplied SQL, no public comparison endpoint, no generic database LOGIN, and no service-role token provided to a caller. The protected local credential must either remain co-located with the trusted comparator or, if sent to a trusted Product server, require a **separate one-time owner approval** for mutually verified destination, authenticated TLS, no request-body logging/persistence, short approval lifetime, and immediate revocation. This package does **not** transmit it. Existing broad backend privileges must not be presented as a least-privilege database grant; if a narrow delegation cannot be established, the Production package remains blocked.

No Production role/function/deployment is required by the no-op migration itself. A later Production execution component or permission change is a separate reviewed change, with exact owner, deployment target, credentials/storage, backup, rollback, observability and cost evidence. The approval-store SQLite fixture is host-local preparation, not a deployed Production authorization service. Synthetic tests cannot establish real administrator identity, actual Keychain recovery, actual Production verifier match, or real telemetry delivery.

## Existing PUBLIC-executable writable functions

Production read-only catalog inspection confirmed all five are `VOLATILE SECURITY DEFINER`, owned by `postgres`, and have explicit `PUBLIC`, `anon`, `authenticated`, and `service_role` EXECUTE grants. This is a real permission surface, not evidence of abuse. Source and deployment caller inventory:

| Function | Observed intended caller | Body control / side effect | Proposed role after review |
|---|---|---|---|
| `assign_child_to_classroom(uuid,uuid,uuid)` | Authenticated garden route | `can_manage_garden`; writes assignment | authenticated, service_role, owner |
| `assign_staff_to_classroom(uuid,uuid,uuid,text)` | Authenticated garden route | `can_manage_garden`; writes assignment | authenticated, service_role, owner |
| `escalate_task(uuid,text,uuid)` | Authenticated task domain | actor/admin-inspector check; updates task. The later deployed definition no longer calls `notify_role`. | authenticated, service_role, owner |
| `notify_role(uuid,app_role,text,text,text,uuid)` | Nested `process_monthly_inspection_reminders`; an older superseded `escalate_task` definition also called it | **No independent caller check**; inserts notifications; notification trigger may enqueue delivery intent | owner only, pending external-caller inventory |
| `process_monthly_inspection_reminders(timestamptz)` | Protected `/api/cron/inspection-reminders` via `createAdminClient` | **No independent caller check**; updates tasks and calls `notify_role` | service_role, owner |

The exact review-only grant proposal is [DIGITAL_OBSERVER_HOME_PUBLIC_FUNCTION_REMEDIATION_PROPOSAL_20261021.sql](DIGITAL_OBSERVER_HOME_PUBLIC_FUNCTION_REMEDIATION_PROPOSAL_20261021.sql). Do **not** apply until the deployed cron role, SQL/trigger callers, downstream notification behavior, and Management regression are verified in an isolated clone and a separate Production window is approved. Direct calls to `notify_role` may create communication intents, so avoid invoking it against Production. Existing function definitions and old migrations are not rewritten. An emergency rollback would restore only each function's captured prior ACL in a transaction; restoring `PUBLIC` would reopen the vulnerability and must trigger incident review.

## Future default privileges (separate, not applied)

Read-only `pg_default_acl` inspection found `postgres` in `public` grants EXECUTE to `anon`, `authenticated`, and `service_role`; `supabase_admin` in `public` has the same grants. PostgreSQL's implicit global PUBLIC EXECUTE remains relevant even without an explicit global row. Review a **future-only** policy, first on an isolated clone:

```sql
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role supabase_admin revoke execute on functions from public;
alter default privileges for role supabase_admin in schema public revoke execute on functions from anon, authenticated, service_role;
```

This would not change existing functions. Future migrations must explicitly GRANT only the callers they require, in the same transaction as function creation. Confirm actual function creator roles, Supabase-managed schema dependencies, and migration compatibility before any Production default change. Do not globally revoke existing PUBLIC EXECUTE as a shortcut. Rollback is the captured default ACL restore, not a guessed blanket GRANT.

## Qualification, rollback and activation gates

- Isolated synthetic PGlite tests cover exact binding, wrong tenant/Site/device/enrollment, no exposed verifier API, MATCH/MISMATCH/UNKNOWN, revoked row, role denial, replay, expiry/revocation, atomic attempts, append-only audit, and PUBLIC writable-function exposure/remediation behavior. They are not a full clone of every Production extension or a Production permission proof.
- Preserve the existing protected 36-file configuration backup and QA identity. Keychain **live** recovery remains limited; no installed service was restarted, no Production credential rotated, and no source identity changed. No rollback can be declared fully READY until the actual host recovery path is demonstrated under separate authorization.
- Before any live comparison: approve and deploy the trusted private execution boundary; verify exact pinned enrollment still current; confirm no client-facing SQL/verifier surface; prove destination/TLS and credential-handling path; verify administrator approval storage/audit/atomicity in the target runtime; review cost and immediate disable; then request **separate** permission for transmitting or using the local credential and running exactly one bounded comparison per device. No `refresh` RPC.
- Before telemetry transition: independently verify credentials, signed installation package, Keychain/QA rollback, installed-version compatibility, no duplicate reporter, and a separate owner live-change authorization. No main merge, Vercel Production deployment, Production DDL/DML, or PUSH 46 work is part of PR #235.
