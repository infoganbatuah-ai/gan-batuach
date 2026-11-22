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
