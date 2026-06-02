# Child Pickup Verification Architecture

This phase creates the foundation for safe child pickup verification in Gan Batuach.

It does not release a child automatically, does not approve a pickup through face recognition, and does not notify parents from AI detections without human review.

## Core Principle

```text
Authorization data
-> staff/manager human review
-> pickup event record
-> parent/manager notification when needed
```

No automatic child release is allowed.

## Authorized Pickup Contacts

Each child can have multiple pickup contacts:

- parent
- second parent
- grandparent
- sibling
- nanny
- emergency contact
- temporary pickup authorization
- other

Stored in:

- `authorized_pickup_contacts`

Important fields:

- `child_id`
- `kindergarten_id`
- `full_name`
- `relation`
- `phone`
- `identity_number`
- `photo_required`
- `face_reference_image`
- `active`
- `authorization_type`
- `valid_from`
- `valid_until`
- `notes`

Photos are for human reference only in this phase.

## Temporary Authorization

Temporary pickup authorizations are created by a parent.

Example:

```text
Today only
14:00-16:00
Person: Grandmother / Nanny / Emergency contact
```

The kindergarten manager sees the temporary contact in the pickup screen and can still request parent confirmation.

## Pickup Event Records

Pickup events are stored in:

- `child_pickup_events`

Fields include:

- `child_id`
- `pickup_contact_id`
- `pickup_person`
- `authorization_type`
- `pickup_time`
- `status`
- `verified_by`
- `notes`
- `camera_event_id`
- `parent_confirmation_requested`
- future face match fields

Statuses:

- `recorded`
- `verified_by_staff`
- `unusual`
- `parent_confirmation_requested`
- `cancelled`

## Parent Workflow

Parent can:

1. View pickup contacts.
2. Add permanent pickup contact.
3. Add temporary pickup authorization.
4. Revoke an authorization.
5. View pickup history.

Parent scope:

- Only own children.
- Only own pickup contacts.
- Only pickup events for own children.

## Manager Workflow

Manager can:

1. View authorized contacts for children in their kindergarten.
2. View temporary pickup authorizations.
3. Record a pickup event.
4. Mark pickup as unusual.
5. Request parent confirmation.

Manager scope:

- Only children in assigned kindergarten.
- No access to other kindergartens.

## AI Observer Future Flow

Future readiness only:

```text
Camera
-> Person detected in pickup zone
-> face verification candidate
-> authorization check
-> human confirmation
-> pickup event / escalation
```

Not implemented in this phase:

- face recognition
- child identity recognition
- automatic guardian approval
- automatic release
- parent notification from raw AI

## Face Verification Future Fields

Pickup contacts and events include future-ready fields:

- `face_reference_id`
- `face_reference_image`
- `face_match_score`
- `face_match_provider`
- `face_match_status`

Allowed status in this phase:

- `not_run`
- `future_ready`

Any future face match must be treated as:

```text
AI suggestion
-> human review
-> manager/staff decision
```

## Notifications

Supported notification events:

- temporary authorization created
- authorization revoked
- unusual pickup recorded
- pickup confirmation requested

Parent notifications are sent only for staff/manager-recorded pickup events, not raw AI signals.

## Privacy Protections

- Pickup photos are stored in private storage buckets.
- Pickup reference images are never used for automatic release in this phase.
- Parents manage only their own children.
- Managers see only their kindergarten.
- Every pickup event records who verified it.
- AI/camera event links remain nullable and review-only.

## Pilot Testing

Minimum pilot tests:

1. Parent creates permanent pickup contact.
2. Parent creates temporary authorization.
3. Parent revokes authorization.
4. Manager records pickup.
5. Manager marks unusual pickup.
6. Manager requests parent confirmation.
7. Parent sees pickup history.
8. Direct access to another child is blocked.
9. Parent photos remain private.
