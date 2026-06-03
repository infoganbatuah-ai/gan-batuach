# Digital Observer Site Owner Journey

This document defines the future standalone Digital Observer customer journey.

It does not change Gan Batuach kindergarten onboarding, kindergarten dashboards, or the Gan Batuach subscription model. Gan Batuach remains a fixed 700 ILS/month kindergarten package with Digital Observer included.

## Target Customers

Future standalone site owner types:

- Home owner
- Business owner
- Warehouse owner
- Office owner
- Store owner
- Parking facility owner
- Enterprise customer

## Account Model

The future relationship is:

```text
Profile
↓
Observer Site Membership
↓
Observer Sites
↓
Cameras
↓
AI / Safety Events
↓
Notifications
```

Core tables:

- `observer_sites`
- `observer_site_memberships`
- `observer_site_onboarding_drafts`
- `camera_streams`
- `camera_zones`
- `ai_camera_events`
- `observer_site_subscriptions`
- `observer_site_usage_snapshots`

## Public Journey

Future flow:

1. Create account
2. Create site
3. Choose site type
4. Add cameras
5. Choose monitoring package
6. Activate monitoring

Current readiness routes:

- `/digital-observer`
- `/digital-observer/onboarding`
- `/digital-observer/dashboard`

These routes are readiness/mock routes for the standalone product. They should not be marketed as a released product until payment, support, legal and operational readiness are complete.

## Site Creation Wizard

Future wizard fields:

- Site name
- Site type
- Address
- Timezone
- Monitoring schedule
- Camera count estimate
- Camera system types
- Desired package
- Preferred notification channels

Supported future site types:

- home
- office
- business
- warehouse
- store
- parking_lot
- custom

## Camera Onboarding

Future supported camera systems:

- DVR
- NVR
- RTSP
- ONVIF
- IP Camera

The user should not need to understand RTSP, HLS or WebRTC.

The camera onboarding flow should reuse the existing Gan Batuach video gateway architecture:

```text
Camera / DVR / NVR
↓
Video Gateway
↓
Secure playback session
↓
Site owner dashboard
```

Never expose:

- RTSP URLs
- camera passwords
- gateway secrets
- raw diagnostic details to regular users

## Package Flow

Standalone observer packages are future-only:

- Home Basic
- Home Plus
- Business Basic
- Business Pro
- Enterprise Monitoring

Package controls:

- Camera limit
- Monitoring hours
- Event retention
- Recording retention
- AI event types
- SMS / WhatsApp alerts
- Human review requirements
- Advanced analytics
- Multi-user access

Kindergarten sites should not be assigned standalone packages by default because Digital Observer is included in Gan Batuach.

## Dashboard Flow

Future site owner dashboard should show:

- Active cameras
- Recent reviewed events
- Monitoring status
- Subscription status
- Notifications
- Camera health
- Open alerts
- Resolved alerts

The dashboard must keep language calm and careful:

- "requires review"
- "suspected"
- "indicator"
- "recommended action"

It must avoid automatic accusations or certainty claims.

## Event Feed Model

Site owner can view:

- Reviewed events
- Active alerts
- Resolved alerts
- Playback links if allowed
- Event notes
- Human review status

Raw AI events should not be shown by default unless the review and permission policy explicitly allows it.

## Notifications

Future notification channels:

- In-app
- SMS
- WhatsApp
- Push
- Email

The implementation should reuse the existing communication and push foundations.

Examples:

- Camera offline
- Site monitoring paused
- Event requires review
- Alert resolved
- Subscription renewal
- Payment issue

## Activation Policy

Monitoring should activate only after:

1. Site owner account exists.
2. Site is configured.
3. Cameras are connected through the gateway.
4. Package is selected.
5. Consent and legal settings are accepted.
6. Human review policy is enabled.

## Mock Testing Checklist

- Open `/digital-observer`.
- Open `/digital-observer/onboarding`.
- Login and open `/digital-observer/dashboard`.
- Verify kindergarten dashboards are unchanged.
- Verify no standalone package logic blocks Gan Batuach.
- Verify site owner route shows only non-kindergarten observer sites.

## Remaining Work Before Public Release

- Real signup flow
- Real site creation API
- Camera onboarding API for standalone sites
- Package payment flow
- Legal consent flow
- Support operations
- Push/SMS/WhatsApp providers
- Real event feed UI
- Production video gateway operations
