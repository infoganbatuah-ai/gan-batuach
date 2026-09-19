# GB-M32 — Management documents, private access and retention

Date: 2026-09-20. Branch: `codex/gb-m32-documents`. Development base: `3105b440383ea235abde76aa62f2727823fa31ee`. Production remains unchanged.

## Before State

The existing `public.documents` table represented Garden, Child and Staff documents, with a single `file_url` field. Some client panels persisted temporary signed URLs. A generic service-role upload route accepted the `documents` bucket and a client prefix. Existing RLS allowed uploader updates, creating a self-verification/tenant-mutation risk. Other domains already have dedicated evidence/attachment storage.

## Document Inventory

See [Management document inventory](GAN_BATUACH_MANAGEMENT_DOCUMENT_INVENTORY.md). No competing document table is introduced.

## Canonical Model

The forward migration extends `public.documents` with explicit private object binding, owner profile, inspection, file size/MIME, replacement linkage and deletion/retention metadata. New records stay `pending_review`. Existing rows and historical files are not rewritten by guesswork. The business entity remains distinct from communication attachments and factual evidence.

## Domain Boundaries

Persistent Garden/Child/Staff/person/inspection documents use `documents`. GB-M22/23 evidence, GB-M25 complaint files and GB-M29 attachments retain their source-specific access and lifecycle. Digital Observer evidence stays independent.

## Storage

The existing 12 MB `documents` bucket is forced private. A restrictive `storage.objects` policy denies direct authenticated access; the elevated storage client runs only behind resource authorization. New paths contain opaque UUIDs, not names. PDF/JPEG/PNG/WebP content signatures and declared MIME are checked, with a 12 MB server cap. This is signature validation, **not** malware scanning; scanning is `unavailable/not_configured`.

## Upload

The multipart API checks account, category, Garden and entity authority before any upload, generates the object path server-side, and calls a guarded registration RPC. The RPC rechecks scope and object existence, atomically links a replacement and writes audit. On registration failure the route attempts object removal; failed cleanup requires orphan reconciliation. The generic elevated upload route no longer targets `documents` or `inspection-reports`.

## Signed Retrieval

`/api/documents/[id]/file` queries the document under the caller's RLS, logs the private read, and then issues a 60-second signed URL. IDs and storage paths from the browser never become storage authority. Legacy noncanonical `file_url` values are hidden in updated document views pending provenance review. A live signed URL expiry/anonymous raw-object test remains necessary.

## Categories

The server registry binds each supported category to exactly one entity type. Garden, Child, Staff, Teacher, Owner, Guardian and inspection categories are explicit. Category existence does not prove a legal requirement; workflow-required policy remains domain-specific until reviewed.

## Verification

Upload remains pending review. A transactional RPC allows authorized Garden management to review eligible Garden/Child/Staff/Guardian documents and Platform Admin to review Garden/Owner/Teacher/inspection documents. The uploader cannot self-verify. Review changes and rejection reasons are audited. Category-specific reviewer rules warrant controlled browser QA.

## Expiry

Server projection computes `expired` and `expiring_soon` in the Asia/Jerusalem calendar date, using the document's stored reminder threshold, capped at 365 days. Expiry never removes the object or rewrites prior verification. A bounded service-role expiry-intent producer exists and passed a retry/idempotency test; no periodic Production schedule is activated. Operational scheduling remains a release follow-up.

## Replacement / Versioning

New upload creates a new row/object. A row lock on the prior document permits only one current replacement; the previous row remains with its review and expiry history. Separate-connection replacement-race evidence remains open.

## Notifications

Review and the bounded expiry scan create privacy-safe in-app notifications through GB-M30 `notifications`, with source domain `documents`. The expiry scan rechecks active recipient relationships and deduplicates by document/stage. No external provider is called. Production scheduling is open; GB-M31 provider delivery is not claimed.

## Garden

The existing Garden upload panel uses the canonical upload route; the Garden document screen now evaluates expiry server-side and uses active Garden context.

## Staff

Staff document/background screens use GB-M19 active employment, so Garden A and B stay separate. Qualification upload never implies verified qualification or employment activation.

## Child / Parent

Child documents require a canonical Child/Garden binding. Parent reads follow the existing guardian/Child authorization helper. A medication approval reference must point to an authorized canonical private Child document. Other families and ordinary Staff cannot browse Child documents.

