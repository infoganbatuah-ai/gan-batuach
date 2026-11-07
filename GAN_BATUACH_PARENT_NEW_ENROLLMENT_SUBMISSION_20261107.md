# Fresh Parent enrollment submission — isolated Development QA

Task: `GB-PRODUCT-PARENT-NEW-ENROLLMENT-SUBMISSION-20261107`
Source Development: `a113688df3902eec4ab1c6c83a4d943c21ad3a95`
Branch: `codex/parent-new-enrollment-submission-20261107`

## Read-only prerequisite finding

The canonical `submit_enrollment_request` function requires an authorized Child file with a birth date, no active enrollment, an accepting public Garden and an age-matching active Classroom. It returns an existing open Child/Garden request rather than creating another. The Product API also requires a verified Parent contact. These checks and RLS remain unchanged.

In the isolated `LOCAL_SUPABASE` fixtures, the four Parent A Child files with no active enrollment and age-matching Classrooms already have one Garden A request each. Other authorized files have active enrollment. Garden B is not public and has no age-configured active Classroom; the other public Gardens have no matching Classroom. A bounded read-only join found **zero** eligible Parent/Child/Garden combinations with no prior request. No preflight query changed data.

The Product child-profile route requires a numeric identity field, while the Child-registration route requires photos, identity and health/policy attestations. This task must not invent those values. The guarded global seed refuses to run when existing fixtures exist. The coordinator therefore authorized one **administrative QA fixture provisioner**, distinct from Product child creation and Parent-session enrollment verification.

## One-file fixture policy

`scripts/qa/provision-parent-new-enrollment-fixture-20261107.mjs` pins a single synthetic Child-file ID, Parent A, Garden A, nonpersonal QA name and age-compatible test birth date. The live isolated schema permits `identity_number = NULL`. The canonical `sync_primary_child_guardian_link_trigger` creates the sole active primary guardian link from the supplied Parent profile; the provisioner does not insert a link directly or disable triggers/RLS/constraints. It never creates an enrollment request, Child enrollment, payment, reservation, Auth user, profile, role, provider message, document or consent.

The tool defaults to refusal unless explicitly run with `--dry-run` or `--apply` and the exact clean feature SHA. It pins the branch, environment, project, local Docker context/container/socket and no-live-delivery configuration. It accepts either an absent fixture or an exact existing file plus one canonical link, and rejects replacement, unexpected links, requests, enrollments, missing age match or changed readiness. The one-file insert is transaction-bound with a fixed advisory lock and a read-after check. A repeat returns the same fixture. No global QA reset occurs.

Data owner: QA maintainer. Business need: prove a fresh Parent enrollment submission without altering existing requests. Sensitivity: synthetic only. Expected volume: at most one file and one guardian link. Query pattern: fixed-ID preflight/readback; no polling. Retention: protected isolated QA data and receipt until the associated journey is closed; cleanup requires a separate approved decision and must preserve evidence. Fixed monthly cost delta: ₪0.

## Pending guarded journey and publication

Before applying the fixture: commit source and focused tests; verify one exact clean feature SHA, local database drift and no-live outbound. Then run a dry-run, apply once only if the preview is exact, and verify Child/link counts. The Parent browser must make at most one fresh enrollment POST, followed by a same-intent retry that cannot add a row or notification. Stop at `submitted`. Check Parent and correct Manager readback, foreign Parent/Manager/Staff/guest denial, and zero reservation, active enrollment, payment evidence and external delivery. Record redacted receipts outside Git. Feature QA is not the canonical merged Product; repeat a no-write check after exact-head CI and Development merge.

No Product source, schema, RLS, grants, Auth, provider, payment, Digital Observer core, main or Production change is authorized here. A missing prerequisite or post-POST failure requires readback before retry, never an invented PASS.
