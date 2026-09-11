# GB-M10 — Garden onboarding atomic activation

## Before State

The existing five-step wizard persisted useful Garden, age-group, fee, document-summary and subscription fields, but final activation performed independent API writes. A mid-request failure could leave the Garden, subscription, profile and authority out of sync. Draft selection depended on `profiles.garden_id`, preventing an existing Owner from starting another Garden safely.

## Canonical Onboarding State

`kindergarten_onboarding_records` remains the authoritative lifecycle. GB-M10 adds a persisted current stage, registrant type, stable activation key, attempt/error metadata and completion time. Completion remains derived from persisted data instead of the numeric wizard position.

## Onboarding Stages

The current compatible stages cover account/identity, Garden details, owner/teacher semantics, documents and consent, legacy age-group configuration, pricing/subscription readiness, optional setup and activation. Classroom creation is intentionally deferred to GB-M11.

## Save / Resume

Draft state, current step and entered data are stored server-side. The onboarding page accepts an explicitly authorized draft Garden ID, allowing sign-out/sign-in resume without local storage.

## Garden Draft Model

`start_garden_onboarding` serializes draft creation per actor, reuses an existing open draft and atomically creates the pending Garden, pending canonical Management membership and onboarding record. The Garden remains non-public and pending until activation.

## Owner / Teacher Handling

Registrant types are explicit: `teacher_operator`, `owner_teacher` and `owner_only`. Owner-as-teacher creates the existing Garden-scoped teaching relationship. Teacher-operator receives a distinct Garden-scoped operator assignment. Owner-only creates no fabricated Teacher relationship.

## Documents / Consent

Document state remains an honest summary/configured checklist pending GB-M32 storage closure. Platform terms and privacy consent are persisted with actor, Garden, version and timestamp inside the serialized activation transaction; an existence check prevents retry duplicates. The UI does not claim legal verification.

## Age Groups Compatibility

Existing `kindergarten_age_group_setups` and fee-group writes are preserved for migration by GB-M11. Existing hard-coded capacity/ratio values remain legacy product configuration and are not promoted as verified law.

## Pricing Configuration

Existing Garden tuition configuration and the current calculated platform selection are preserved. This push does not create a new tuition ledger or billing authority.

## Subscription Readiness

The status contract reports provider `manual` and `live_collection: false`. Atomic activation initializes at most one current trial record. No click is treated as provider payment proof.

## Activation Requirements

`garden_onboarding_status` derives blockers from persisted Garden details, GB-M04 verification requirements, age-group configuration, document state and consent evidence. Optional staff, children and parent invitations do not block activation.

## Atomic Activation Transaction

`activate_garden_onboarding` locks the Garden and validates ownership plus the stable activation key. Garden activation, canonical membership activation, applicable teaching assignment, trial readiness, onboarding completion, profile compatibility and audit evidence commit in one database transaction.

## Idempotency

Draft creation is serialized and returns the existing open draft. Activation uses an advisory transaction lock, row locks and an already-active return path. Memberships, teaching assignments, subscription state and consent evidence use deterministic uniqueness.

## Legacy Admin Approval Removal/Compatibility

Canonical activation does not inspect or require `admin_approved` or `pending_final_approval`. Admin review pages remain available for separate verification/compliance work and are informational for this lifecycle.

## Multi-Garden Interaction

Starting or activating Garden B does not overwrite the Owner's Garden A relationship. `profiles.garden_id` is updated only when empty. GB-M09 membership/context switching becomes authoritative after B activates.

## APIs Updated

`POST /api/garden/manager-application` starts/reuses a canonical draft. `GET /api/kindergarten-onboarding` returns canonical status. `PATCH /api/kindergarten-onboarding` saves only after explicit draft authority and delegates final activation to the transactional RPC.

## Migration / RPC

Migration `20260911020000` adds onboarding lifecycle metadata, retry-safe consent evidence, operator-teacher semantics and the `start_garden_onboarding`, `can_edit_garden_onboarding`, `garden_onboarding_status` and `activate_garden_onboarding` functions.

## Security / IDOR Tests

All read, save and activation paths call session-scoped draft/Management authority before any Service Role access. The target Garden ID and activation key are independently verified. Static contract tests cover unrelated-user denial and multi-Garden preservation.

## Concurrency Tests

Contract tests verify actor-level draft serialization, Garden advisory locking, row locking, deterministic upserts and the already-active retry path. Live concurrent probes require controlled non-customer identities.

## Production Verification

To be completed after merge: migration state, Vercel Ready, health/Supabase connectivity and unauthenticated mutation denial. A live create/resume/activate probe is limited to controlled QA identities.

## Remaining Debt

GB-M11 replaces the legacy age-group/class-like structures with canonical Classrooms. GB-M26 owns subscription lifecycle, GB-M32 owns complete private document verification, and GB-M35/36 own full production identity/tenant probes.

## Inputs For GB-M11

Migrate `selected_age_groups`, `class_capacity`, `kindergarten_age_group_setups` and `kindergarten_fee_groups` into canonical classrooms without changing GB-M10 activation evidence or membership authority.

## Digital Observer Boundary

`DIGITAL OBSERVER CORE DIFF: 0`
