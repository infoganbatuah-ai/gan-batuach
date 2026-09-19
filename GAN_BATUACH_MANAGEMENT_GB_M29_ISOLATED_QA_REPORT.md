# GB-M29 isolated role and RLS QA — 2026-09-19

## Environment

- Scope: `codex/gb-m29-messaging-threads`, based on `450ac46d38d366b43a25c14f2c0a1075fd52c0e8`; PR #57. No Production migration, data mutation, merge, or deployment was performed.
- Disposable local PostgreSQL: Supabase CLI workdir `/private/tmp/gb-m29-supabase-qa`, Colima profile `gb-m29`, database container `supabase_db_gb-m29-supabase-qa`, loopback DB port `54322`. Synthetic fixtures only. QA SQL and raw logs remain outside Git in that workdir.
- This is a **diagnostic adapted database**, not a clean canonical migration proof. The local Supabase project is unlinked from Production. The local VM is retained for the integration owner; no claim is made that it is the canonical cumulative development backend.
- No new paid provider or Production storage was used. The local container occupies disposable disk space only; it must be removed after handoff when no longer needed.

## Database Baseline

- The repository contains 228 baseline SQL migrations through `20260913210000_management_canonical_messaging_threads.sql`, plus the scoped QA follow-up `20260913211000_management_messaging_qa_hardening.sql` added by this task.
- `supabase db start` on a clean local database stopped at `20260523003000_owner_role_and_onboarding.sql`: a newly added `app_role.owner` enum value was used in the same migration transaction. For diagnostic continuation, the copied SQL files were executed statement-by-statement rather than through the canonical CLI transaction path. This is **not** a successful clean-chain replay.
- Synthetic Classroom assignment inserts exposed a historical `validate_classroom_assignment_scope()` trigger that references `NEW.employment_id` on the Child assignment table. Only during synthetic fixture insertion, its Child/Staff validation triggers were disabled and re-enabled in the same local transaction. This does not prove that trigger safe.

## Migrations Applied

- The disposable QA ledger contains 228 baseline names, but `20260902043000_activate_channel_1_guard_lighting.sql` is recorded as **skipped**, not applied. It failed against the empty database because it requires a particular healthy camera scope and observer-site consent. Earlier statements of that file may have committed under the diagnostic statement-by-statement runner. Do not use this ledger as a canonical migration history.
- Four other copied historical SQL files were locally adapted solely to continue the diagnostic probe; repository originals were not edited:

  | Migration | Clean-chain blocker | Repository SHA-256 | QA-copy SHA-256 |
  | --- | --- | --- | --- |
  | `20260523012000_qa_action_persistence.sql` | Invalid `alter typeש` token | `b54cb8b1e145afc90ccd7748815b9f1f3c3c12674374532176fabc68a6b701c7` | `c0f239e2325cbb8d78f3a20444fa77ecbf088221ce6f1f08c245aa8541e4675b` |
  | `20260612016600_external_legal_privacy_regulatory_review_pack.sql` | Fixture status values violate its own check constraints | `f258acab64283fa24496ca33feae1d4f6c610b2b917f84c180679c357d1c4828` | `981e10561f80f86f1a9ee976e66065d723006145fbf6da5e8df9d747d4ecabf4` |
  | `20260827000100_digital_observer_event_media_evidence.sql` | Invalid reference to UPDATE target in `FROM LATERAL` | `088f367d6c00cbfd5d35d3d7a57147dc6ee2cd179cf485a5e6eddbfed0d46eeb` | `6809a0b6336265a94d8587e71a03532b0a62e18480a1401f649f04b2b78c0269` |
  | `20260902033000_activate_scoped_digital_guard_camera_automation.sql` | Requires five pre-existing healthy, authorized cameras; QA copy omitted that site-specific guard | `8578292d4c399e1c16dcdce6155c10b1391b2c698014d3d1766295a8feb31ffe` | `f9fb1d0581998042a3ffc4759be105667dd269c79e690965f5deed60cfd36d8f` |

- The unchanged GB-M29 migration and new follow-up were applied to that **adapted** schema. Target tables, four messaging indexes, unique sender/idempotency index, four read RLS policies, and RPCs were inspected. RLS is enabled on threads, participants, messages and delivery events. `authenticated` has SELECT but no direct INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES on these tables after hardening; `anon` cannot execute mutation RPCs. This targeted observation cannot substitute for clean-chain verification.
- `npm run qa:migrations` passed the repository's static audit (229 migration files, no duplicate timestamp), but does not replay the database.

## Synthetic Identities

