# Face Matching Pickup Verification

This document defines safe infrastructure for future authorized pickup verification.

This phase is mock/readiness only:

- No real face provider
- No automatic child release
- No automatic face approval
- No biometric decision
- Human manager confirmation is required

## Reference Image Model

Reference images can represent:

- Parent reference image
- Authorized pickup person image
- Temporary pickup person image
- Staff reference image

Table:

- `face_reference_images`

The table stores secure metadata:

- scope kindergarten / child
- related profile / parent / pickup contact / staff
- subject type
- image path / private URL reference
- consent status
- active state
- expiration

Images must remain protected in private buckets. Public access is not allowed.

## Face Matching Result Model

Table:

- `face_match_results`

Tracks:

- camera event
- pickup event
- reference image
- authorized pickup contact
- match score
- provider
- confidence
- review status
- reviewed by
- reviewed at
- notes

Match scores are review context only. They must never approve pickup automatically.

## Pickup Verification Workflow

Future flow:

```text
Person arrives
↓
Pickup zone camera event
↓
Face comparison
↓
Possible match
↓
Manager review
↓
Approve / Reject / Inconclusive
↓
Manual pickup decision
```

The final pickup decision remains human.

## Temporary Pickup Support

Existing authorized pickup contacts support temporary authorization.

Additional readiness fields:

- temporary date
- valid hours
- valid from
- valid until
- face reference consent status

Supported cases:

- Today only
- Specific date range
- Specific hours

## Manager Review Dashboard

Readiness route:

- `/dashboard/garden/pickup-face`

Manager sees:

- possible match
- authorized person
- child
- provider
- score
- confidence
- review controls

Controls:

- approve by manager
- reject by manager
- inconclusive

This is not child release. It is only review of the possible face match.

## Privacy Rules

Required:

- No biometric decisions
- No parent-facing match scores
- No public face data
- No raw face data in logs
- Private storage only
- Human review required
- Audit trail for review decisions

Forbidden:

- Automatic child release
- Automatic face approval
- Parent notification with raw match score
- Public URLs for reference images
- Face recognition without explicit consent

## Observer Integration

Future integration:

```text
Pickup zone
↓
Person detected
↓
Face event
↓
Authorization check
↓
Face match result
↓
Manager review workflow
```

AI event type:

- `pickup_mismatch`

Future providers may include:

- local model
- provider API
- video gateway snapshot extraction

No provider is connected in this phase.

## Testing Checklist

Mock only:

- Create face reference metadata from authorized pickup contact.
- Create mock face match result.
- Review as approved / rejected / inconclusive.
- Verify no parent route shows face scores.
- Verify manager scope is limited to own kindergarten.
- Verify build passes without provider keys.

## Future Provider Integration

Before real provider integration:

- legal consent model
- privacy impact review
- retention policy
- signed storage access
- audit log requirements
- explicit opt-in per kindergarten / parent / staff
- false positive handling
- human review UX validation
