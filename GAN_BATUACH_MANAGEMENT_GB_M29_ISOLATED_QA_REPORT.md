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

- PASS: 9/9 GB-M29 focused tests; 226/226 Management regression tests (including 49 operational-role/Classroom/multi-Garden/messaging checks); Parent contract 20/20; static migration audit; typecheck; local Production build retry; domain CI gate (29/29); security CI gate (7/7); release-contract check; changed-file ESLint; lint baseline (zero new regressions). Scoped DB/RLS/role/concurrency probes above passed on the adapted schema.
- The initial domain run could not read root Markdown contracts hidden by this worktree's sparse-checkout configuration. Those files were already tracked in the same commit; making them visible locally and rerunning produced the 29/29 PASS above. No product file was added or changed for this worktree-only repair.
- Local Production build was first blocked by sandbox port binding; an elevated **local-only** retry passed after Turbopack compiled, checked TypeScript and generated the application routes. No deployment was triggered.
- A clean canonical migration replay, browser authentication flow, live private attachment retrieval and Production role probes are **not** verified.

## Remaining QA Debt

1. Establish a repository-approved clean isolated baseline (or a verified current-schema QA snapshot) and replay all unchanged canonical migrations, including resolution of the historical enum/SQL/fixture/hardware-specific blockers. Re-run GB-M29 RLS tests there. Do not alter applied migration history or seed fictitious camera authorization.
2. Obtain exact-commit protected CI results and controlled authenticated API/browser role evidence. The local domain gate is green after restoring the tracked sparse-checkout files; it is not a substitute for CI on PR #57's final head.
3. Exercise authenticated browser/API role flows, private attachment retrieval, and legacy read-compatible surfaces with controlled accounts. Preserve the GB-M21–M28 carried live-QA debt for GB-M35/40.

## Release Recommendation

**GB-M29 RELEASE RECOMMENDATION: BLOCKED**

The adapted isolated database provided valuable direct RLS and concurrency evidence and exposed/fixed scoped GB-M29 defects. It cannot satisfy the required clean canonical schema-migration gate or the full validation gate. Keep PR #57 open on the feature branch; do not merge, apply the migration to Production, or begin GB-M30 from this QA result.

## Canonical Clean Migration Chain — follow-up 2026-09-19

The fresh, unmodified repository migration chain remains **BLOCKED**. The repository has no committed baseline/squash mechanism in this feature branch. The separate integration owner is preparing an owner-authorized, versioned **development-only schema baseline**; this must not be described as an unmodified historical replay. No GB-M29 migration has been applied to Production. The diagnostic database above remains an adapted probe, not a fresh-install result.

**Later 2026-09-19 verification:** the integration branch now contains committed baseline `development-c0cf2de7-20260919-v1` (`8506689f`, integrated by `00402d7a`). It preserves the 227 original historical migration files and derives an isolated schema snapshot with statement-level provenance; the baseline README explicitly says it is **not historical replay** and never a Production restore. On that fresh local baseline plus the ordered classroom compatibility fix, the three unmodified GB-M29 migrations (`20260913210000`, `20260913211000`, `20260913212000`) all executed together inside a single rollback-only transaction. The synthetic Parent/Manager/Staff/Inspector/Admin role matrix passed. This is canonical baseline **upgrade compatibility** evidence, but a full clean bootstrap receipt and durable post-baseline application remain with the integration owner. No historical migration file was modified for this check.

## Migration Failure Root Cause

The first clean Supabase CLI failure is deterministic in `20260523003000_owner_role_and_onboarding.sql`: it adds `app_role.owner` and uses that new enum label in the same migration transaction. PostgreSQL rejects use of an uncommitted enum value. Classification: **A — historical migration invalid from a clean transactional state**, with later independent historical SQL, fixture and site-specific hardware/data prerequisites listed in “Migrations Applied.” No applied historical file was edited in Git. A new migration ordered after the historical one cannot fix this first clean-install failure; an explicitly supported baseline or runner change is necessary. The Production-style upgrade must be verified separately against its actual pre-GB-M29 migration state.

## Fresh Install Verification

**PENDING / NOT PASS.** The existing clean attempt stopped at the migration above. An owner-approved development baseline is under construction in a separate task; until its provenance, omissions, schema equivalence and clean deployment are verified, it cannot close this gate.

The new development baseline has been committed and restored into the isolated local stack, with its source/provenance and explicit excluded DML documented. Because it is a derived schema snapshot, this does **not** convert the failed original 227-file replay into a PASS. Final fresh-install status requires the integration owner's clean bootstrap verification for the newly canonical baseline path.

