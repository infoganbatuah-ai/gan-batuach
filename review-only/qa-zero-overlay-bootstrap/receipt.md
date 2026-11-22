# Local source-only QA bootstrap receipt (2026-11-22)

Scope: disposable Supabase CLI project on isolated Colima profile `q275` on Kingston. No hosted database, original `gbi`, Home service, or Production operation was performed. The project used a symlink to the source migration directory, with zero overlay files.

- Base integration commit: `56a33389e6449df1aac41f4e48dfc515ce478d0f`.
- Source migration files: 275. The disposable database's `supabase_migrations.schema_migrations` also contained 275 records after a clean `supabase db start` (exit 0).
- Home Site rows for `cc1673b8-3eb0-4785-a12c-1fb88f425a41`: 0. Enabled Digital Guard camera automation policies: 0.
- Both communication preference tables had RLS enabled. The atomic preferences RPC granted EXECUTE to `authenticated`, not `anon`.
- A scoped `pg_dump -Fc` of `public`, `auth`, `storage`, and `supabase_migrations` was restored into a different disposable database. Restore exited 0; its migration registry contained 275 rows and the atomic preferences RPC existed. This does not qualify a full Supabase platform restore or hosted migration.
- Scoped dump SHA-256: `b72a857a384dd017dafd2c71df13619255899be194f3ff17b22c3f6fbb11bf0d`. It is stored only in the ignored local QA cache.
- A full-platform dump restore attempt was not qualified because of `vault.secrets` permissions; the scoped restore above passed.
- The repeatable runner passed end to end in a second fresh disposable project: 275 source files, registry 275, Home Site 0, enabled automation 0, two RLS tables, expected RPC grants, and a separate scoped restore. Its sanitized 275-line transcript and receipt are in ignored local cache under `.dev-cache/tmp/observer-zero-overlay-26800f83/`. Scoped backup SHA-256: `43d478b415413bba3edee71c10c6c672169090431ba13ea00b05a75ccb78d61a`.
- A prior `Broken` observation was caused by restricted access to the isolated Docker socket: a privileged check showed `q275` Running with a healthy disposable database. Temporary host database forwarding for the repeat run was closed by cleanly stopping `q275`; no listener remained on ports 59422 or 58422.

The six historical migration edits in this branch are source bootstrap corrections only. In particular, the two Home activation migrations now skip activation only when their exact Home Site is absent; their existing checks remain when it is present. Historical checksum, upgrade, and live-data compatibility require separate review before any application. This branch is not ready for hosted SQL or migration deployment.

## Historical delta and local upgrade qualification

`node scripts/qa/check-qa-historical-delta.mjs` passed all six exact baseline-to-candidate assertions. Inventory:

| Migration | Exact change | Existing-data risk |
| --- | --- | --- |
| `20260523000000_initial_schema` | Include `owner` when first creating the role enum; the later idempotent addition becomes a no-op on a fresh bootstrap. | An already applied enum is unchanged because this historical file is skipped. |
| `20260523012000_qa_action_persistence` | Correct one invalid `ALTER TYPE` token. | Already applied databases skip the file. |
| `20260612016600_external_legal_privacy_regulatory_review_pack` | Use conservative allowed review statuses in the Vercel seed. | A fresh seed differs from earlier deployed data; no deployed row is overwritten by an ordinary upgrade. |
| `20260827000100_digital_observer_event_media_evidence` | Replace an invalid target-alias reference with an equivalent first eligible camera correlated subquery. | Live-data equivalence is not proven for all historical rows. |
| `20260902033000_activate_scoped_digital_guard_camera_automation` | Return from the authorization DO block only if the exact Home Site is absent. | With the Site present, the original checks and later DML remain byte-identical; no live Home fixture was exercised. |
| `20260902043000_activate_channel_1_guard_lighting` | Return from the activation DO block only if the exact Home Site is absent. | With the Site present, the original authorization checks and activation remain byte-identical; no live Home fixture was exercised. |

On the isolated, already migrated `q275` database, a synthetic `subprocessor_register` row was inserted. `supabase migration up --local` reported `applied: []`; the registry stayed at 275 and the fixture stayed present. The fixture was then removed. This verifies non-reapplication and data preservation for that local case, **not** an upgrade from the pre-change integration database. The migration registry contains version, statements, and name columns; no history record was edited or repaired.

Missing qualification: a separately restored pre-change integration database with representative existing Home data. The original source baseline cannot fresh-bootstrap past the six defects, and this task excludes the original `gbi` and hosted QA. Before any deployment, restore a permitted pre-change backup into a separate QA database, compare schema and data, and rehearse the Home-Site-present branch and rollback. Do not treat the current source-only candidate as READY TO APPLY. The scoped dump/restore rehearsal above is evidence for backup mechanics, not a lossless rollback with active Home data.
