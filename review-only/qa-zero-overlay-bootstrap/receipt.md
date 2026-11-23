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

## Bounded pre-change fixture inventory and 2026-11-23 checks

One bounded name/metadata inventory on Kingston found:

- The encrypted original Development snapshot at `Development/gan-batuach/recovered-development-backup.HvyUwd/` (2026-10-22, 256 applied migrations, 24 Auth users). Its manifest does not establish Home camera row counts, and the private `age` identity is not locally available to this task. No ciphertext was decrypted.
- Three unencrypted September `push38qa`/`push38t` QA dumps under `Projects/Gan-Batuach/exports/restricted/`. The `push38t-db-pre-rest-repair-20260922.dump` table inventory included `observer_sites` and `digital_observer_camera_sources`. This is a QA dump, not the original Development database.

The September `push38t` dump was restored only to a new disposable database inside isolated `q275`. Full restore reported exactly one `vault.secrets` permission error, so it is not a qualified full-platform restore. Metadata-only queries found one canonical Home Site, **zero Home camera sources**, zero automation policies, and no media-evidence table. This is insufficient for a representative Home upgrade or migration-170 live-data equivalence test.

The candidate `20260902033000` migration was run against that disposable restore. It failed at its existing guard with `Authorized camera scope is incomplete or unhealthy` (psql exit 3). No activation was committed. This proves the added Site-presence guard does not skip the original missing-camera denial in this fixture. The Site-absent case was covered by the 275/275 fresh bootstrap with zero enabled policies. A real Home Site with all five sources and authorization prerequisites was **not** exercised.

`scripts/qa/media-evidence-source-equivalence.sql` passed in isolated PostgreSQL using synthetic Sites and cameras. It compares the repaired correlated first-eligible-camera query to the valid LATERAL form of the original intent, including eligible/ineligible sources and no-source cases, inside a rolled-back transaction. It is not equivalence proof for historical media rows.

The disposable restore databases and temporary container copies were removed, and `q275` was cleanly stopped. No original Development database, hosted database, or Home service was accessed.

**Forward-only feasibility:** A new migration after version 275 cannot make a fresh source replay pass the malformed `alter typeש` in version `20260523012000`, nor can it correct the earlier enum-in-transaction, invalid seed, invalid target-alias SQL, or Home-Site-missing failure before those files execute. Therefore a forward-only-only candidate with all historical files reverted would fail before reaching the new migration. Do not label such a candidate PASS or publish it. The minimal viable source-only bootstrap correction still requires the six narrow historical repairs; deployment policy for already applied history and full representative upgrade/rollback remain separate gates.

## Synthetic five-source Home fixture (2026-11-23)

The explicitly synthetic generator is `scripts/qa/seed-synthetic-home-migration-fixture.sql`. It inserts one synthetic Auth/profile owner, the canonical Site and five source IDs **only in a disposable database**, a one-source policy, a capability-snapshot receipt through the real queue transitions, one system signal, and one missing-media clip. No network endpoint, real camera, customer data, or physical command was used. The four siren sources have no crossing-line authorization in the baseline fixture.

The fixture was built from the successful 275-source local QA schema. Before targeted replay, an ACL-preserving scoped dump of `public`, `auth`, `storage`, `extensions`, and `supabase_migrations` was taken: 7,172,800 bytes, SHA-256 `2a5b610eb68bc9e13d4abb722bbfea97634015d215d6191cb3d427212b5fd2c6`. It remains only in the ignored Kingston cache at `.dev-cache/tmp/qa-home-final-before-20261123.dump` with owner-only permissions. The standard `pgcrypto` extension was restored explicitly in each disposable clone because the schema-filtered dump does not create extensions.

Targeted candidate replay of migrations `20260827000100`, `20260902033000`, and `20260902043000` passed on the five-source fixture. Results: five distinct source policies, one enabled CH1 lighting policy, four disabled siren policies, the synthetic system signal linked to the first eligible CH1 source, registry 275, two RLS tables, and RPC EXECUTE `authenticated=true`, `anon=false`. A separate Site-absent 275-file fresh bootstrap passed with zero enabled policies.

