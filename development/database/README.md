# Canonical DEVELOPMENT / INTEGRATION database

This directory implements the owner's 2026-09-19 authorization for a **new,
clean, isolated development baseline**. It is not a Production restore, a
rewrite of applied history, or proof that the unmodified historical migration
chain bootstraps successfully. Production migration reconciliation is separate.

## Identity and boundary

`environment.json` pins the local Docker context, project/container identity,
Kingston runtime location, source integration commit and baseline ID.
The database executor requires the dedicated local Unix socket and matching
Supabase project label. No remote URL, linked project or Production fallback is
accepted. Development API: `http://127.0.0.1:55421`; PostgreSQL: loopback 55422.
Runtime data and credentials stay outside Git. Never print Supabase status keys.

## Derivation (not historical replay)

1. Select the 227 original migration files directly from integration commit
   `c0cf2de7e11e6e9b368fdd1fc3a068ce544ca55d`.
2. Preserve original Git blobs and SHA-256 hashes in the baseline provenance.
3. Classify every top-level statement. Keep schema/security DDL and complete
   function bodies. Exclude historical customer/fixture/backfill DML, live camera
   activation checks and their data-only blocks. No customer data is imported.
4. Commit builder DDL statements independently so newly added enum values can be
   used safely. Normalize the documented `alter typeש` typo **in the derived
   builder input only**, never in its historical source file.
5. Build in a separate empty builder database with local Supabase platform
   contracts. Export the final schema, custom Auth triggers, Storage policies,
   privileges and extensions; verify against the resulting canonical database.
6. Required safe reference data, private bucket contracts and synthetic QA
   fixtures are separate explicit inputs. Their absence is not silently ignored.

`provenance.json` records exact source/derived statement digests and disposition.
An artifact marked `PLAN_ONLY` or `DERIVED_NOT_YET_CANONICALLY_VERIFIED` is **not**
a ready database. Final readiness additionally requires object/canonical drift,
RLS/role/tenant tests, Auth/REST/Storage probes and application compatibility.

## Known historical bootstrap failures

| Source | Failure / baseline treatment |
|---|---|
| `20260523003000_owner_role_and_onboarding.sql` | Add/use enum in one transaction; builder statement commits, final dump includes complete enum. |
| `20260523012000_qa_action_persistence.sql` | Literal `alter typeש`; exact derived-only syntax normalization. |
| `20260612016600_external_legal_privacy_regulatory_review_pack.sql` | Historical fixture statuses conflict with later checks; no historical fixture rows imported. |
| `20260827000100_digital_observer_event_media_evidence.sql` | Invalid correlated data UPDATE/LATERAL; historical backfill excluded, schema retained. |
| `20260902033000_activate_scoped_digital_guard_camera_automation.sql` | Real camera precondition; omit that exact DO block, preserve security/command functions and trigger. |
| `20260902043000_activate_channel_1_guard_lighting.sql` | Production site consent/capability activation; never fabricate consent or run activation locally. |
| `20260911040000_management_canonical_classrooms.sql` | Shared trigger references another table's RECORD field; new migration `20260919170000` repairs branching, without disabling triggers. |

## History and future migrations

Historical files remain `HISTORICAL_MIGRATION`; a verified baseline mapping is
`DEVELOPMENT_BASELINE_INCLUDED`, not a fabricated claim of original execution.
New files are `POST_BASELINE_MIGRATION` and must be preserved remotely, integrated,
applied to DEVELOPMENT, tested and ledger-recorded immediately after validation.
`IN_GIT`, `IN_INTEGRATION`, `DEVELOPMENT_APPLIED` and `PRODUCTION_APPLIED` remain
independent. Unknown Production state must stay unknown until read-only verified.

No baseline may be applied over an existing populated database. No Production
baseline command exists. Production releases use their real migration history,
explicit owner release authorization and only reviewed pending migrations.

## Service limitations

Local Auth, PostgreSQL, REST, Storage and Realtime are the intended stack.
Studio, analytics, edge functions, image transformations and pooler are excluded
unless a validated Product contract later needs them. Local SMTP captures only
QA email; no real customer delivery. Cloud backups, provider billing, managed
availability, real camera/gateway hardware and live AI providers are not proven
by local Supabase health. Report these separately, never as healthy substitutes.
