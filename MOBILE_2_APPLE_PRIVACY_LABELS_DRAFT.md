# MOBILE 2 - Apple Privacy Labels Draft

Date: 2026-06-27

Conservative draft for Apple App Privacy. Final answers require legal/privacy review.

## Data Categories

Contact Info:

- collected: yes
- linked to user: yes
- purpose: app functionality, account management, support, notifications
- shared: provider dependent for email/SMS/push if configured

User Content:

- collected: yes
- includes: child profiles, messages, documents, inspection evidence, uploaded images/files
- linked to user: yes
- purpose: app functionality, kindergarten management, safety/compliance workflows
- shared: not public; provider/storage dependent

Identifiers:

- collected: yes
- includes: account/user IDs, device/push tokens if enabled
- linked to user: yes
- purpose: authentication, notifications, security

Usage Data:

- collected: planned/limited
- purpose: app functionality, support, diagnostics
- final analytics disclosure: needs review

Diagnostics:

- collected: planned/limited
- purpose: crash/support/debugging
- final disclosure: needs review

Sensitive Info:

- collected: possible
- includes: child medical notes/allergies/pickup permissions if used
- linked to user/child context: yes
- purpose: app functionality and safety workflows
- requires strong privacy disclosure and legal review

Financial Info:

- collected: provider dependent
- card data stored by app: no
- payment/subscription metadata may be processed if providers go live

Location:

- collected: only if GPS attendance/inspection is enabled
- current native permission: not requested
- final disclosure: depends on real-device feature enablement

Photos/Videos:

- collected: possible uploads for documents/evidence/profile/gallery
- live camera stream: not enabled for store claims unless separately validated

Children's Data:

- involved: yes
- app is adult-facing but processes child-related data
- needs legal/privacy review

## Status

apple_privacy_labels_status = draft_needs_legal_privacy_review
