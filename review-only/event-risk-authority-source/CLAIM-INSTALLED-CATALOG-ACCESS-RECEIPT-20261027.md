# Original Development catalog access receipt — 2026-10-27

Status: **BLOCKED BEFORE SQL**. This receipt records an access failure, not an installed-schema qualification. No PostgreSQL statement, including `SELECT`, was executed against Development.

## Declared target, not runtime identity proof

`development/database/environment.json` on `integration/development` declares `DEVELOPMENT / INTEGRATION`, project `gan-batuach-integration`, Colima profile `gbi`, Docker context `colima-gbi`, container `supabase_db_gan-batuach-integration`, runtime root `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach`, and `productionAllowed: false`. `development/database/README.md` documents loopback PostgreSQL port 55422. These files establish the intended target only; they do not prove that a currently reachable process is the original database.

## Read-only preflight observed

- `colima list`: `gbi` reported `Broken`.
- `docker context show`: `colima-gbi`.
- `lsof -nP -iTCP:55422 -sTCP:LISTEN`: an `ssh` process listened on `127.0.0.1:55422`; this does not identify the database behind the forwarding process.
- `docker --context colima-gbi inspect supabase_db_gan-batuach-integration --format '{{.Id}} {{.State.Running}} {{.Name}}'`: failed with `permission denied` at the `gbi/docker.sock` Docker API. The target container ID and running state were therefore not verified.
- `pg_isready` and `psql` were unavailable in this execution environment. `ps` was denied. No alternative database endpoint was substituted, and the denied Docker access was not bypassed.

Because runtime identity and the required recovery boundary could not be verified, the approved `BEGIN READ ONLY` catalog transaction was **not started**. No VM, service, database, provider, or Git remote was changed.

## Installed catalog remains unknown

The four composite referenced keys in `CLAIM-REFERENCED-UNIQUES-SOURCE-MATRIX-20261027.json` remain `UNVERIFIED`: `site_tenant`, `signal_site`, `incident_site`, and `risk_result_scope`. Their exact installed column order, uniqueness, index validity, non-partial status, and corresponding four claim FKs were not observed. Dependent migration application, ACL, and RLS status were not observed either. Source-defined proposals and 257 repository migration files are **not** evidence of installed objects.

Next verification requires a reachable, positively identified original `gbi` Development container plus confirmed recovery boundary. Only then may a read-only transaction under the existing owner authorization inspect `pg_catalog` and migration metadata; it must not read user rows, apply changes, or fall back to another Supabase project.
