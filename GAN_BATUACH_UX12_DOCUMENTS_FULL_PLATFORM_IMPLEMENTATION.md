# Gan Batuach Management — UX-IMPLEMENT-12 Documents Full Platform

## Status

- Source integration head: `53843ce0a604774091f1b0601f0f12913f0fc004`
- Source branch: `integration/development`
- Feature branch: `codex/ux-implement-12-documents`
- Validated product commit: `fb710f76ff05fee7188b34fb087a274d66602825`
- Environment: isolated Development / Integration
- Production: untouched
- `main`: untouched
- New migration: none
- New paid dependency: none
- New fixed monthly commitment: `₪0`
- Digital Observer core diff: `0`

## Domain separation

The Documents domain continues to use the canonical private `documents` model and `management-documents` Storage bucket. It remains separate from:

- messaging attachments and their thread authorization;
- inspection, finding, and remediation evidence;
- candidate-only recruitment documents before employment activation.

The former `/dashboard/admin/document-center` aggregation now redirects to the canonical Documents Center instead of combining these domains.

## Route map

| Role / capability | Route or surface |
|---|---|
| Owner / Manager Documents Center | `/dashboard/garden/documents` |
| Parent linked-family documents | `/dashboard/parent/documents` |
| Active Staff professional documents | `/dashboard/staff/documents` |
| Candidate recruitment documents | `/dashboard/staff/documents` → existing candidate document flow when employment is inactive |
| Inspector assignment-limited documents | `/dashboard/inspector/documents` |
| Admin authorized verification queue | `/dashboard/admin/documents` |
| Legacy admin entry | `/dashboard/admin/document-center` → `/dashboard/admin/documents` |
| Authorized list and upload contract | `GET/POST /api/documents` |
| Signed document retrieval | `GET /api/documents/[id]/file` |
| Backend-authoritative review | `POST /api/documents/[id]/review` |
| Retention-aware deletion request | `POST /api/documents/[id]/delete-request` |
| Guarded purge | `POST /api/documents/[id]/purge` |

## Canonical capability map

| Canonical document capability | Route / surface |
|---|---|
| Documents command center | all role Documents routes through `DocumentsPlatform` |
| Recent, action-required, pending, verified summaries | Documents hero and metric cards |
| Categories | category cards for Garden, Children, Parents, Staff, and inspection scope |
| Search and filtering | responsive search, status filters, and category filters |
| Document list | Desktop master list and Mobile document cards |
| Document detail | selected-document metadata workspace and Mobile full detail |
| Secure preview / download | same-origin `/api/documents/{id}/file`; server issues bounded signed access |
| Upload | canonical `uploadManagementDocument` client contract and `/api/documents` metadata flow |
| Replacement | canonical upload flow with `replacesDocumentId`; history is preserved |
| Verification and rejection | existing `DocumentReviewActions` and server review endpoint |
| Expiry and replacement status | shared `effectiveDocumentStatus` policy |
| Version / replacement history | relationship metadata already present in the canonical model |
| Child documents | Garden and linked Parent targets, constrained by RLS |
| Parent / Guardian documents | linked-family surface, constrained by RLS |
| Staff documents | active-employment Garden and Staff scope |
| Garden documents | active server-authorized Garden scope |
| Inspector documents | inspection-assignment and compliance scope only |
| Admin oversight | authorized Garden, Owner, Teacher, and inspection queue only |
| Empty, unavailable, and error states | shared premium state cards and upload feedback |

## Components

- `components/documents-platform.tsx`: reusable Desktop and Mobile Documents workspace.
- `app/styles/ux-implement-12.css`: responsive RTL layout, cards, preview, upload dialog, touch targets, focus styles, and reduced-motion rules.
- `components/document-review-actions.tsx`: existing server-authoritative verification and rejection actions.
- `lib/management/document-policy.ts`: canonical type/category and effective-status policy, including a safe pending fallback for incomplete legacy metadata.

## Role and permission matrix

| Role | Read scope | Upload scope | Review scope |
|---|---|---|---|
| Owner / Manager | active Garden documents allowed by RLS | active Garden, its Children, its Staff, and permitted teaching identity | permitted Garden records not uploaded by the same actor |
| Parent | own and linked-family documents allowed by RLS | linked Children and own Guardian context only | none |
| Active Staff | own Staff record in the server-validated active employment Garden | own active Staff record | none |
| Candidate | existing candidate-document system only | own candidate profile | none |
| Inspector | documents explicitly visible through inspection assignment / policy | active assigned inspection document target | none in this UX surface |
| Admin | canonical administrative document scope | no broad client-side bypass | permitted Garden / Owner / Teacher / inspection records only |

Every page queries through the authenticated Supabase session. No service-role client, public URL, storage key, or client-only Garden context is exposed.

## Document state map

| Canonical state | Presentation | Next action |
|---|---|---|
| `missing` / required | action-required red state | upload |
| `uploaded` / `pending_review` | amber pending state | wait for authorized review |
| `valid` / approved | verified green state | secure open/download, replace when permitted |
| `rejected` | rejected state with safe reason | replace and resubmit |
| `expired` | expired state | renew / replace |
| `expiring_soon` | warning state derived from canonical expiry policy | replace before expiry |
| replacement required | action-required composition | upload replacement |
| `replaced` | retained in history, excluded from the active list | view version relationship |
| unavailable / access failure | truthful unavailable state | retry or request access |

`uploaded` never implies `verified`. Verification remains backend-authoritative and the original record remains in history after replacement.

## Categories

Only canonical document types are exposed: Garden documents, safety and health certificates, insurance, camera approval, regulatory documents, Staff documents, qualifications, training, first aid, police clearance, background checks, teacher certificates, Owner documents, Child documents, medical approvals, Guardian documents, and inspection documents.

