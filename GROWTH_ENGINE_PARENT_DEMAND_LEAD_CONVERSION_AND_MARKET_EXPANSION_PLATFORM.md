# Growth Engine, Parent Demand, Lead Conversion & Market Expansion Platform

## Objective

Phase 143 turns Gan Batuach acquisition into one measurable growth system. Demo bookings, kindergarten registrations, parent requests, referrals and campaigns now enter a unified growth layer instead of living as disconnected forms.

## Lead Lifecycle

Primary lifecycle:

1. Visit
2. Lead
3. Demo
4. Qualification
5. Approval
6. Conversion
7. Activation

Unified statuses:

- `new`
- `contacted`
- `qualified`
- `approved`
- `converted`
- `rejected`

Unified sources:

- `demo_booking`
- `kindergarten_registration`
- `parent_request`
- `referral`
- `campaign`

## Growth Data Model

`growth_leads` is the central commercial lead model. It mirrors existing public leads while preserving the legacy `leads` table used by current admin conversion flows.

Core fields:

- source lead reference
- lead source
- lifecycle status
- funnel stage
- interest score
- kindergarten and contact details
- campaign fields
- qualification details
- conversion metadata

Existing public forms continue to create `leads`. When Phase 143 tables exist, server actions also create a matching `growth_leads` row. The mirror is non-blocking so public forms remain resilient if a migration has not been applied yet.

## Demo Lifecycle

The existing “קבע הדגמה” flow remains active.

Flow:

Demo booking -> Lead created -> Growth lead mirrored -> Admin follow-up -> Qualification -> Convert to kindergarten onboarding.

Demo requests are visible in:

- `/dashboard/admin/leads`
- `/dashboard/admin/growth`

## Parent Demand Model

Parent-origin requests are grouped by kindergarten, city and address in `growth_parent_demand_clusters`.

The system tracks:

- request count
- available parent contacts
- known manager contacts
- high demand signal
- recommended next action

High demand is flagged when multiple parents request the same kindergarten.

## Conversion Workflow

Admin conversion remains anchored in the existing lead center.

Supported lead types:

- demo booking
- kindergarten registration
- parent request
- referral
- campaign

When approved, the existing conversion flow can create:

- pending kindergarten record
- manager profile or invitation
- onboarding process

That continues into the Phase 139 onboarding and activation flow.

## Communication Model

`growth_lead_communications` prepares outreach tracking across:

- WhatsApp
- SMS
- Email
- Phone
- In-app

Templates supported:

- demo confirmation
- follow-up
- onboarding invitation
- registration reminder

No real sending is automatically enabled by this phase.

## Automated Follow-Up

`growth_follow_up_tasks` prepares operational reminders for:

- incomplete registration
- missed demo
- pending activation
- pending payment
- parent demand follow-up
- campaign follow-up
- referral follow-up

These are trackable tasks, not autonomous business decisions.

## Campaign & Referral Tracking

`growth_campaign_metrics` tracks campaign performance by date.

`growth_referrals` prepares support for:

- kindergarten referrals
- parent referrals
- partner referrals

The admin dashboard shows source performance and conversion signals.

## Admin Growth Command Center

Route:

`/dashboard/admin/growth`

The dashboard shows:

- total leads
- demos
- parent demand
- active pipeline
- conversions
- average interest score
- high demand kindergartens
- city growth concentration
- conversion funnel
- follow-up tasks
- communication readiness
- AI growth assistant prompts

## AI Growth Assistant

Prepared questions:

- Which leads need follow-up?
- Which cities have strongest demand?
- Which kindergartens are likely to convert?
- Which campaigns perform best?

AI remains advisory. It does not approve, reject or convert leads automatically.

## Audit Model

`growth_lead_audit_logs` records lead lifecycle changes and administrative actions.

Tracked events include:

- creation
- contact attempts
- qualification
- approval
- conversion
- rejection

## Privacy & Safety Rules

- Parent-origin leads are commercial demand signals, not child records.
- No private child data is exposed in growth reporting.
- Parent contact details are admin-only.
- Conversion to kindergarten onboarding still requires human admin approval.
- Growth scoring is an operational prioritization signal only.

## Remaining Production Gaps

- Real WhatsApp/SMS/email follow-up sending must connect to production providers.
- Calendar scheduling can be connected to a real calendar provider later.
- Referral reward policy must be defined before public launch.
- Campaign ROI needs real ad spend or attribution data.
- Full lead conversion automation should remain gated by admin approval.
