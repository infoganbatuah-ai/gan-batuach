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

## Local dependency and notice inventory

`LICENSE-INVENTORY.json` is a mechanical, SHA-256-pinned supplement to the
existing high-level `DIGITAL_OBSERVER_RUNTIME_DEPENDENCY_INVENTORY.md`, not a
second runtime architecture inventory. Run `node
scripts/qa/check-push50-license-inventory.mjs --self-test` to compare it with
the tracked local source blobs; the generator reads sparse-hidden files via
Git and does not install packages or use the network. Its sources are the
single tracked npm v3 `package-lock.json`, the matching root `package.json`,
the tracked `vendor/braces` manifest/license/provenance and the Connector's
`THIRD_PARTY_NOTICES.txt`. No second tracked package-manager lockfile was found.

The lock has **895 entries**: 24 direct runtime, 11 direct Development, 859
other indirect locked entries and one local link target. Indirect includes
transitive, peer or optional entries; the root declaration alone does not
identify each cause. The linked `braces` entry has no license/version in that
entry, but its tracked local target provides both; the two entries remain
separately visible. `limiter@1.1.5` has no license metadata in the lock and is
**UNVERIFIED**. Only `vendor/braces/LICENSE` is a tracked per-package license
path, so 893 lock entries have no per-package notice *tracked in this repo*;
that does not mean their installed packages lack license files. The Connector
notice names four components without exact binary versions or a complete
release-by-release redistribution check. The validator rejects stale source
hashes/counts, invented notices or license metadata, and false
`LICENSING_CLEARED` claims.

This is **not** a current CVE scan, IP opinion, legal clearance, inventory of
every runtime/provider binary, or approval to distribute Connector packages.
`LICENSING_CLEARED=false` remains binding until exact shipped artifacts,
license files/notices and qualified review are reconciled. No costs or supplier
terms were inferred from lockfile metadata.