Failure injection: after the first Home policy migration, the synthetic capability receipt was removed in a separate disposable clone. The CH1 activation migration failed with `Verified Gateway lighting capability is unavailable` (psql exit 3). Enabled policies: 0; CH1 activation audit records: 0. The failed migration did not partially activate CH1.

Rollback rehearsal: the pre-replay scoped dump restored to a third disposable database (pg_restore exit 0). It contained one synthetic Auth user, five camera sources, one disabled preexisting policy, the unlinked synthetic signal, one clip, registry 275, two RLS tables, and the original `authenticated=true`/`anon=false` RPC grants. All temporary test databases and container copies were removed; q275 was cleanly stopped. The new ACL-preserving repeatable bootstrap runner also passed a fresh 275-file replay and independent scoped restore; sanitized 275-line transcript and receipt are at `.dev-cache/tmp/observer-zero-overlay-3f411155/`, scoped dump SHA-256 `760e94bee8cfc419f88fe7d1b9409805198a0fce530a7d1d1fb9207d683f160f`.

Additional edge finding: a separate synthetic fixture with four valid crossing lines caused the first Home policy migration to enable four siren policies. When the subsequent CH1 migration was forced to fail, those previously committed siren policies remained enabled. This is the existing per-migration transaction behavior, not an action on real hardware. It is a **rollback boundary**: recovery after a later migration failure must restore or compensate the earlier migration; do not claim the pair is atomic.

Qualification limit: the five-source fixture starts from a **post-275 schema** and replays three targeted migration files. It is not an actual upgrade from a pre-change integration database, and it cannot establish equivalence on real historical Home rows. The September QA dump had one Home Site but zero camera sources. The October original Development dump is encrypted and was not decrypted. Full historical upgrade, live-data equivalence, and lossless rollback with real Home records remain unproven. No hosted SQL, PR publication, or Production/Home change is authorized by this receipt.

## Fail-closed Home activation correction (2026-11-23)

The prior edge finding was repaired in historical source migration `20260902033000`: before any policy or authorization-audit mutation, its existing-Site path now checks the external CH1 prerequisites used by the following activation migration (capability-refresh RPC, monitoring consent, exact source binding, completed capability receipt, and absence of unresolved physical commands). Its siren policy inserts are always disabled and marked as waiting for CH1 activation. The following migration already disables those same four siren policies in its successful final state. When the Site is absent, the original early return still applies.

In a separate synthetic disposable restore with all four siren crossing lines valid but the CH1 capability receipt removed, corrected migration 178 failed at `Verified Gateway lighting capability is unavailable` (psql exit 3). The preexisting disabled policy remained the only policy, enabled count 0, and authorization-audit count 0. With the same five synthetic sources, valid crossing lines, and a completed capability receipt, targeted migrations 170, 178, and 181 all exited 0: five distinct policies, only CH1 enabled, one CH1 activation audit, signal linked to CH1, registry 275, two RLS tables, and authenticated/anon RPC grants `true/false`. The prior rollback restore of the before snapshot remains applicable to the unchanged fixture schema and data.

After this source change, the fresh source-only runner was executed again in a new disposable project: 275/275, registry 275, Home Site absent, enabled automation 0, RLS tables 2, grants `true/false`, and ACL-preserving scoped restore PASS. Its sanitized 275-line log and receipt are in ignored Kingston cache `.dev-cache/tmp/observer-zero-overlay-ed6be5d4/`; scoped backup SHA-256 `62ed811b008e7d5a7617e8bdc90ff5c0daaa9f120dbea1b321814945420daacf`. Temporary QA forwarding was closed and q275 was cleanly stopped.

This corrects the observed partial **policy activation** on a missing prerequisite. It does not make two historical migration files one transaction, prove all future inter-migration failure modes, or qualify real Home data. An operator must still preserve and compare a before snapshot when applying historical migration changes to a data-bearing environment.
