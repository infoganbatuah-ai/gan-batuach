# DIGITAL OBSERVER — COMPATIBILITY MIGRATION PLAN

Date: 2026-09-10

## Governing rule

Compatibility may translate into a canonical contract but may not become a second truth store. Each adapter has an owner, a bounded purpose, a retirement test and observable provenance.

## Current windows

### Shared Incident table

- Legacy producer: kindergarten/mock correlation route and historical rows.
- Canonical replacement: `correlate_digital_observer_signal` producing `do-track-v1` + `REAL_CAMERA_AI` Incidents.
- Boundary: Product APIs, feedback and Investigation filter by canonical version/provenance.
- PUSH 26 change: future mock correlation writes are stamped `SIMULATION`, `legacy-kindergarten-mock-v1`, and `legacy_kindergarten_mock`.
- Retirement gate: classify historical rows, preserve IDs/timestamps/links/tenant ownership, migrate every confirmed consumer, compare counts and references, then remove only approved compatibility code.

### Legacy Watch requests

- Legacy producer: saved requests without compiler version.
- Canonical replacement: versioned Watch Rule Compiler and structured rule evaluation.
- Boundary: legacy matching occurs only inside the canonical Risk service; it cannot bypass Incident → Risk → Verification → Decision.
- Retirement gate: compile every active compatible request, compare deterministic matches and Risk effects, obtain user/policy review for ambiguous rules, then disable fallback.

### Kindergarten event/incident stores

- Legacy/other-product stores: `ai_events`, `ai_camera_events`, `incident_reports`.
- Canonical Digital Observer stores: `observer_intelligence_signals`, canonical Incident rows and `digital_observer_event_clips`.
- Boundary: normal DO journal, Incident and Investigation consumers have no fallback to those stores.
- Retirement gate: separate kindergarten migration authorization and complete before/after data proof. PUSH 26 does not authorize it.

## Historical data proof required before a future structural migration

Capture by tenant/Site and globally:

1. record counts and stable IDs;
2. minimum/maximum original timestamps;
3. provenance and environment;
4. Event→Incident membership;
5. Evidence references and media state;
6. tenant/Site ownership;
7. API consumer parity;
8. idempotent rerun result;
9. rollback restore result.

No applied migration may be rewritten. A future migration must be additive first, verify parity, switch consumers, observe a bounded compatibility period, and only then use a separately reviewed destructive migration.

## Rollback

PUSH 26 adds no database migration. Application rollback is the prior Git revision. If the new discriminator stamping causes a consumer incompatibility, revert the application commit; existing rows and schemas remain unchanged. The old Product behavior is recoverable without data restoration.

## Retirement register ownership

The canonical domain manifest is executable QA metadata. The legacy retirement register is the review ledger. A compatibility path may be removed only when both its code dependency search and its data/consumer retirement gate pass.