**Final isolated clone result:** a second disposable Supabase project, `gb-m29-final-qa`, was started from empty platform state on loopback API `127.0.0.1:55521` and DB `127.0.0.1:55522`. The committed `development-c0cf2de7-20260919-v1` schema and exact ACL artifact restored without error. The ordered classroom fix and the exact three GB-M29 files then applied without editing or skipping any of those four files. Eleven separate synthetic Auth users were created in this clone; Garden A/B, Child, Manager, active/multi-Garden/revoked Staff and Inspector fixtures were derived from the repository's canonical QA fixture structure. The original 227-file replay remains historically invalid as described above; the **supported new development-baseline fresh path passed**. It is development-only and does not assert that the Production migration ledger was replayed.

## Existing Schema Upgrade Verification

**PENDING / NOT PASS.** The original GB-M29 migration, QA hardening and new private-attachment migration applied to the adapted local database, but that database is not a verified pre-GB-M29 Production-style snapshot. No customer data or Production migration state was changed.

The new rollback-only test applied the exact three files to the isolated canonical pre-GB-M29 schema and returned `M29_TABLE_COUNT=3`, `M29_RLS_ENABLED=true`, `M29_BUCKET_PRIVATE=true`. It then rolled back. This confirms SQL compatibility with that existing-schema baseline without touching customer data; the actual Production migration ledger remains unverified and no Production upgrade was attempted.

The same unmodified migrations subsequently applied durably, in order, to the **separate disposable clone** of the pre-GB-M29 baseline. SHA-256 prefixes: classroom fix `3b25e47269022a96`, messaging `ddf9298ebdeda47a`, QA hardening `0999ea1f2c2643d7`, private attachments `11c3ab542a9287e3`; all four exited 0. This demonstrates the existing-schema upgrade against the supported synthetic baseline. A read-only Production ledger reconciliation remains a release-time task; no Production database was accessed or changed here.

## Canonical RLS Reverification

**PENDING / NOT PASS.** Existing direct RLS evidence above is from the adapted local database. The new attachment metadata policy and restrictive Storage policy also passed direct synthetic SQL probes there: Parent A and Manager A saw their Garden A attachment; Parent B, Manager B, Staff B, revoked Staff, Inspector and Admin saw none; a forged cross-Garden metadata row failed the scope trigger; `storage.buckets.public=false`; and direct `authenticated`/`anon` reads of a synthetic `storage.objects` row returned zero. Re-run all probes on the canonical isolated baseline before READY.

**Canonical rollback-only rerun PASS:** after creating synthetic Parent A/B, Manager A/B, Staff A/B/multi-Garden and broadcast threads, direct role checks passed for wrong Child, wrong Garden/Classroom, revoked Staff, Inspector/Admin privacy and tenant visibility. Direct attachment metadata RLS returned exactly one row for Parent A and Garden A Manager and zero for Parent B, Garden B Manager, Garden B Staff, revoked Staff, assigned Inspector and ordinary Admin. All tests ran after the exact GB-M29 migrations on the new baseline and left no durable schema/data changes. The HTTP Auth/Storage attachment journey remains pending.

**Final canonical clone rerun PASS:** the direct authenticated SQL role matrix passed all 25 cases after durable migration on the fresh supported baseline. A separate catalog/SQL probe against the actual E2E attachment verified participant RLS (Parent A/Manager A visible; Parent B/Manager B/Staff B/revoked Staff/Inspector/Admin hidden), no direct authenticated or anonymous Storage object reads, private bucket, restrictive Storage policy, five expected indexes, RLS enabled and no prohibited anonymous RPC/table grant. This replaces the pending canonical-RLS assessment above; it does not erase the earlier adapted-database evidence.

## Private Attachment E2E

**PENDING / NOT PASS.** A scoped follow-up now provides one attachment per existing sender-owned message, maximum 5 MiB, MIME allowlist, bounded request length, server-generated Garden/thread/message path, and an authorized retrieval API that issues a 60-second private download URL. Upload failure leaves no metadata; metadata failure attempts object cleanup. The message-detail API returns only safe metadata and an API path. This is a new minimal capability because GB-M29 previously rejected raw attachment URLs and had no private retrieval route. A loopback-only executable E2E harness is at `scripts/qa/run-management-message-attachment-e2e.mjs`; it reads synthetic identities from a restricted local file and prints no credentials. An actual Auth → upload → Storage object → signed retrieval HTTP journey and the full negative actor matrix still require a running isolated Auth/Storage/API stack. Static route assertions and direct database RLS are **not** substituted for that evidence.

