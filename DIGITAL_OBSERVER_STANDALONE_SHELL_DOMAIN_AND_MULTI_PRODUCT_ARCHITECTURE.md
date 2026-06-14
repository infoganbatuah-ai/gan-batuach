# Digital Observer Standalone Shell, Domain Readiness And Multi-Product Architecture

Status: Phase 173 readiness. No new repository, Supabase project or Vercel project was created.

## Current Route

Current public product route:

- `/digital-observer`

Current app shell routes:

- `/digital-observer/dashboard`
- `/digital-observer/onboarding`

These routes run inside the existing Gan Batuach Next.js project and reuse the existing Supabase, Vercel and GitHub setup.

## Product Positioning

Digital Observer is positioned as:

AI-powered digital observer for homes, businesses and organizations.

Target verticals:

- Home
- Business
- Office
- Warehouse
- Store
- Parking lot
- School future readiness
- Municipality future readiness
- Custom / enterprise

Kindergarten deployments remain under Gan Batuach only.

## Future Domain Options

Possible future domains:

- `observer.gan-batuach.co.il`
- `app.digitalobserver.ai`
- `digital-observer.co.il`

Current route remains:

- `https://gan-batuach.vercel.app/digital-observer`

## Vercel Custom Domain Plan

Future setup steps:

1. Add selected domain in Vercel project settings.
2. Configure DNS records at the domain provider.
3. Wait for Vercel domain verification.
4. Confirm SSL certificate is issued.
5. Add host-based routing only after domain verification.
6. Keep Gan Batuach root domain behavior unchanged.

Host-based routing should map observer domains to `/digital-observer`, but this phase does not activate middleware-based routing to avoid changing current domain behavior.

## Product Separation Model

Gan Batuach owns:

- Kindergartens
- Parents
- Children
- Staff
- Inspectors
- Israeli regulatory mode
- Parent/kindergarten onboarding
- Kindergarten subscription billing
- Child timelines, pickup, attendance and medical workflows

Digital Observer owns:

- Observer sites
- Site owners
- Site members
- Camera setup for standalone sites
- Observer subscriptions
- AI observer goals
- Site health and alerts
- Safety/security monitoring for non-kindergarten verticals

Shared core:

- Camera infrastructure
- Video gateway
- Observer signals
- AI events
- Risk scoring
- Incident/case workflows
- Audit logs
- Notifications
- Subscription/usage tracking
- Analytics

## Shared Core Mapping

Existing shared modules and tables:

- `observer_sites`: standalone sites and Gan Batuach kindergarten observer wrappers
- `observer_site_memberships`: standalone observer site members
- `observer_site_onboarding_drafts`: future standalone onboarding drafts
- `observer_monitoring_packages`: standalone Digital Observer package readiness
- `observer_site_subscriptions`: standalone observer subscription relationship
- `observer_site_usage_snapshots`: standalone usage tracking
- `camera_streams`: shared camera registry
- `camera_gateway_configs`: shared gateway readiness
- `camera_zones`: shared zone mapping
- `ai_camera_events`: shared AI camera event readiness
- `observer_intelligence_signals`: unified observer signal layer
- `audit_logs`: shared audit model

No observer engine was duplicated.

## Gan Batuach Dependency Boundaries

Digital Observer standalone pages must not depend on:

- `garden_id` being present
- child or parent records
- staff records
- inspector assignment records
- Gan Batuach onboarding records
- kindergarten payment flows

Gan Batuach can continue to use:

- `garden_id`
- parent/child/staff flows
- Gan Batuach Israel Mode
- regulated camera/AI restrictions

## Role Separation

Digital Observer role readiness:

- `observer_admin`
- `observer_site_owner`
- `observer_site_member`
- `observer_reviewer`

Current mapped implementation:

- `observer_site_owner` is represented by profile role readiness and `observer_site_memberships.member_role = owner`
- site admins/operators/viewers/billing users are represented by `observer_site_memberships.member_role`

These roles must remain separate from:

- parent
- staff
- inspector
- kindergarten manager

## Capability Matrix

Digital Observer Core may contain broad capabilities, but product verticals must decide whether each capability is:

- enabled
- disabled
- restricted
- legal_review_required
- consent_required
- future_only

Gan Batuach Israel Mode continues to disable or restrict audio, face recognition, biometric matching and raw AI parent visibility.

## Digital Observer Packages

Readiness packages:

- Home Basic
- Home Plus
- Business Basic
- Business Pro
- Enterprise Monitoring

Package attributes:

- camera limits
- monitoring hours
- event retention
- recording readiness
- AI event types
- alert channels
- monthly/annual price readiness

Real billing must not activate without provider configuration and admin approval.

## Camera Setup Boundary

Digital Observer camera setup supports readiness for:

- home camera
- business DVR/NVR
- RTSP
- ONVIF
- generic camera
- Hikvision
- Dahua

Rules:

- no RTSP URL exposed to browser
- no camera credentials exposed to browser
- no gateway secret exposed to client
- all playback requires scoped token
- all viewing should be audited

## Future Monorepo Extraction Plan

Future architecture:

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

This phase does not move files. It prepares the product boundary only.

## Remaining Before Separate Repo / Vercel / Supabase

Before extracting Digital Observer into a separate deployment:

- finalize product roles
- decide domain and brand
- confirm pricing and billing provider model
- create real onboarding persistence flow
- add host-based routing only after DNS verification
- complete standalone permission/RLS tests
- decide whether to share or separate Supabase project
- decide whether camera gateway is shared or per product
- complete external legal/privacy review for each vertical
- complete CI/CD split plan
- complete migration and data boundary plan

## Gan Batuach Impact

Gan Batuach routes, roles, dashboards and schemas remain intact.

The Digital Observer shell:

- adds separate public and app routes
- adds product readiness metadata
- reuses observer core tables
- does not activate restricted capabilities
- does not change kindergarten onboarding
- does not activate production billing or camera processing

