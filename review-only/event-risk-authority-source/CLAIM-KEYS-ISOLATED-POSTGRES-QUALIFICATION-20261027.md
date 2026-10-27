# Claim-only composite-key PostgreSQL qualification

Status: **STATIC PASS; POSTGRESQL RUN BLOCKED IN THIS EXECUTOR**. This is a unique claim-schema test, not a repeat of the previously passed Home→Risk→Effect chain. No SQL was run against any database in this task; no Development or Production data was accessed or changed.

## Prepared harness

`run-isolated-claim-keys-qa.mjs` uses the existing pinned local image name `public.ecr.aws/supabase/postgres:17.6.1.167` and creates a **new** disposable container with `--network none`, no host mounts, read-only root, `/tmp` tmpfs, resource limits, local Unix socket only, and exact-ID removal in `finally`. It never inspects or modifies any existing container, volume or database. The image's present availability and the PostgreSQL results remain unverified in this executor.

The harness asserts the two review-only SQL files abort unchanged. It then creates only four minimal synthetic referenced tables, first verifies the claim table cannot compile without the composite keys, installs the four candidate nonpartial unique indexes in their exact order outside a transaction, and attempts the guarded claim-table body inside the disposable database. Planned positive/negative probes are: eight FKs present; RLS enabled; no table privileges or SELECT/INSERT for synthetic `anon`, `authenticated`, or `service_role`; transaction rollback; valid claim and risk association; duplicate canonical key; wrong/missing/null Site/Tenant/Signal/Incident; wrong/missing Risk result and engine version; null claim scope; dependent-index drop denial; and failed concurrent-index cleanup on a separate duplicate-only fixture. The separate invalid-index probe does not touch the four referenced indexes. Fixture role behavior is not proof of actual Supabase role inheritance, RLS policy behavior or Data API exposure.

## Execution evidence and limits

- `docker image ls` against the configured `colima-gbi` Docker socket returned `permission denied while trying to connect to the docker API at unix:///Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima/gbi/docker.sock`. The denied access was not retried through another context or tool. No new container was started here.
- `node --check run-isolated-claim-keys-qa.mjs`: PASS.
- `node run-isolated-claim-keys-qa.mjs --static`: PASS — four commented candidate indexes and guarded claim FKs; explicitly says PostgreSQL **NOT RUN**.
- Existing `run-claim-migration-preflight-static-qa.mjs`: PASS, four exact candidate keys/containment; SQL **not executed**.

An authorized executor with access to the already-local image can run `node review-only/event-risk-authority-source/run-isolated-claim-keys-qa.mjs` from this exact commit. It must report the real assertion count, first failure, image identity and cleanup result. A passing run would prove only this synthetic PostgreSQL contract, not historical Home ownership, installed Development DDL, effective live grants/RLS, cost, or lossless rollback with real claims. The four candidate keys and claim schema remain review-only and **NOT APPLIED**.
