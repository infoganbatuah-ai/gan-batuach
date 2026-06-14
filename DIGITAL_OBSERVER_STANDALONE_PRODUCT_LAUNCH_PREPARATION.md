# Digital Observer Standalone Product Launch Preparation

Status: standalone product readiness. Digital Observer remains inside the existing Gan Batuach codebase and infrastructure.

## Current Route

Digital Observer is available at:

- `/digital-observer`
- `/digital-observer/dashboard`
- `/digital-observer/onboarding`
- `/digital-observer/home`
- `/digital-observer/business`
- `/digital-observer/warehouse`
- `/digital-observer/office`
- `/digital-observer/store`
- `/digital-observer/sites/[id]`

## Product Positioning

Positioning:

Digital Observer – AI Camera Monitoring for homes, businesses and organizations.

Target audiences:

- home owners
- business owners
- offices
- warehouses
- stores
- parking lots
- schools as future readiness
- municipalities as future readiness
- custom monitored sites

Gan Batuach remains the kindergarten vertical.

## Public Website Readiness

The public product home includes:

- hero
- use cases
- how it works
- camera connection
- AI monitoring
- alerts
- privacy and control
- packages
- FAQ
- CTA

CTA examples:

- Start monitoring
- Request demo
- Connect cameras
- Create observer site

Public copy avoids unsupported claims. It does not say the system prevents all incidents, replaces security personnel, identifies criminals, guarantees safety or detects violence with certainty.

## App Shell Readiness

The app shell at `/digital-observer/dashboard` shows:

- monitored sites
- connected cameras
- observer alerts
- site health
- AI readiness
- package status
- recent events
- setup checklist
- quick actions
- analytics readiness
- Digital Observer lead flow readiness

It avoids kindergarten language:

- no children
- no parents
- no staff
- no inspectors
- no kindergarten compliance

## Onboarding Readiness

The onboarding flow is prepared as an eight-step shell:

1. Choose site type
2. Add site details
3. Choose monitoring package
4. Add cameras
5. Select monitoring goals
6. Configure alert channels
7. Review privacy settings
8. Activate test mode

Supported site types:

- home
- office
- business
- warehouse
- store
- parking lot
- custom

Future readiness:

- school
- municipality
- kindergarten through Gan Batuach only

## Product Separation

Gan Batuach includes:

- kindergartens
- parents
- children
- staff
- inspectors
- Israeli regulation
- Gan Batuach Israel Mode

Digital Observer includes:

- observer sites
- site owners
- site members
- standalone cameras
- observer subscriptions
- security/safety monitoring
- multi-vertical capability policy

Shared core:

- camera infrastructure
- video gateway
- observer signals
- AI events
- risk scoring
- audit logs
- notifications
- subscriptions

## Observer Site Model

Standalone Digital Observer sites should use:

- `observer_site_id`
- `observer_sites`
- `observer_site_memberships`
- `observer_site_subscriptions`
- `observer_site_usage_snapshots`
- `camera_streams`
- `camera_zones`
- `observer_intelligence_signals`

Standalone Digital Observer sites should not require:

- `garden_id`
- `child_id`
- `parent_id`
- kindergarten-specific roles

Gan Batuach may still use garden-linked data where appropriate.

## Capability Model

Digital Observer Core may contain broad capabilities, but each vertical must classify capabilities as:

- allowed
- disabled
- restricted
- legal_review_required
- consent_required
- future_only

Sensitive capabilities are not enabled automatically.

## Camera Setup

Digital Observer camera setup supports readiness for:

- home camera
- business DVR/NVR
- RTSP
- ONVIF
- generic IP camera
- demo camera

Security controls:

- no RTSP URL exposed to browser
- no camera credentials exposed
- gateway registration is server-side
- playback tokens are scoped and short-lived
- sensitive actions remain audited

## Monitoring Goals

Generic observer goals:

- camera offline
- motion after hours
- person detected
- no motion too long
- restricted area
- obstruction
- crowding
- unusual motion
- business hours monitoring
- night monitoring

Gan Batuach regulatory restrictions remain separate.

## Lead Flow

Digital Observer lead type:

- `digital_observer_lead`

Sources:

- home
- business
- office
- warehouse
- store
- custom

Flow:

landing page -> request demo / start monitoring -> lead created -> admin follow-up -> site onboarding

## Analytics Readiness

Tracked events:

- visitor source
- demo requests
- package interest
- onboarding started
- cameras added
- first alert created
- active observer sites
- churn risk

No external analytics provider is required in this phase.

## Future Domain Strategy

Current:

- `/digital-observer`

Future possible domains:

- `observer.gan-batuach.co.il`
- `app.digitalobserver.ai`
- `digital-observer.co.il`
- `app.digital-observer.co.il`

Host-based routing is prepared through environment variables, but DNS and Vercel setup remain manual.

See `DIGITAL_OBSERVER_DOMAIN_AND_VERCEL_SETUP.md`.

## Future Extraction Plan

Target architecture:

```text
apps/
  gan-batuach
  digital-observer

packages/
  observer-core
  camera-core
  ai-core
  workflow-core
  audit-core
  analytics-core
  ui-core
```

Future infrastructure options:

- Option A: same monorepo, separate Vercel projects
- Option B: separate repositories later
- Option C: shared packages published privately

No extraction was performed in this phase.

## Remaining Standalone Product Gaps

- Create real lead capture endpoint for Digital Observer forms.
- Connect Digital Observer analytics to real event capture.
- Configure Vercel custom domain and DNS when ready.
- Decide pricing and activate billing only after provider readiness.
- Validate observer site RLS policies for standalone customers.
- Add full camera setup forms for standalone sites.
- Add package purchase flow after payment provider approval.
- Complete legal review for advanced capabilities by vertical.
- Define future support/SLA model for Digital Observer customers.