**Final isolated HTTP E2E PASS:** a scoped GB-M29 feature server at `127.0.0.1:55600` used only the disposable clone. Synthetic Parent A authenticated through local Auth, created a Parent→Garden A thread/message through the canonical RPC, uploaded a PDF through the Management API, and received only a safe download API path. Parent A and Garden A Manager each obtained a 60-second signed private retrieval and fetched the exact bytes. Parent B, Garden B Manager, Garden B Staff, revoked Staff, assigned Inspector, ordinary Admin, unauthenticated caller, altered attachment ID and altered thread ID were denied. Non-sender and unrelated upload attempts were denied. Direct anonymous/authenticated Storage download and anonymous signed-URL creation failed; the raw public URL did not serve the object. A fresh signed URL ceased working after its 60-second expiry. The harness returned exit 0 with no secret or signed URL printed. The local feature server was stopped afterward.

## Storage Privacy

**PASS at adapted database policy layer; HTTP E2E pending.** The new `management-message-attachments` bucket is private. A restrictive `storage.objects` policy denies direct client access even if another permissive policy exists; the service role is used only after actor, thread, message and ownership checks. No raw public URL is returned. Storage is limited to one file of at most 5 MiB per message. Attachments follow the existing `communications-retention` policy: 1,095 days and manual/legal review; no automatic deletion is enabled by this push. Expected volume is one optional file per message, queried by thread/message index; storage/egress cost must be assessed before Production activation.

**Final clone Storage privacy PASS:** local Storage reported `public=false`; signed object fetch worked only after the Management authorization gate; raw public and direct client reads failed; the object was not visible through direct `anon`/`authenticated` SQL. The 60-second signed URL expired. Production Storage configuration remains untouched.

## Final PR Checks

At `742e5e1f9def60c7eac5f608639ecd55352a2550`, GitHub showed **10/10 completed successful checks**, including the six protected Digital Observer CI gates. Attachment commit `38787f3cccf5bcb7a12c4d6d0675b1d21d0faa75` was pushed to PR #57, where 7/9 checks had succeeded at the last observation; two were still running. A further scoped follow-up must receive its own exact-head checks after push. Earlier results do not transfer to a newer head.

Follow-up local validation after attachment changes: GB-M29 focused 10/10; Management 227/227; Parent contract 20/20; typecheck; Production build (local elevated retry after sandbox port denial); domain 29/29; security 7/7; static migration audit (230 files); release preflight; changed-file ESLint and lint baseline with zero regressions. The attachment SQL was applied only to the adapted disposable database. This still does not replace canonical fresh-install, upgrade, or HTTP E2E proof.

A later metadata-link and E2E-harness follow-up passed focused tests, source syntax and changed-file ESLint. Its local typecheck rerun was interrupted after prolonged shared-host contention; exact-head protected CI must supply the final typecheck/build proof. The E2E harness has not yet been run because the canonical isolated Auth/Storage stack is still being prepared.

At current source head `a07b3ca9e64f73111eb1216fe92280c1a97949be`, read-only GitHub check-run inspection found **9/9 completed/success**: Canonical quality gate, the six required Digital Observer CI gates, and two Management context checks. PR #57 remains open/unmerged. Any subsequent QA-report or code commit changes the head and requires a new exact-head check inspection; the current observation must not be reused for a later SHA.

## Final Release Recommendation

**GB-M29 RELEASE RECOMMENDATION: BLOCKED** pending a verified canonical fresh-install path, a verified pre-GB-M29 upgrade, direct RLS retest on that canonical environment, full authorized/unauthorized attachment HTTP and signed-URL QA, and green checks on the final PR head. No merge, Production migration, deployment or GB-M30 work is authorized by this report.

Current narrowed gates after rollback-only canonical SQL QA: (1) finish the supported development-baseline clean bootstrap and durable upgrade proof; (2) run the complete private-attachment Auth → Management API → Storage → signed retrieval E2E in that isolated environment; (3) after this report's final commit/push, wait for all required PR checks on the new exact head. The direct SQL RLS matrix has passed on the canonical baseline, but it is not a substitute for the pending HTTP/storage journey.

**Final QA progress:** gates (1) and (2) above passed in the separate disposable canonical-baseline clone, while preserving PR #57 open/unmerged and the integration database without GB-M29 schema. The remaining release recommendation gate is completed exact-head PR checks after this report is committed and pushed, plus recording the final validation results. No Production write, customer message or deployment occurred.

Final local regression rerun after the HTTP QA: GB-M29 focused **10/10**, Management **227/227**, Parent contract **20/20**, domain gate **29/29**, security gate **7/7**, and static migration audit **230 files** all passed. Direct canonical role/RLS and private attachment E2E passed as detailed above. Local typecheck, lint baseline and Production build were started but interrupted after prolonged shared-host contention; they are **not local passes**. An early release preflight returned `RELEASE_SNAPSHOT_NOT_CLEAN` because this report was still uncommitted; rerun it on the clean pushed head. Exact-head protected CI must establish typecheck/lint/build and release-preflight results before READY. No test was weakened.
