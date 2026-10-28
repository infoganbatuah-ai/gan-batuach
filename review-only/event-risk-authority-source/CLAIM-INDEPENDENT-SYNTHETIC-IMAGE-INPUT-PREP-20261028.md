# Independent synthetic PostgreSQL image input — offline preparation

Date: 2026-10-28 (Asia/Jerusalem). Branch: `codex/event-risk-effect-acl-review-20261026`. Review-only local QA. No original backup, owner key, database, provider, or guest runtime was accessed in this unit.

## Exact dependency removed

The prior disposable-guest runner used the canonical `gbi` Docker socket only for `image inspect` and `image save`, then loaded that archive into the isolated guest. That socket dependency has been removed from this runner. The runner now requires explicit `--qa-image-tar <absolute-path> --qa-image-sha256 <64-lowercase-hex>` input and verifies the private regular file and digest **before** it creates any scratch target. The path must not resolve inside the original Development tree or repository. Symlinked or hard-linked final files, mismatched digests, changed files, non-private files/directories, and inputs above 2 GiB fail closed.

The verified archive is copied into the encrypted scratch target only after local guest isolation checks (no host mount/proxy, IPv4/IPv6 output and forwarding denial, denied egress probes) and a capacity check for both image copies plus 1 GiB reserve. The copy is rehashed before local guest transfer. Guest Docker uses `image load` and verifies the exact pinned `public.ecr.aws/supabase/postgres:17.6.1.167` image ID `sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb`; PostgreSQL version 17.6 is checked in the guest. Container runs retain `--pull never` and `--network none`. No provider image pull or billable cloud call is added.

A SHA-256 digest proves byte identity, **not** that the archive was created in an independent QA environment or that its layers contain no source data. Provenance remains an owner/operator attestation and must be checked before any authorized guest execution. No archive was supplied or assumed to exist in this unit.

## Validation and limits

- Focused local tests: 43/43 PASS (the prior 36 plus explicit input/digest/path/security/capacity gates and no-guest-proof NO-GO). JavaScript syntax and `git diff --check` PASS.
- Static inspection confirms this runner no longer opens the `gbi` Docker socket, exports a source image, or invokes a network pull. This is source-level evidence, not a live guest or provider observation.
- **New guest execution: BLOCKED / NOT RUN.** The previous auto-review rejection remains in force; this change was not used to retry or indirectly bypass the denied run. The previously passed synthetic full guest restore predates both controller wiring and this input change. The real Development five-component capture remains `COMPONENT_BACKUPS_ONLY`, `independentRestore=NOT_RUN`; current rollback and cross-store atomicity are unproven.

## Precise input required for a future approved test

Supply a pre-existing `docker save` archive of the exact pinned PostgreSQL image from a separately approved, synthetic-only QA engine (not `gbi`, not a Development/Production volume), in a user-owned private directory outside the repository and original Development tree, plus its SHA-256 digest and an independently reviewed provenance statement. A separate policy-compliant approval/environment is still required before running the guest test; the archive and digest alone do not authorize retrying the rejected script. No owner recovery key or original backup is needed for this synthetic step.

Next action after those inputs and approval: run the modified disposable guest once, verify the new controller result and encrypted-target cleanup, and keep NO-GO if any evidence or cleanup check fails.
