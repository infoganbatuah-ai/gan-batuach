# Parent Documents read-state correction — source-prepared handoff

Task: `GB-PRODUCT-PARENT-DOCUMENTS-READ-STATE-20261107`

Owner: Gan Batuach Product executor; one Development integration owner

Source branch/worktree: `codex/product-parent-documents-read-state-20261107` / `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/worktrees/product-parent-documents-read-state-20261107`
Verified source Development SHA: `c3507c3f07ca5a78ebf037b7cb596518708efa96` (remote and clean local canonical worktree agreed before the isolated branch was created).

## Behavior and scope

The Parent family Documents route used `documentsRes.data ?? []` without considering `documentsRes.error`. A failed read therefore appeared as an ordinary empty list. The family-context read also exposed upload targets even when `sourceUnavailable` signaled incomplete/failed context data. The route now presents an accessible, explicit unavailable message when the document read fails; it does not render the normal Documents workspace and its empty-state count in that case. When only family context is unavailable, already returned RLS-scoped document rows remain visible, a warning explains the limitation, and upload targets are withheld. Valid empty and populated reads continue through the existing family Documents workspace. `requireRole(["parent"])` still runs before the client/query path.

Only `app/dashboard/parent/documents/page.tsx`, a focused synthetic fixture `scripts/qa/check-parent-documents-read-state.mjs`, this report and the two Development integration ledgers belong to this unit. The shared Documents component, family model, Parent primary dashboard, API, queries, schema, RLS, grants, storage, auth, provider settings, packages and Digital Observer core are unchanged. The document query remains ordered and limited to 100 rows. The app uses the installed Next server-component error-handling guidance: expected read failure is represented as a visible state rather than a thrown raw provider error.

## Focused validation

- `node --check scripts/qa/check-parent-documents-read-state.mjs`: PASS.
- `node --test scripts/qa/check-parent-documents-read-state.mjs`: 5/5 PASS. The fixture transpiles and executes the **actual page component** against synthetic in-memory imports/query results. It observes valid empty, populated and protected file-link behavior; failed document read without a false empty workspace; family-context failure with rows retained but upload disabled; and role denial before data reads. No Next server, database, browser, QA identity, provider or Product data was used.
- `git diff --check`: PASS on the scoped Product diff.
- Existing Development ledger schema checker against the feature branch's JSON and unchanged migration ledger: PASS, 212 units, zero schema errors. This does not imply release eligibility.

This is source and fixture proof only. Typecheck, lint, build, six exact-head CI gates, authenticated browser/RLS, accessibility visual review and cumulative Development QA remain pending. No `npm` install, Next startup, provider call, migration, main merge or Production deployment was performed in this unit. The earlier Parent selected-child/dashboard post-merge runtime status remains **`POST_MERGE_RUNTIME_UNVERIFIED`**, with its separate private diagnostic at `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/parent-selected-child-documents-postmerge-6e9895ff/STATIC_RUNTIME_DIAGNOSIS_c3507c3f.md` (SHA256 `f96e803e12bae0b07994adcf3aee63a053170358c3f086f71112c3882b24b7a6` at source preparation). This source correction does not supersede that browser gap.

## Risk, cost and next gate

Affected journey: Parent family Documents list and upload readiness. Data: existing Parent/Garden/Child documents, with no new collection or storage. Tenant and role isolation still depend on the existing user-scoped Supabase client and RLS; the fixture is not live RLS evidence. There is no new paid dependency, provider activation, request, stored object or fixed monthly commitment. Rollback is the scoped route commit on this feature branch; no migration exists. Production remains untouched.

Source commit `56abad3a8f34acc8178c1a4febd76544fce0a7aa` (tree `aead539227d4be5c2c3be53fc85f8637e6cfb634`, parent `c3507c3f07ca5a78ebf037b7cb596518708efa96`) is remotely preserved at the exact feature ref. A Vercel project lookup for that SHA after push returned zero deployments; this is observed deployment history, not a full readback of every live Git trigger setting. The JSON/Markdown Development ledger entries on this feature branch record `PUSHED_REMOTE` source preservation and explicitly pending CI/integration. They are not yet merged into the canonical Development branch.

Run the remaining exact-head CI/security and affected browser/role checks when host admission permits. Integrate only through the single Development owner after required gates pass. Do not begin RELEASE-GAP-01 or merge to main.
