# Candidate → Manager application review — Development handoff

Task: `GB-PRODUCT-CANDIDATE-APPLICATION-REVIEW-JOURNEY-20261107`
Source Development: `f6269cba934aaa37a70c32d53692f3b8c7de1854`
Branch: `codex/candidate-application-review-journey-20261107`
State: **BLOCKED_ON_VERIFIED_DB_FUNCTION_DEPENDENCY**. This is not a completed Product journey or Production release.

## Scoped source and observed journey

`ApplicationDecisionForm` now refreshes its server-rendered detail after a successful Manager decision. The bounded local QA runner permits only application submit, review, information request and response through authenticated Product UI, caps browser writes, records receipts on the external Development volume, and checks known-ID role isolation and no employment/external delivery. It has a resume ID so the existing synthetic application is not recreated after an interrupted run. No Auth, RLS, provider, dependency, Digital Observer core, main or Production change was made in this source unit.

The pinned LOCAL_SUPABASE backend had one complete synthetic Candidate, an existing published opening and no prior application for that pair. At feature Product source `92920193767609be7ba836e27d6efadec4adfe62`, the Candidate submitted **one** application through the actual UI: `704025c7-724e-4156-8f99-7a9ebd991bc8`. A same-key retry returned that same ID. The Manager's UI displayed the application, but its `review` action returned HTTP 409. The persisted state remained `submitted`, one notification, zero active employment and zero externally accepted delivery records. Two actual Desktop captures were recorded; Mobile and the rest of the journey have not been claimed.

The private failed-run receipts are, in order, SHA256 `38cdd03161432e933626bf2505433e89127aa01b959450cad812d2578e69a95c`, `097ff6c427ee98cf27f94f218411fcfcdd23242dd8d33804f6c58b84149d6785`, and `87a35d2b4c3ebcbfb982327f603733bf53f2cdd6b837864b308462da7d64496a` under `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/candidate-application-review-journey-20261107/`. The first two runs made no Product writes (SQL-preflight parenthesis and streaming wait were corrected). The third made one successful submission and one refused review. Failed receipts remain failed.

## Verified blocker and dependency

A **rollback-only** call to the existing `public.decide_staff_job_application` on the isolated Development database reproduced PostgreSQL's exact error: `audit_logs.actor_role` is `app_role`, while the function inserts `public.current_role()::text`. The error occurs at the audit insert after the status update, so the transaction rolls back and the application stays `submitted`. No review event or duplicate notification was committed. A separate coordinator-authorized dependency task, `GB-DB-CANDIDATE-REVIEW-ACTOR-ROLE-20261107`, will validate actual function metadata and make a new function-only ordered migration without changing access or the state machine. This Candidate branch must include that verified prerequisite through ancestry before the same application proceeds.

## Validation and remaining gates

Source TypeScript typecheck passed. QA runner syntax and diff checks passed. Changed-file lint reported four pre-existing `no-explicit-any` errors on untouched lines in `components/self-service-forms.tsx`; the new lines added none. Isolated Development migration drift was 259/259 at the feature source. The feature runtime and browser were stopped; local source remains preserved in its dedicated worktree. None of these checks turns the incomplete journey into PASS.

Next: preserve this branch remotely with its ledger record, complete and verify the isolated DB-function dependency, merge its Development head into this branch, resume **the same** application ID, then request information and receive the Candidate response. Run exact-head CI, merge into `integration/development`, and repeat bounded merged-Product readback. No approve, accept or employment activation. Full Product/security, external owner visual and invoice-backed ₪15 economics remain open. No `main`, Production or RELEASE-GAP-01 work.
