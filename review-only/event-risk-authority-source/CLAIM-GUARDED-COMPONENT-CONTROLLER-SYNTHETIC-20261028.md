# Guarded component restore controller — synthetic-only qualification

Date: 2026-10-28 (Asia/Jerusalem). Scope: review-only, local synthetic QA. This is not an independent restore of the five original Development backups, an atomic cross-store snapshot, or a migration-ready recovery procedure.

## Result

- `component-restore-controller.mjs` sequences a fresh isolation proof, exact five-component ciphertext receipt verification, authenticated decrypt, Storage tar validation before extraction, restore verification, and mandatory cleanup. It returns `NO_GO` on missing evidence, adapter failure, deadline, or cleanup uncertainty. Its direct CLI exits with `REAL_RESTORE_ADAPTER_NOT_IMPLEMENTED`.
- The synthetic guest runner is wired to this controller. Synthetic ciphertext and its receipt are staged separately from plaintext; the plaintext target is on its disposable AES-256 scratch image. The decrypt bridge accepts only marked synthetic source/target directories. Guest restore containers, target volumes, guest plaintext staging, host plaintext staging, and the scratch image have distinct cleanup checks.
- Focused offline tests: 36/36 PASS. These cover receipt mismatch, wrong key, authenticated-content corruption, source/target alias, stale isolation proof, post-globals adapter failure, cleanup/detach-adapter failure, residual plaintext, actual `age` decrypt into a disjoint synthetic target, and blocked real-data CLI. JavaScript syntax, Python AST parse, and `git diff --check` passed.
- The disposable guest integration rerun is **BLOCKED / NOT RUN**. The sandboxed attempt failed at `hdiutil create` before VM or PostgreSQL startup and reported `scratchCleaned: true`. Escalated execution was rejected by auto-review because the runner references the canonical `gbi` Docker socket and contains SQL writes, even though code inspection shows that socket is used only for image inspect/save and the SQL writes target a synthetic isolated guest. The rejection explicitly prohibited indirect bypass. No attempt to bypass it was made.
- Previous successful full synthetic five-component `age` restore evidence remains in `CLAIM-FIVE-SYNTHETIC-AGE-FULL-RESTORE-20261028.md`; it predates this controller wiring and does not validate the newly wired guest path.

## Evidence boundary and next qualification

The controller's test doubles establish fail-closed ordering, not PostgreSQL durability, guest detach, or real-backup recoverability. A fresh execution of the newly wired disposable guest path requires a policy-compliant environment/approval that permits the synthetic runner without the rejected access pattern. Until then, mark integrated controller-in-guest proof `BLOCKED`; do not infer it from the previous successful guest run or the 36 offline tests.

No original backup, recovery identity, clipboard secret, Production/Home service, original Development database, remote Git branch, or cloud provider was touched. No SQL was executed by this turn. No real-data restore adapter exists.