- Eleven disposable `auth.users`/profiles: Parent A/B, Garden A/B Manager, Staff A/B, multi-Garden Staff A+B, Candidate Staff, Revoked Staff, Inspector A and Platform Admin.
- Two Gardens, three Classrooms (A1, A2, B1), two Child files/Children, legal guardian links, active enrollments, active Staff employment/assignment rows plus a revoked employment. A separate transaction temporarily established Inspector approval and Garden A assignment; it was rolled back after the privacy probe.
- No customer data, real attachments, or external notification providers were used.

## Parent / Garden

- PASS on adapted schema: Parent A created/read a Garden A thread and its message, repeated creation with the same key returned the original IDs, and Parent B could not see A threads. Parent A could not use Child B, Garden B recipient, or an unrelated Classroom recipient.
- A pre-fix probe showed Parent A could open an undeliverable thread to active Garden A Staff assigned only to A2 while Child A was in A1. The follow-up migration requires a current Child-Classroom/Staff-Classroom match; the same negative probe then returned `42501`.

## Staff / Parent

- PASS on adapted schema: active Staff A assigned A1 was a valid recipient for Child A. Staff A was denied Garden B. Multi-Garden Staff A+B, assigned A2 and B1, was denied Child A in A1 but permitted Child B in B1. Candidate/Revoked Staff were not valid Parent recipients; revoking Staff A's active employment during a rolled-back transaction immediately removed its existing thread read/send access.
- Same-Garden Manager/Staff conversations were created without fabricating Child/Classroom authority.

## Multi-Garden Staff

- PASS at database scope: Staff A+B held independent active A and B employments and the role-specific RPC tests respected the supplied Garden/Child context. The Staff UI/API uses selected Garden filters; no live browser context-switch journey was run. A selected context remains a UI filter, not an RLS grant.

## Manager / Staff

- PASS on adapted schema: Managers A/B each opened same-Garden Staff threads; Manager A could not create a Garden B thread or directly enumerate B threads.
- A pre-fix probe showed Parent A could address Manager A after A's management membership was revoked, because the old recipient check trusted `gardens.manager_id`. The follow-up migration now requires an active, unended management membership; the revoked-recipient probe returned `42501`. Existing-thread read authorization already used current management authority.

## Broadcast

- PASS on adapted schema: A1 Parent broadcast created one thread, one message and an audience snapshot of one active Parent. Parent B and unrelated Classroom recipients were absent. Parent A could read it, Parent B could not. Audience snapshot semantics and later relationship revocation were not exercised in a browser.

## Read State

- PASS on adapted schema: Parent A marked only their participant state; Manager A's participant read timestamp was unchanged. Parent A could not mark Parent B's thread read. Two separate simultaneous read connections completed with one participant row and the current latest-message reference.

## Idempotency

- PASS on adapted schema: sequential duplicate create reused the same thread/message. The original GB-M29 RPCs checked idempotency before taking their advisory/row lock, allowing a concurrent duplicate to reach a unique-key error. The follow-up moves same-key checks after serialization for direct create, broadcast and send. Unique sender/key index remains the final guard.

## Concurrency

- PASS in the adapted local database with separate PostgreSQL connections: concurrent same-key thread creation produced one message and the second call returned `idempotent=true`; concurrent same-key sends produced one message; two distinct simultaneous sends each persisted once. Concurrent read-state updates completed without duplicate participant rows. These are real separate DB connections, not a single-process simulation.
- The clean canonical migration blocker means these results must not be represented as Production-equivalent proof.

## Attachments

- Canonical create/send APIs use strict request schemas and reject `attachment_urls` or arbitrary URL fields. Messaging has no new raw attachment retrieval endpoint; there was no private object/signed-URL fixture to exercise a full retrieval journey. **Full attachment access QA remains open.** Existing private-storage controls must be verified in the controlled role journey; no storage policy was weakened.

## Inspector Privacy

- PASS on adapted schema: even with synthetic approved Inspector state and Garden A assignment, direct ordinary-thread enumeration returned zero. Inspector cannot invoke the ordinary create RPC as an authorized actor. Complaint/inspection workflows remain separate.

## Admin Privacy

- PASS on adapted schema: Platform Admin directly enumerated zero ordinary threads under authenticated RLS. The existing Admin communications page may display an empty legacy ordinary-message list; no blanket Admin reader was added. Privileged support access would require a separate audited contract.

## Complaint Boundary

- PASS on adapted schema: synthetic sends created zero rows in `complaints`; no complaint transition appears in the GB-M29 RPCs.

## Task Boundary

- PASS on adapted schema: synthetic sends created zero rows in canonical `workflow_tasks`; message send does not close or create a Task.

