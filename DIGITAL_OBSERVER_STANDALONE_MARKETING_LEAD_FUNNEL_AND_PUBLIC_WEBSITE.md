# Digital Observer Standalone Marketing, Lead Funnel & Public Website

Phase 178 prepares Digital Observer as a standalone marketing and acquisition surface inside the existing Gan Batuach project.

This does not create a new repository, Supabase project, Vercel project or observer engine. Digital Observer remains inside the current codebase and reuses the existing camera, observer, AI, audit, usage and billing readiness layers.

## Public Website Structure

Current public route:

- `/digital-observer`

Future domain readiness:

- `observer.gan-batuach.co.il`
- `digital-observer.co.il`
- `app.digitalobserver.ai`

The public website is positioned as:

- English: `Digital Observer – AI-powered camera monitoring for homes and businesses.`
- Hebrew-ready: `התצפיתן הדיגיטלי – ניטור חכם למצלמות הבית והעסק.`

Homepage sections:

- Hero
- What Digital Observer does
- How it works
- Use cases
- Camera connection
- AI monitoring
- Alerts
- Packages
- Trust and privacy
- FAQ
- CTA

## Use Case Pages

Prepared routes:

- `/digital-observer/home`
- `/digital-observer/business`
- `/digital-observer/office`
- `/digital-observer/warehouse`
- `/digital-observer/store`
- `/digital-observer/parking`

Each page includes:

- problem
- solution
- camera setup
- monitoring goals
- alerts
- recommended package
- CTA

Messaging is tailored by segment:

- Home: peace of mind, camera offline alerts, night monitoring, privacy control
- Business: after-hours monitoring, restricted area alerts, camera health, multi-user access
- Office: after-hours monitoring, entrance visibility, camera health
- Warehouse: movement after hours, restricted zones, camera coverage
- Store: after-hours presence, obstruction, activity monitoring
- Parking: perimeter visibility, after-hours motion, obstruction and camera health

## Pricing Page

Route:

- `/digital-observer/pricing`

Packages shown from the shared Digital Observer product model:

- Home Basic
- Home Plus
- Business Basic
- Business Pro
- Enterprise Monitoring

Each package shows:

- camera limit
- monitoring hours
- event retention
- recording readiness
- alert channels
- AI features
- monthly price readiness
- annual price readiness

Pricing values are readiness values. Real billing remains disabled unless a payment provider mode is explicitly configured.

## Demo Flow

Route:

- `/digital-observer/request-demo`

Fields:

- name
- phone
- email
- site type
- business or home name
- city
- number of cameras
- current camera system
- preferred contact method
- package interest
- notes

Submitting the form creates a standalone Digital Observer lead:

- `product_type = digital_observer`
- `source = digital_observer_demo`
- no kindergarten record
- no child record
- no parent record
- no staff record

## Start Monitoring Flow

Route:

- `/digital-observer/start`

Flow readiness:

1. choose site type
2. choose package
3. create account or continue
4. add site
5. continue to `/digital-observer/onboarding`

If a full account flow is not active yet, the route creates a Digital Observer lead and shows follow-up/onboarding readiness.

## Lead Model

The existing `digital_observer_leads` model is extended instead of creating a duplicate CRM.

Tracked fields include:

- `product_type`
- `source`
- `site_type`
- `package_interest`
- `camera_count`
- `contact_name`
- `contact_phone`
- `contact_email`
- `city`
- `business_name`
- `lead_status`
- `conversion_status`
- `interest_score`
- `preferred_contact_method`
- `current_camera_system`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`

Lead sources include:

- `digital_observer_home`
- `digital_observer_business`
- `digital_observer_office`
- `digital_observer_warehouse`
- `digital_observer_store`
- `digital_observer_parking`
- `digital_observer_demo`
- `digital_observer_pricing`
- `digital_observer_start`
- `referral`
- `campaign`

## Admin Lead Management

Route:

- `/dashboard/admin/digital-observer-leads`

Admin can review:

- new leads
- demo requests
- package interest
- site type
- camera count
- city
- contact status
- conversion readiness

Readiness actions:

- contact lead
- qualify
- reject
- convert to observer site
- assign follow-up
- send onboarding link

Lead conversion must create:

- `observer_site`
- `observer_site_owner` / site member mapping
- onboarding draft
- package selection
- trial or subscription readiness

It must not create Gan Batuach kindergarten records.

## Marketing Analytics

Route:

- `/dashboard/admin/digital-observer-growth`

Internal analytics readiness includes:

- leads
- lead source
- package interest
- conversion readiness
- city demand
- site type demand
- demo requests
- onboarding starts
- CTA events

Tracked event types:

- `homepage_cta_click`
- `pricing_cta_click`
- `demo_form_started`
- `demo_form_submitted`
- `start_monitoring_clicked`
- `package_selected`
- `onboarding_started`

No external analytics provider is required.

## Trust Page

Route:

- `/digital-observer/trust`

Trust messaging includes:

- privacy controls
- data separation readiness
- audit logs
- camera access controls
- secure tokens
- user permissions
- ISO readiness

The page does not claim ISO certification.

Allowed wording:

- ISO readiness
- secure camera access readiness
- audit readiness
- policy-gated capabilities

Disallowed wording unless externally proven:

- ISO certified
- legally approved
- guarantees safety
- prevents all incidents

## Safe Marketing Copy Rules

Avoid:

- prevents all incidents
- guarantees safety
- replaces human security completely
- identifies criminals
- detects violence with certainty
- watches everything without limits

Use:

- helps monitor
- detects unusual activity
- supports review
- sends alerts
- improves visibility
- helps respond faster
- camera health monitoring

## Capability-Aware Marketing

Marketing copy must respect the capability matrix.

If a capability is:

- disabled
- legal_review_required
- future_only

then it must not be marketed as active.

Sensitive capabilities that must not be marketed as active by default:

- face recognition
- face matching
- audio analytics
- speech recognition
- gait recognition
- soft biometric matching

## Demo Data Rules

Demo content must be synthetic.

It must not include:

- real people
- real private data
- real camera credentials
- real RTSP URLs
- real payment data

Prepared demo scenarios:

- home site
- business site
- warehouse site
- camera health examples
- observer alerts
- monitoring schedule examples

## Follow-Up Templates

Prepared templates:

- demo request received
- follow-up reminder
- onboarding link
- trial started
- camera setup reminder
- package suggestion

Real email, SMS or WhatsApp sending remains provider-mode gated.

## Product Separation

Gan Batuach remains:

- kindergarten safety and management platform
- children
- parents
- staff
- inspectors
- Israeli kindergarten regulatory mode

Digital Observer is:

- camera monitoring and observer platform
- observer sites
- site owners
- site members
- packages
- camera health
- generic monitoring goals

The two products share infrastructure but must not mix customer records or billing streams.

## Remaining Setup

Remaining external/manual steps:

- configure real Digital Observer domain in Vercel
- connect production DNS
- finalize pricing
- configure payment provider mode
- approve marketing copy externally where needed
- connect real email/WhatsApp/SMS provider sending
- implement full lead-to-account self-service signup if desired
- add external analytics only if approved
