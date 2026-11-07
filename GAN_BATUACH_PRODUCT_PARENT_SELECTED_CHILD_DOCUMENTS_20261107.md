# Parent selected-child attendance and document-state correction

Task: `GB-PRODUCT-PARENT-SELECTED-CHILD-DOCUMENTS-20261107`
Owner: Gan Batuach Management Product executor
Source Development: `9ccb9235a831c318e02a12986b27e81b08e9481b`
Candidate branch: `codex/product-parent-selected-child-documents-20261107`

## Provenance and narrow scope

The owner explicitly authorized copying **only the correction** from original local commit `97b73cbd84d589b0c3e2be2588ab7371aff22b4f` while preserving its source. Its tree is `5733ae0eb14cf8e98c5511ce44d77f54ad75e1f9`; its parent is `a611767f73ac97c0c1e4fe5e050f6c66e1b268ad`. The original branch has mixed ancestry (198 commits / 206 files relative to Development) and must not be merged wholesale. The original page's pre-change blob, `505de08f418631f58988aa928d525c50cb0418d3`, exactly matches the Development baseline. The copied two-path patch has SHA256 `c32d60a4e6633f1595552a3db715f6054ebab395b0c8cf1c570098c5ed95a9a1` and stable patch ID `124339a71c1c0837c9b3383f0ae6e3098a192411`. The candidate's resulting blobs are byte-for-byte equal to the original commit: `app/dashboard/parent/page.tsx` = `3b64ce80542140e336fe3db4be54f5a98139cb68`; `scripts/qa/check-parent-selected-child-documents.mjs` = `12a5328ba3908a920c0b79a6a3e557929019bfa1`.

Only those two Product paths are changed. No schema, RLS, grant, provider, package, Digital Observer core, main or Production change is included. The original source branch remains intact and is remotely preserved at its exact SHA without force.

## Result and evidence

The Parent primary page now keeps an authorized selected child visible in the bounded four-row daily attendance summary, including when the child is beyond the first four contexts. Document-read errors display a neutral unavailable state instead of false green or verified zero, including in the action tile and metric hint. Existing child authorization and scoped queries remain in place.

The candidate script passed `node --check` and one focused run with pinned external dependencies: **20/20 synthetic assertions passed**. It exercised selected contexts 1, 4, 5 and 13; bounded order with 0–4 contexts; unauthorized selection; document errors with null/zero/stale counts and request variants; healthy document states; denied role before data reads; and selected-child query scope/order. This is a compiled page fixture with closed synthetic SDK/auth/UI leaves. It is **not** browser, API, RLS, provider or full-stack proof. The prior Staff Product receipt and 29-check Manager/Parent pickup receipt are separate evidence and were not rerun for this correction. The older Unit312 artifact is unavailable and is not PASS.

## Remaining qualification

The Vercel project can be read through the connected account without an explicit team selector; the team-scoped API path still returns 403. The repository's `vercel.json` disables Git deployments for `**` and enables only `main`. The accessible Vercel deployment history since `1790000000000` contains four `main` Production records and no non-main record. After non-force pushes, `origin/codex/push46-parent-selected-child-documents-20261106` resolved exactly to `97b73cbd84d589b0c3e2be2588ab7371aff22b4f`, and `origin/codex/product-parent-selected-child-documents-20261107` to `3882b1846512b9f09ec64ac170e06724dd55cf48`; Vercel branch and exact-SHA lookups for both returned zero deployments. The connected project summary does not expose the full live Git branch-trigger configuration, so the claim is limited to source defense-in-depth and observed no-deployment after these pushes, not an independent field-by-field provider-settings audit.

The source is now **remotely preserved, pending PR/CI/Development integration**. Required next gates: exact-candidate six CI gates, canonical quality, Management context and Snyk; one scoped ancestry-preserving PR into `integration/development`; focused post-merge Product/role checks; and final ledger closure with exact SHAs. No unit is yet integrated or release-ready.

External owner visual acceptance, complete Product/Auth/RLS QA, invoice-backed all-in ₪15 qualification, Production and release remain open. No RELEASE-GAP-01 work is authorized.
