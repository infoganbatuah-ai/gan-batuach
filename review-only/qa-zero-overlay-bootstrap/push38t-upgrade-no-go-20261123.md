# push38t pre-change upgrade qualification: NO-GO

Date: 2026-11-23 (Asia/Jerusalem). Scope: the already identified `push38t-db-pre-rest-repair-20260922.dump` only. SHA-256 `0378650eee71fb7bcd003c7f92ab3dc15109f7f9d6c44f25fe5e45b180ffae7c`. No further backup inventory or decryption was performed.

The dump was restored with `pg_restore --no-owner` as the existing local `supabase_admin` role into a fresh disposable database inside isolated Colima `q275`. Restore exited 0. Only schema existence and counts were queried; no Auth or Home records were displayed.

| Baseline fact | Result |
| --- | --- |
| `supabase_migrations` schema | Absent |
| `supabase_migrations.schema_migrations` table | Absent |
| `auth.schema_migrations` rows | 77; Auth internal history, not application migration history |
| Canonical Home Site rows | 1 |
| Home camera source rows | 0 |
| Signal, clip, automation policy tables | Present |

**NO-GO:** A supported CLI upgrade from this restored dump to source version 275 cannot identify the starting application migration version. The archive's table of contents also has no `supabase_migrations` schema or `schema_migrations` table. The Auth migration registry is unrelated. Running the 275 files from the beginning would apply initial schema SQL over existing tables; manually adding, guessing, or repairing application migration history would manufacture the prerequisite rather than prove it. The task explicitly forbids skipping migrations or injecting schema to make this look like a clean upgrade. Therefore no synthetic camera/media fixture was inserted into this dump, no source migration was applied to it, and no upgrade, failure-injection, or rollback PASS is claimed from this archive.

The existing post-275 synthetic fixture and 275-file fresh-bootstrap evidence remain valid for their stated scope. They do **not** resolve this pre-change upgrade gate. The minimum missing artifact is an authorized isolated pre-change database backup that includes its authentic `supabase_migrations.schema_migrations` history alongside Home data, or a separately reviewed and authorized reconstruction from independent migration receipts. Until then PR #656 remains Draft; hosted SQL, original `gbi`, Home, and Production remain untouched.
