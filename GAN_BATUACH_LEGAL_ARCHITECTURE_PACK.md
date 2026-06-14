# Gan Batuach Legal Architecture Pack

**DRAFT FOR LEGAL REVIEW**

This document prepares Gan Batuach for external legal, privacy, regulatory and camera-compliance review. It is not legal advice and does not approve production launch.

## Roles

- Admin: platform operations, security, billing, legal review registers and support.
- Manager / owner: kindergarten operation, staff, children, parent invitations, documents, payments and cameras.
- Staff: assigned kindergarten workflows, child updates, attendance readiness and incidents.
- Parent: own child, approved updates, approved documents, payments, pickup and permitted camera viewing.
- Inspector: assigned gardens, inspections, findings, evidence and reviewed observer signals.
- External reviewer: future limited metadata-only access, no child data, medical data, raw AI, live streams, payment details or secrets.

## Data Categories

- Child profile data: regulated child records and enrollment context.
- Parent data: contact, relationship, pickup, payment approval and account data.
- Staff data: employment, attendance, certifications and clearance readiness.
- Medical data: allergies, medication notes, health observations and special care notes.
- Camera data: camera metadata, stream sessions, gateway status and access logs.
- AI / Observer data: motion/skeleton metadata, internal signals, review outcomes and calibration data.
- Audit data: access, changes, camera viewing, medical access, documents and sensitive actions.
- Billing data: subscription records, invoice metadata and tokenized payment references only.

## Sensitive Processing Boundaries

Gan Batuach Israel Mode disables or restricts:

- audio recording and audio analytics
- speech recognition and keyword detection
- face recognition and face matching
- child biometric face profiles
- raw AI parent visibility
- automatic accusations or disciplinary decisions

Allowed with human review:

- pose estimation
- skeleton and motion analytics
- suspected fall / inactivity / crowding / restricted-area signals
- reviewed safety summaries

Legal-review-only:

- contextual child association through skeleton context
- gait recognition
- soft biometric matching
- persistent skeleton identity
- cross-day identity tracking

## Audit And Retention

Audit logs should preserve evidence value while avoiding sensitive plaintext. Deletion and anonymization must respect legal holds, inspection evidence, incidents, payment records, audit obligations and child safety investigations.

## External Review Questions

- Confirm controller / processor roles between Gan Batuach and each kindergarten.
- Confirm required notices and consents for parents, staff and managers.
- Confirm camera viewing policy and limitations.
- Confirm retention periods for child, medical, camera, inspection and payment records.
- Confirm AI governance and DPIA conditions before production use.
