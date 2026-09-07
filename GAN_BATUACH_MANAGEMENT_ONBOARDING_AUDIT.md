# Gan Batuach Management — Onboarding Audit

## Garden onboarding

The current path is self-service registration → inactive manager profile → manager application → garden/profile linkage → five-step onboarding → trial/subscription records → active/pending-payment garden. It persists identity, business/profile fields, documents summary, age groups, capacity, tuition, staffing counts, optional children/parent invites and camera readiness.

Status: **PARTIAL**.

Key gaps:

- Owner and teaching responsibility are not modeled explicitly.
- Non-owner teacher assignment is split between `teachers`, `staff` and employment records.
- Phone verification is absent and email delivery/recovery is not production-proven.
- Staff, children, parent invitations, calendar and schedule are explicitly optional at activation.
- Payment may remain pending while the garden becomes active; provider collection is not real.
- Capacity/ratio validation uses hard-coded assumptions without a versioned legal source.
- `profiles.garden_id` prevents a coherent multi-garden owner journey.

Reuse: `/onboarding/kindergarten`, `POST /api/garden/manager-application`, `PATCH /api/kindergarten-onboarding`, `kindergarten_onboarding_records`, `kindergarten_age_group_setups`, `kindergarten_fee_groups`, `kindergarten_subscriptions`.

## Parent onboarding

The system supports self-registration and garden provisioning, parent profile completion, permanent child profiles, multiple children, discovery, requests, garden decision, pickup contacts and broad parent dashboards. Status: **PARTIAL** because invitation recovery, co-guardian accounts, canonical relationship resolution and provider-backed payment activation are incomplete.

## Staff onboarding

Self-service candidates can create a profile, browse openings and apply. Managers can approve/reject with a reason and create staff/employment/onboarding records. Gardens can also provision staff directly. Status: **PARTIAL** because candidate completeness, qualification verification, existing-user invitation acceptance, delivery recovery and multi-garden working context are incomplete.

## Inspector onboarding

Self-service application and admin approval/assignment exist. Status: **COMPLETE_NEEDS_QA**. The inspector-originated preliminary-garden invitation lifecycle is **MISSING**.

## Must-not-rebuild decisions

| Foundation | Decision |
|---|---|
| Self-service registration/API | preserve and extend |
| Auth callback/passkeys | preserve and QA |
| Garden onboarding wizard/records | repair, not replace |
| Permanent child files/enrollment requests | consolidate legacy paths around them |
| Staff candidate/application/employment tables | preserve and extend |
| Inspector applications/admin decision | preserve; make transactional |
| Provisioning and delivery services | repair into signed invitation/recovery flow |
