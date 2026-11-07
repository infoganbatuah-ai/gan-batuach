# Candidate review audit-role dependency — isolated Development

Task: `GB-DB-CANDIDATE-REVIEW-ACTOR-ROLE-20261107`
Base Development: `f6269cba934aaa37a70c32d53692f3b8c7de1854`
Branch: `codex/db-candidate-review-actor-role-20261107`
Source commit: `87ace192c7c8ab133d207d0fa296fc3aad6711f3`
Migration: `20261107165001_management_candidate_review_actor_role.sql`
Production application: **UNVERIFIED; not requested or attempted**.

## Root cause and exact scope

The existing synthetic Candidate application `704025c7-724e-4156-8f99-7a9ebd991bc8` remained `submitted` after Manager `review` returned HTTP 409. A rollback-only call against the pinned isolated Development database showed the error: `audit_logs.actor_role` has type `public.app_role`, while the existing `decide_staff_job_application` function inserted `public.current_role()::text`. The status update was rolled back with the failed audit insert; no review event or notification was committed.

Fresh `pg_get_functiondef`/`pg_proc` evidence showed the local function body exactly matches the one applied canonical migration (`source/live SHA256 f907fbfa7d0b445a02b00641bb4ee8308b6698c32c45fe3ccf92186c2526f6d1`). The function is owned by `postgres`, returns `jsonb`, uses `SECURITY DEFINER` and `search_path=public`, with existing execute ACL `{postgres, authenticated, service_role}`. `public.current_role()` itself returns `app_role`; the erroneous `::text` occurs exactly once. The private source-metadata receipt SHA256 is `da7bab2784b773afb058ef437b2f8a3f29911c5d2bbc54b813ee8c2385d06581`. The exact before definition is backed up privately at `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/db-candidate-review-actor-role-20261107/function-before.sql`, SHA256 `2d6479986fa718adfabbead6568473b39c444ff0fac70167248a29607671068a`.

The new ordered migration uses `CREATE OR REPLACE FUNCTION` with the **same signature, return type, owner-preserving application role, security mode, search path, ACL and state machine**. Its body differs from the live/canonical body by exactly one token: `public.current_role()::text` becomes `public.current_role()::public.app_role`. No `DROP`, table/column, RLS, role, grant, data backfill or provider change. The migration was generated with the pinned Supabase CLI 2.117.0 using external `SUPABASE_HOME` and disabled telemetry. Migration blob `31ebd34716644a50f63fed03ed30c049468d2ede`; SHA256 `ad98d8375de38f46a24b25d510b47058c7c7affa6944fceebf4e4f8dfcd01589`.

## Pre-application verification

Canonical Development Git, ledger and isolated migration history agreed at 259/259 before the new migration. `npm run qa:migrations` passed with 260 ordered files, no duplicate timestamp and no new destructive migration. Focused function-diff tests passed 2/2, existing hiring lifecycle tests 8/8, Candidate discovery tests 7/7, integration-ledger schema and release-contract preflight passed. A transaction-rollback preflight applied the new function temporarily, executed `review` as an authenticated Manager A user-session role, and observed `under_review`, exactly one `staff_application_review` audit row with `actor_role=manager`, and two application notifications **inside the transaction**. After rollback, the same application remained `submitted`, review audit count zero, notification count one. Private receipt SHA256 `7292556db3da157bc24bb62a57300ddab16c8725c6696770cdeb7e3cf142db83`. The first inspection attempt counted audit/notifications while still under authenticated RLS and therefore saw zero; it was corrected to reset the readback role after the authenticated action. That failed measurement persisted no change and is not called PASS.

Data model and retention are unchanged. The existing audit event belongs to the Garden management workflow, contains bounded application/status metadata and uses the existing audit retention and authorization rules. This qualification uses one local synthetic application and no new provider traffic, table, file storage or recurring cost. No real Candidate personal data or secrets are included in Git. The private receipts and before-definition backup remain on the external Development volume. The local QA database is the existing isolated `gan-batuach-integration` project, pinned to its external Docker socket and 259-file baseline. Recovery is a reviewed forward corrective migration restoring the backed-up definition; do not edit an applied migration, purge audit/application rows or overwrite the local database.

## Remaining gates

The source, migration and pending ledgers were remotely verified at `origin/codex/db-candidate-review-actor-role-20261107@6deddc6f1ae55c5ec7d54e404af6590226726a8a`.

This report records **source/rollback-only** proof. Required next: exact-head CI and scoped security checks; ancestry-preserving merge into `integration/development`; apply **only** this ordered migration to the pinned isolated Development database through the canonical applicator; verify history 260/260, function metadata and role boundaries; then resume the existing Candidate application without duplicate submission. The separate Candidate branch holds the UI and browser journey. No approve/accept/employment activation. Full Product, external owner visual, invoice-backed ₪15 cost and Production readiness remain open. Digital Observer core, `main`, Production and RELEASE-GAP-01 are untouched.