## Notification Privacy

- PASS on adapted schema: 11 synthetic communication notifications had only generic Hebrew bodies and a message ID reference; none contained the private message text. External delivery was not attempted or claimed.

## Direct RLS Tests

- PASS on adapted schema: JWT `sub` was set per synthetic identity with `SET LOCAL ROLE authenticated`. Parent A could not directly select Parent B's thread/message or forge a participant/message insert. Garden A Manager, Staff A, Inspector and Admin could not enumerate unrelated ordinary threads. A direct authenticated `TRUNCATE public.messages` attempt returned `42501` after hardening.
- Local introspection confirmed the four messaging tables have RLS enabled, the four intended SELECT policies are present, and the sender/idempotency unique index exists. The follow-up revokes anomalous legacy direct TRUNCATE/REFERENCES/TRIGGER grants and anonymous mutation-RPC execution.

## Service Role Review

- All four GB-M29 `/api/communication` route files use session `createClient()` and role-scoped RPCs/SELECTs; none uses Service Role. The SQL RPCs are `SECURITY DEFINER` and independently validate `auth.uid()`, Garden, Child, recipient, participant and current relationship. The legacy Admin direct-message insert route is now denied by the canonical table grants rather than bypassing RLS; its retirement/UX compatibility belongs to the route consolidation work.

## Negative Security Matrix

| Probe | Result on adapted QA schema |
| --- | --- |
| Parent A → Child B or Garden B | DENIED |
| Parent A → Staff in unrelated A2 Classroom | DENIED after fix |
| Parent A → revoked Manager/Staff recipient | DENIED after fix |
| Manager A → Garden B | DENIED |
| Staff A → Garden B; Staff A+B → unrelated A1 Child | DENIED |
| Revoked Staff → prior thread read/send | DENIED |
| Assigned Inspector → Parent/Garden ordinary thread | DENIED |
| Admin → ordinary-thread enumeration | DENIED |
| Forged participant insert / direct message insert | DENIED |
| Direct thread/message ID substitution | HIDDEN by RLS / denied by RPC |
| Unrelated user → raw attachment | No raw attachment route exists; full private retrieval remains UNVERIFIED |

## Fixes Required / Applied

- New ordered migration `20260913211000_management_messaging_qa_hardening.sql` only: enforce Parent→Staff current Classroom scope; require recipient Manager's active membership; serialize duplicate-key lookup after the lock for create/broadcast/send; revoke direct destructive table privileges and anonymous mutation-RPC execution.
- Expanded focused source-level regression to check those safety properties. No original migration, Digital Observer core, or unrelated production data was modified.

## Validation

- PASS: 9/9 GB-M29 focused tests; 226/226 Management regression tests (including 49 operational-role/Classroom/multi-Garden/messaging checks); Parent contract 20/20; static migration audit; typecheck; local Production build retry; security CI gate (7/7); release-contract check; changed-file ESLint; lint baseline (zero new regressions). Scoped DB/RLS/role/concurrency probes above passed on the adapted schema.
- BLOCKED: full domain CI gate stops in unrelated `quality-benchmark` suite because `DIGITAL_OBSERVER_BENCHMARK_DATASET_CONTRACT.md` is absent from this branch. This is not counted as PASS.
- Local Production build was first blocked by sandbox port binding; an elevated **local-only** retry passed after Turbopack compiled, checked TypeScript and generated the application routes. No deployment was triggered.
- A clean canonical migration replay, browser authentication flow, live private attachment retrieval and Production role probes are **not** verified.

## Remaining QA Debt

1. Establish a repository-approved clean isolated baseline (or a verified current-schema QA snapshot) and replay all unchanged canonical migrations, including resolution of the historical enum/SQL/fixture/hardware-specific blockers. Re-run GB-M29 RLS tests there. Do not alter applied migration history or seed fictitious camera authorization.
2. Resolve the unrelated missing benchmark contract and obtain a full green domain gate and exact-commit protected CI checks.
3. Exercise authenticated browser/API role flows, private attachment retrieval, and legacy read-compatible surfaces with controlled accounts. Preserve the GB-M21–M28 carried live-QA debt for GB-M35/40.

## Release Recommendation

**GB-M29 RELEASE RECOMMENDATION: BLOCKED**

The adapted isolated database provided valuable direct RLS and concurrency evidence and exposed/fixed scoped GB-M29 defects. It cannot satisfy the required clean canonical schema-migration gate or the full validation gate. Keep PR #57 open on the feature branch; do not merge, apply the migration to Production, or begin GB-M30 from this QA result.
