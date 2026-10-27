# Original Development migration metadata: source-only reconciliation

Status: **SOURCE/RECEIPT MATCH; NOT SCHEMA OR DATA READINESS**. No SQL was executed for this report and no database, migration, service, provider or Git remote was changed.

## Evidence and method

- Coordinator supplied a bounded metadata-only, `BEGIN READ ONLY` extract of `development_metadata.migrations` from the identified original local Development/Integration database. The local, separately held snapshot is `work/development_migration_ledger_snapshot_20261027.json` in the spec-3 workspace; SHA-256 `f2a91fd9e3eea0b83aadcfd484a43489bd0640b76c74f33de13be8aa68e4fe2e`. This task checked that hash before reading it. The snapshot contains 30 migration metadata records, not user rows or SQL results for the schema itself.
- The project migration application mechanism in `scripts/development/apply-development-migrations.mjs` hashes the exact `git show HEAD:<migration>` source with SHA-256, writes `source_digest` and `source_commit` to `development_metadata.migrations`, then records a post-apply `schema_fingerprint`. `scripts/development/bootstrap-baseline.mjs` records historical migrations separately as `development_metadata.baselines.source_mapping`; the tracked baseline manifest has 227 historical source mappings. This task did **not** read the live baseline row or recompute a live database fingerprint.
- Compared all 30 snapshot versions, paths, digests, source commits and fingerprint *receipts* with `DEVELOPMENT_MIGRATION_LEDGER.json`, exact Git blobs at those commits, the owned worktree files and the locally available `origin/integration/development` ref at `aea078ce67cf3061be5f0a6c314545dcc533a85d` (no remote fetch in this task). Compared all 227 historical manifest hashes/blobs with its pinned source integration SHA and that same ref. Checked unique version inventory and branch ancestry. Reproducible read-only check: `run-development-migration-ledger-source-qa.mjs`, invoked with the separately held snapshot path and its pinned SHA-256.

## Exact result

| Scope | Result | Limit |
|---|---|---|
| Post-baseline Development receipts | **30/30** unique versions and filenames; exact source bytes at receipt commit, owned worktree and integration match all 30 `source_digest` values. Ledger history digests, integration commits, Git blobs, `developmentApplied: YES` status and recorded schema-fingerprint strings match all 30. Latest receipt version `20261023161928`. | Matching fingerprint *strings* is not a fresh recomputation against the live schema. |
| Historical baseline | **227/227** source SHA-256 and Git blobs match pinned baseline source and current integration; baseline `schema.sql` matches the manifest's own SHA-256. | These 227 are a transformed baseline mapping, not 227 individual post-baseline migration-history rows or evidence of historical SQL replay. Live baseline row/fingerprint was not queried in this task. |
| Full tracked source inventory | 227 + 30 = **257 distinct** migration versions and exactly the 257 SQL files in the locally available integration ref; no overlap or source-byte mismatch found. | The remote server was not queried afresh. This is source/metadata reconciliation, not a new RLS, index, FK, data, or Production verification. |

There are 271 ledger entries overall; the 257 integrated SQL files are the exact scope of this comparison. Other ledger entries were not evaluated as applied. No claim is made about Production history.

## Effect on four-key / claim order

The read-only installed-catalog receipt already reported the four exact composite unique keys, claim table and four composite claim FKs **absent**. This reconciliation does not override that finding. None of the 257 current integration migration files supplies the four exact proposed unique definitions (the existing pinned source-matrix static check verifies this). Therefore no existing applied file should be replayed or edited to create them. Any future authorized Development implementation must be a **new ordered migration** after version `20261023161928` and after independently checking current integration head, migration ledger, target identity and schema fingerprint. Install the four referenced unique keys before the claim table/FKs; a runner that wraps all SQL in one transaction cannot directly execute `CREATE INDEX CONCURRENTLY`, so a supported deployment mechanism must be reviewed separately. Do not infer that index creation would resolve null historical Site/Tenant provenance.

The four-key review-only candidate remains **NOT APPLIED**. Historical nullable scope, authoritative Model A Tenant ownership, effective ACL/RLS/Data API behavior, index-build lock/storage/cost and lossless rollback are still unverified. No adapter or Guard activation is authorized.
