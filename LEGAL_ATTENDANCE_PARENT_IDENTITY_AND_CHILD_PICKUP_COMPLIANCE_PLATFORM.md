# Legal Attendance, Parent Identity & Child Pickup Compliance Platform

## Purpose

Phase 148 defines the official Gan Batuach attendance and pickup model without child face recognition, camera-based attendance or passive biometric identification. Attendance and pickup must be initiated by an authorized adult or staff member and validated through approved workflows.

## Attendance Model

The legal attendance model is based on:

- adult-initiated attendance
- staff-recorded attendance when needed
- GPS validation
- digital signature
- parent or authorized adult identity verification
- immutable audit evidence

Attendance records now support legal compliance fields:

- `authorized_adult_id`
- `gps_validation_status`
- `gps_distance_meters`
- `signature_id`
- `legal_attendance_method`
- `parent_identity_verified`
- `biometric_identification_used = false`
- `camera_based_attendance_used = false`

## Parent Identity Registry

`authorized_adults` is the registry for adults allowed to participate in attendance and pickup workflows.

Supported relationship types include:

- mother
- father
- parent
- grandparent
- babysitter
- guardian
- approved pickup contact
- emergency contact
- temporary

This registry separates adult identity from child records and keeps the model auditable.

## Pickup Authorization Workflow

Pickup authorization is managed through `pickup_authorizations`.

Supported authorization types:

- permanent
- temporary
- one-time
- emergency

Supported statuses:

- pending
- approved
- rejected
- revoked
- expired
- used
- blocked

Pickup is blocked when:

- the adult is not authorized
- the authorization is expired
- the contact is inactive
- the authorization is revoked, rejected or blocked

Blocked attempts create an `attendance_exceptions` record.

## GPS Validation

`gps_attendance_validations` stores GPS evidence for:

- check-in
- check-out
- pickup
- temporary authorization
- emergency override

The default radius is 30 meters. Each validation stores:

- adult location
- kindergarten location readiness
- radius
- distance
- validation result
- device/IP metadata

## Digital Signature Model

`attendance_digital_signatures` stores signature evidence for attendance and pickup.

Each signature may include:

- signature image
- signature hash
- timestamp
- GPS coordinates
- device label
- IP
- user agent
- linked attendance or pickup event

## Audit Trail

`attendance_compliance_audit_trail` records key actions:

- check-in requested/completed
- check-out requested/completed
- pickup blocked
- pickup authorization created
- temporary authorization created
- emergency pickup approved
- manual override
- signature recorded
- GPS validated

Audit rows are designed to be append-only operational evidence.

## Exception Center

`attendance_exceptions` tracks:

- failed GPS
- unauthorized pickup
- expired authorization
- missing signature
- manual override
- identity not verified
- emergency pickup

The admin dashboard surfaces open exceptions for follow-up.

## Compliance Score

`attendance_compliance_scores` creates a 0-100 score based on:

- GPS validation rate
- signature completion rate
- authorization compliance
- exception rate

`attendance_compliance_checks` tracks readiness across authorized adults, pickup authorization, GPS validation, digital signatures, audit trail, exceptions, privacy and parent verification.

## Dashboards

- `/dashboard/admin/attendance-compliance` gives national/admin visibility into legal attendance readiness.
- Existing parent pickup and manager pickup screens continue to handle authorized adults and pickup events.
- Existing attendance APIs now accept legal GPS and attendance method fields.

## Privacy And Legal Boundaries

- No child face recognition.
- No camera-based attendance.
- No passive biometric identification.
- No automatic child release.
- Human review remains required for pickup decisions.
- Face reference fields that existed historically are not used for legal attendance approval.

## Remaining Production Gaps

- Add parent mobile check-in/check-out UX with live GPS.
- Add a real signature pad to pickup and attendance flows.
- Wire kindergarten GPS coordinates into distance calculation at the API layer.
- Enforce one-time authorization usage after the first pickup.
- Add automatic parent MFA requirement before parent-initiated attendance actions.
- Add mobile offline queue support for parent attendance signatures.
