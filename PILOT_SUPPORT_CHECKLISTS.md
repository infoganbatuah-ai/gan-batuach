# Pilot Support Checklists

Date: 2026-06-07
Purpose: fast, practical support coverage for the first Gan Batuach pilot.

## Admin Support Checklist

Before pilot:

- Confirm admin can access `/dashboard/admin`, `/dashboard/admin/pilot-center`, `/dashboard/admin/launch-readiness`, `/dashboard/admin/security`, `/dashboard/admin/leads`, `/dashboard/admin/gardens`, `/dashboard/admin/users`, `/dashboard/admin/communications`, `/dashboard/admin/camera-infrastructure`, and `/dashboard/admin/observer-test-center`.
- Confirm one named admin owns lead approval, final kindergarten approval, correction notes, and launch blocker updates.
- Confirm launch blockers have severity, owner, due date, and resolution status.
- Confirm communication providers remain mock/dry-run unless explicitly approved.
- Confirm camera gateway is marked not configured or configured honestly.
- Confirm Observer remains shadow/test mode with human review.
- Confirm support contact details are ready for kindergarten managers.

Common admin issues:

- Manager did not receive credentials: use resend credentials, verify email/phone, and check mock delivery logs.
- Kindergarten stuck in onboarding: review onboarding record, correction note, missing fields, and manager account.
- Parent cannot access child: verify parent record, child relationship, onboarding status, and garden assignment.
- Camera not live: check gateway status, camera health, masked connection summary, and permission record.
- Observer event confusion: remind reviewers that events are indicators only and require human validation.

Escalation:

- Security/privacy issue: stop affected flow, preserve audit logs, assign admin owner, and document in launch blockers.
- Camera secret exposure concern: disable camera, rotate credentials, review logs, and verify no RTSP in browser.
- Child safety incident: use human procedure first; do not rely on Observer automation.
- Production outage: check Supabase, Vercel, communication providers, video gateway, and environment config.

## Kindergarten Support Checklist

Before pilot:

- Manager has login credentials and knows the login URL.
- Manager completes kindergarten onboarding before final approval.
- Kindergarten profile includes address, phone, contact details, operating details, documents, camera readiness, and subscription review.
- Staff and parent invitation process is explained.
- Camera setup expectations are clear: DVR/NVR/IP camera must support RTSP or ONVIF, and a Video Gateway is required for live browser playback.
- Manager knows how to report a support issue.

Common kindergarten issues:

- "I logged in but see onboarding": expected until final admin approval.
- "Camera test says gateway required": the app is ready, but live video needs active MediaMTX/go2rtc/custom gateway.
- "Parent is not active": parent must complete onboarding and child link must be approved.
- "Staff is not active": staff onboarding and manager verification must be complete.
- "Notification did not send": first pilot may use mock logs, not real provider sending.

Escalation:

- Onboarding blocked for more than one business day: admin reviews missing fields and correction note.
- Camera connection blocked: collect camera type, brand, IP/domain, port, channel, and gateway status without sharing passwords in chat.
- Parent/child data mismatch: verify identity and relationship before changing records.

## Parent Support Checklist

Before pilot:

- Parent receives invitation or secure login instructions.
- Parent completes onboarding before full dashboard access.
- Child relationship is verified.
- Documents and permissions are reviewed.
- Parent understands camera access is permission-based and may not be live until gateway is ready.

Common parent issues:

- "I cannot see the dashboard": onboarding is incomplete or parent record is not active.
- "I cannot see my child": child link or garden approval is missing.
- "I cannot see cameras": camera permission, viewing hours, gateway readiness, or child-camera assignment may be missing.
- "I cannot upload a document": check file type, size, and private storage configuration.
- "Pickup contact not visible": verify contact approval and child relationship.

Escalation:

- Wrong child shown or privacy concern: treat as urgent, disable affected access if needed, and notify admin owner.
- Camera privacy concern: pause parent camera access for the affected camera until permissions are reviewed.
- Medical/document issue: escalate to kindergarten manager and admin; avoid sending sensitive details through insecure channels.
