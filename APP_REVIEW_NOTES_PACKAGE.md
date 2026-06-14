# App Review Notes Package

Status: draft for Apple and Google reviewer notes.

## App Purpose

Gan Batuach is a role-based kindergarten operations and trust platform for managers, parents, staff and inspectors.

## Roles

- Parent: child timeline, messages, documents, payments, notifications and privacy requests.
- Manager: kindergarten command center, children, staff, parents, documents, payments and inspection readiness.
- Staff: daily workflow, attendance, child updates, documents, tasks and incidents.
- Inspector: assigned kindergarten inspections, forms, reports and follow-up tasks.
- Limited admin reviewer: only if required, with synthetic data and no secrets.

## Demo Accounts

Demo accounts must be created with synthetic data only. Passwords should be shared through secure admin-only handling, not stored in repository files.

## Permissions

Location:

Used for attendance, pickup and inspection validation where enabled.

Notifications:

Used for child updates, messages, documents, payments, inspections, approved safety updates and system/security notifications.

Camera/photos:

Used for profile photos, document upload and authorized evidence only.

Microphone:

Not used for Gan Batuach kindergarten observer monitoring.

## Camera Behavior

Camera viewing, if enabled, is permission-gated, time-limited, audited and policy-controlled.

- no RTSP URL exposed
- no camera credentials exposed
- short-lived viewing tokens
- dynamic watermark readiness
- parent access restrictions

## AI / Observer Behavior

For Gan Batuach Israel Mode:

- no audio monitoring
- no face recognition
- no raw AI alerts to parents
- no automatic accusations
- no automatic disciplinary actions
- human review remains mandatory

## Privacy Requests

Users can request deletion, anonymization or account closure through the privacy request workflow. Admin review applies where legal hold, evidence retention or financial records require it.