No arbitrary category tree or new regulatory requirement was introduced.

## Signed-access model

The UI receives only the same-origin file route. `/api/documents/[id]/file` rechecks the authenticated user and canonical RLS scope, then obtains short-lived private Storage access. Raw bucket paths and permanent public URLs are not rendered in page data or the browser UI. Unsupported, expired, denied, or missing content receives a truthful unavailable response.

## Upload and replacement flow

1. The role page supplies only canonical targets already authorized by the server session.
2. The user selects an allowed canonical document type and file.
3. The shared upload contract validates type and size and uploads to the private bucket path.
4. Metadata is created through the canonical Documents API.
5. Replacement passes the existing document identifier and preserves the previous record.
6. The new item returns to pending review according to backend policy.

Accepted UI guidance is PDF, JPG, PNG, or WEBP up to 12 MB. Signature validation, authorization, and final limits remain server-authoritative.

## Verification and expiry flow

Authorized review uses the existing server action and audit model. The UI displays safe rejection reasons and timestamps where available; it does not manufacture verifier identities or audit events. Effective expiry uses the canonical Jerusalem-date policy and configured reminder window. Legal validity periods are not invented in the frontend.

## Desktop behavior

At `1440×1024`, the Documents Center uses a premium command-center composition: hero metrics, category cards, search/status controls, a master list, and a focused detail / secure-preview workspace. Action-required records are prioritized without flattening the full library into a file table.

## Mobile behavior

At `390×844`, the product uses a dedicated card list, full-screen detail state, category/status chips, bottom navigation from each role shell, and an upload/action dialog sized for touch. It does not compress the Desktop split workspace or require horizontal scrolling.

## Accessibility and RTL

- Native labels and named controls for search, filters, file selection, open, download, upload, replace, and close.
- Keyboard-reachable rows and actions with visible focus.
- Status text and icons in addition to color.
- Dialog semantics, focus placement, live feedback, and disabled submission state.
- Minimum mobile touch targets and no horizontal overflow at `390×844`.
- RTL layout with readable file extensions, sizes, dates, and mixed-language names.
- Reduced-motion rules for transitions and progress feedback.

## Visual references

| Reference | SHA-256 |
|---|---|
| `GB_UX_REF_DOCUMENTS_FULL_PLATFORM.png` | `7fa886abf1f1db659f97dd5b9afecd9ca5d9d7399cf0c8d9f630a7a476b2ae77` |
| `GB_UX_REF_OWNER_CORE.png` | `ddf4744b5c28da7185c6b7e2a72bf8e0d5e73a17c290bf639d24c118be6c0564` |
| `GB_UX_REF_PARENT_FULL_PLATFORM.png` | `bf9ee24689f0c7dceeed1c0e894dff6a4357f471e7c1e1ea0bda00359328d3d4` |
| `GB_UX_REF_STAFF_FULL_PLATFORM.png` | `4026a8eb545dc27cb95dacb8a7375a539ba82e6aaa74b2fdb57266114bf9662b` |
| `GAN_BATUACH_BRAND_MARK.png` | `4f914d04cf16061b831782d6d53b3f67259f3f88365cb123b641887917eea5ce` |

The primary reference was found at the exact-name Desktop design folder after the initially supplied Downloads path was unavailable.

## Visual QA evidence

- Evidence root: `qa-evidence/ux-implement-12/`
- Desktop contact sheet: `contact-sheet-desktop.webp`
- Mobile contact sheet: `contact-sheet-mobile.webp`
- Reference comparison: `reference-comparison-board.webp`
- Machine-readable report: `visual-report.json`
- Screen report: `visual-report.md`
- Concepts: `20`
- Captures: `40`
- `OWNER_REVIEW_READY`: `40`
- `NEEDS_POLISH`: `0`
- `VISUAL_DRIFT`: `0`
- `BROKEN`: `0`

The pack covers Documents Center, list, detail, secure preview, upload, replacement, verified, pending, rejected, expired, replacement-required, Child, Parent, Staff, Garden, Inspector-limited, Admin verification, categories, search/filter, and empty states on both required viewports.

## Functional and security QA

Passed locally on the feature head:

- UX-12 focused contract: 6/6.
- Management Documents contract: 6/6.
- Private-document live E2E: scoped upload/read, denied roles, private Storage, signed expiry, retention/hold, and idempotent purge.
- Replacement concurrency: exactly one current version.
- Synthetic document RLS matrix: PASS.
- Storage policy safety: 6/6.
- Parent/Manager contract: 23/23.
- Inspector UX-09 regression: 8/8.
- Messaging UX-11 regression: 8/8.
- TypeScript: PASS.
- ESLint regression gate: zero regressions.
- Production build: PASS, Next.js 16.3.8, 539 pages.
- Domain gate: 30/30.
- Security gate: 10/10.
- Migration health: PASS, 244 migrations, no UX-12 migration.
- Release contract: PASS; Production mutation false.

The screenshot fixtures used isolated synthetic Development identities and twelve bounded UX-12 document rows. Those twelve rows were removed after capture; existing QA personas and all pre-existing data were preserved.

## Deviations

No material visual deviation remains. The reference’s sharing treatment is implemented as authorized secure open/download because canonical Documents does not provide public or permanent sharing links. Inspection evidence stays in its own domain. Candidate documents stay in recruitment until employment activation. These differences preserve canonical security and domain boundaries.

## Release boundary

This batch is for `integration/development` only. It does not merge to `main`, deploy Production, run Production migrations, change Production data, activate a provider, or modify Digital Observer core.

`APPROVED GAN BATUACH VISUAL LANGUAGE PRESERVED: YES`

`UX-12 OWNER VISUAL ACCEPTANCE READY: YES`
