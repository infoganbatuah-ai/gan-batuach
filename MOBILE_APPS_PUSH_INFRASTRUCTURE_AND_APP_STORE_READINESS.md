# Mobile Apps, Push Infrastructure & App Store Readiness

## Purpose

Gan Batuach is being prepared for production-grade mobile deployment across:

- iOS
- Android
- Web PWA
- Push notifications
- Deep links
- Offline workflows
- Mobile security
- App Store and Google Play release readiness

The mobile experience is the primary experience for parents, staff, managers and inspectors.

## Mobile Platform Center

Admin route:

```text
/dashboard/admin/mobile-platform
```

The center shows:

- Mobile readiness score
- Push readiness
- App Store readiness
- Google Play readiness
- Deep link readiness
- Security policies
- Offline readiness
- Crash and analytics readiness

## iOS Readiness

Prepared for:

- iPhone
- iPad
- APNs
- App Store screenshots
- Privacy labels
- Permission explanations
- Bundle identifier readiness

Required before release:

- Apple Developer account
- APNs credentials
- Final screenshots
- Privacy labels
- App review metadata

## Android Readiness

Prepared for:

- Android phones
- Android tablets
- FCM
- Google Play listing
- Data safety disclosures
- Package identifier readiness

Required before release:

- Google Play Console account
- Firebase project
- FCM credentials
- Final screenshots
- Data safety answers

## Push Infrastructure

Supported providers:

- Firebase Cloud Messaging
- Apple Push Notifications
- Web Push

Categories:

- Safety
- Attendance
- Messages
- Inspections
- Compliance
- Payments
- Documents
- Cameras
- System notifications

Production sending remains disabled until credentials and release approval are complete.

## Deep Links

Deep links are registered for:

- Notifications
- Documents
- Child timeline
- Messages
- Incidents
- Inspections
- Cameras
- Payments
- Tasks

Every deep link still requires authentication and server-side permission checks.

## Mobile Security

Prepared controls:

- MFA by role
- Optional biometric unlock
- Session timeout by role
- Device validation
- Camera watermark policy
- Token-based camera access

No secrets are stored in the mobile app.

## Offline Readiness

Prepared workflows:

- Staff attendance
- Staff child updates
- Staff incident reports
- Manager tasks
- Inspector inspections
- Inspector incident reports

Offline actions use queue-and-sync patterns. Conflict handling requires human review.

## Camera Mobile Experience

Mobile camera rules:

- Permission check before viewing
- Short-lived playback tokens
- No RTSP URLs in the browser/app
- Parent access only to approved cameras
- Viewing restrictions and audit logging
- Watermark policy readiness

## App Store Checklist

- App name and description
- Screenshots
- Permission text
- Privacy labels
- Support URL
- Privacy policy URL
- Test credentials for review
- Push notification explanation
- Camera/location usage explanation

## Google Play Checklist

- Store listing
- Screenshots
- Short and full description
- Data safety disclosure
- Permission explanations
- App access instructions
- Privacy policy URL
- Test account

## Remaining Production Work

- Configure Apple Developer account.
- Configure Google Play Console account.
- Connect APNs credentials.
- Connect Firebase project and FCM credentials.
- Add native crash monitoring SDK.
- Add mobile analytics SDK.
- Run real device QA on iPhone, iPad, Android phone and Android tablet.
- Submit privacy labels and data safety forms.
- Run store review dry run.