## Inspector

Only an approved, assigned Inspector may see selected Garden-level categories and inspection-scoped documents. This does not grant generic Child, Staff or message access.

## Admin

Admin Garden-level visibility and review are explicit; sensitive Child/Staff rows are not a blanket browse privilege. File access is audited.

## Retention / Deletion

An authorized actor may request logical deletion. Physical purge is Admin-only and requires an explicit request, elapsed `retention_until`, and no legal hold; it tombstones the row before object removal and is retryable. No retention duration is invented. Without an approved category schedule, purge remains blocked. Existing Garden/Child/Staff/Parent/Inspector foreign keys previously cascaded document-row deletion; the migration changes them to `RESTRICT`, so source deletion fails closed until document retention/storage handling is complete. Production migration planning must account for constraint locks/validation time and a current restore path. Existing privacy/forgetting workflows still need a documented retention mapping and Storage cleanup before activation.

## Access Audit

Upload, review, deletion request and signed private read record actor, context and timestamp without signed token. Purge records a separate audit event. Audit/storage partial failure is surfaced and requires reconciliation.

## Security / RLS

Direct document updates/inserts are removed for authenticated users; registration/review are guarded RPCs. Private-row read checks Child guardian, active Staff employment, current Garden management and approved Inspector assignment as appropriate. An isolated synthetic direct-RLS matrix covers Parent A/B, Manager A, multi-Garden Staff, Inspector A and Admin; it passed in a rollback transaction. Production RLS and Storage remain unverified.

## Concurrency

Replacement locks the old document row and rejects a second replacement. Independent-connection race proof and object-cleanup race proof remain open.

## Storage Cost

No new provider or fixed paid resource. Scenario assumption: two retained 2 MB documents per active user, no versions, 4 MB/user (1 GB = 1,000 MB for approximate billing). At 100/1,000/10,000/100,000 users this is 0.4/4/40/400 GB. [Supabase Storage pricing](https://supabase.com/docs/guides/storage/pricing) lists 100 GB included on Pro, then $0.0213/GB-month; modeled overage is $0/$0/$0/$6.39 monthly, before egress, operations, taxes and storage from other domains. At the [Bank of Israel 18 September 2026 USD rate of ₪3.028](https://www.boi.org.il/en/economic-roles/financial-markets/exchange-rates/), the last scenario is about ₪19.35 monthly, or ₪0.00019/user. [R2 pricing](https://developers.cloudflare.com/r2/pricing/) is $0.015/GB-month plus operations, but no R2 move is proposed. AWS is not added. This is a scenario, not invoice evidence or proof of the all-in ₪15 ceiling.

## Monthly Cost Delta

New fixed incremental commitment: **₪0/month**. Supabase Storage variable increment depends on actual retained bytes, egress and plan headroom; current Production usage/invoice allocation was not available in this isolated QA. R2: ₪0; AWS: ₪0; scanning provider: ₪0 (not configured). No all-in cost compliance claim is made without the supplier ledger and real paying-user denominator.

## Tests

Focused policy/signature tests (5/5), the Management source suites (233 tests), domain QA (29 suites), security QA (7 suites), migration health (235 ordered files), typecheck, Production-mode build, lint regression, release-contract preflight, and dependency install/audit (zero reported vulnerabilities) passed on the feature worktree. The final migration and synthetic direct-RLS matrix passed in a rollback-only transaction against the verified local Development Postgres. Raw object access was denied at the database policy layer. HTTP signed retrieval, separate-connection replacement concurrency, and cumulative Development QA remain to be recorded.

## Live QA

`LIVE DOCUMENT QA: BLOCKED BY ENVIRONMENT` until controlled role sessions and isolated private Storage upload/retrieval flow are verified. No customer document was used.

## Carried QA Debt

GB-M21–M31 live browser/provider/hardware debt remains in their own reports/ledgers. GB-M29 Production is deferred; this report does not close those gates.

## Remaining Debt

Approve/activate expiry scanning cadence, category-specific retention and required-document policy, legacy URL provenance audit, controlled private Storage E2E, separate-connection replacement race, secure deletion reconciliation, malware scanning decision, and Development integration/CI. These are explicit release blockers if still open at final validation.

## Inputs For GB-M33

Consume canonical document IDs and status projections, not raw storage paths or legacy signed URLs. Preserve separate attachment/evidence lifecycles and audit context.
