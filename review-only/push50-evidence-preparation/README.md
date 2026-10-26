# PUSH 50 — local evidence index (preparation only)

This is a mechanical navigation aid for PUSH 39, 40, 43, 44 and 45, **not** a
data room, an activation receipt, a migration or a PUSH 50 PASS. It does not
change the 52-PUSH roadmap or 197 North-Star capability identities. The JSON
index points to exact local commits and tracked files. Some tracked Markdown
reports are omitted by this worktree's sparse checkout; `git show HEAD:<path>`
reads them without changing the checkout. `node
scripts/qa/check-push50-evidence-index.mjs --self-test` checks object presence,
unchanged blobs, review guards and deliberately open external gates. It does
**not** execute the referenced QA scripts or reperform their historical tests.

| PUSH | Local evidence class | Still open |
| --- | --- | --- |
| 39 | Source tests and recorded disposable PostgreSQL dispatch transaction | Canonical RLS/Data API, provider reconciliation and real delivery/action receipts |
| 40 | Source tests and recorded disposable PostgreSQL refund transaction | Canonical RPC qualification, prices, provider/legal approval and settlement |
| 43 | Source tests and recorded disposable PostgreSQL brand transaction | Real approved partner, external provisioning and commercial proof |
| 44 | Source tests plus historically recorded owner-confirmed physical iPhone control-plane results | Physical device-proof enrollment, real cellular video, APNs, Android and release |
| 45 | Source tests, counsel handoff and retention engineering baseline | Written scoped legal/privacy decision and owner activation |

The guarded SQL packages stay under `review-only/` and **NOT_APPLIED**. Their
synthetic PostgreSQL fixtures do not prove actual Development RLS, role
inheritance, PostgREST/Data API exposure or Production behavior. The bounded
catalog receipt identifies effective Development privileges but not row-level
application access for proposed RPCs. `PUSH 44` remains `PARTIAL`, Native
Access `BLOCKED`, Guard `OFF`, retention v1 `ENGINEERING_BASELINE` only, and
`PUSH 46` not started. A prior unrelated typecheck was blocked by Capacitor
dependencies; this documentation-only unit does not relabel it PASS.

Cost proof is absent here. Preserve both distinct measures from `DO-NS-196`:
`infrastructure cost / registered users` and the owner-policy ceiling measure
`all-in attributable cost / active paying users`. Neither amount nor paying
user denominator has been reconciled by this index.

Only a later, separately authorized process may apply schema/ACL changes,
activate providers or real data, obtain external legal or hardware proof, or
assemble an independently reviewable diligence data room. This commit is local
only pending the separate preservation/integration workflow.
