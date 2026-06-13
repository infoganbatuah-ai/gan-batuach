# Website Lead Expansion, Kindergarten Registration & Parent Demand Platform

## Objective

Phase 144A closes the launch acquisition gap by making the public website a complete commercial entry system.

Gan Batuach now supports three independent public entry points:

- Book Demo
- Kindergarten Registration
- Parent Demand Request

All three flow into the same lead, growth and activation system.

## Public Entry Points

Homepage entry points:

- `קבע הדגמה` -> `/book-demo`
- `רישום גן ילדים` -> `/join-kindergarten`
- `הורים? לחצו כאן` -> `/parents`

These appear as primary website conversion paths, not hidden secondary pages.

## Lead Lifecycle

Commercial lead statuses:

- `new`
- `contacted`
- `qualified`
- `approved`
- `onboarding`
- `converted`
- `rejected`

Operational legacy statuses remain supported for existing activation flows.

Lead sources:

- `demo_booking`
- `public_kindergarten_registration`
- `parent_request`
- `referral`
- campaign sources

## Book Demo Workflow

Existing flow remains active:

1. Manager clicks `קבע הדגמה`.
2. Demo form creates a lead.
3. Lead source is `demo_booking`.
4. Admin follows up in `/dashboard/admin/leads`.
5. Qualified lead can be converted to kindergarten onboarding.

Demo confirmation templates are prepared for:

- email
- WhatsApp
- SMS

## Kindergarten Registration Workflow

Route:

`/join-kindergarten`

Purpose:

Convince kindergarten managers to join Gan Batuach and submit a registration request.

The page now presents:

- inspections
- transparency
- AI observer
- cameras
- compliance
- parent trust
- automation
- documents
- staff management
- payments
- safety
- comparison sections
- FAQ

Registration fields:

- manager name
- manager phone
- manager email
- kindergarten name
- city
- street
- building number
- age groups
- regulatory acceptance

Submission creates a kindergarten lead. Admin approval then starts the Phase 139 onboarding flow.

## Parent Demand Workflow

Route:

`/parents`

Purpose:

Convince parents that their child’s kindergarten should join Gan Batuach.

Parent request fields:

- parent name
- phone
- email
- kindergarten name
- kindergarten address
- child age group
- manager name, optional
- manager phone, optional
- unknown age option

Flow:

Parent lead -> Contact parent -> Contact kindergarten -> Manager agrees -> Create kindergarten onboarding -> Continue Phase 139.

Parents do not receive access to internal lead or investigation data.

## Parent Demand Scoring

Parent requests are grouped by kindergarten.

Demand levels:

- 1 parent: normal demand
- 5 parents: medium demand
- 10+ parents: high demand

The system updates:

- parent request count
- demand tier
- interest score
- recommended next action

## Admin Lead Workflow

Route:

`/dashboard/admin/leads`

Admin can:

- view demo leads
- view kindergarten registration leads
- view parent-origin leads
- view referral leads
- mark contacted
- request more information
- reject/archive
- convert to kindergarten registration

Conversion creates:

- pending kindergarten
- manager profile
- onboarding record
- one-time credentials

## Growth Analytics

Tracked acquisition metrics:

- visits
- leads
- demos
- registrations
- conversions
- parent requests
- demand by city
- demand by kindergarten
- demand by region readiness

AI growth questions prepared:

- Which leads need follow-up?
- Which city has strongest demand?
- Which kindergartens are most likely to convert?
- Which campaigns perform best?

## Communication Templates

Prepared templates:

- demo confirmation
- registration received
- onboarding invitation
- follow-up reminder

Channels:

- WhatsApp
- SMS
- Email

Real provider sending remains gated by production integration readiness.

## Launch Gaps Remaining

- Real campaign attribution requires production analytics.
- Referral reward rules are not finalized.
- WhatsApp/SMS/email production sending still requires provider activation.
- Region mapping should be connected to the enterprise regional model.
- Parent demand conversion still requires human admin follow-up and kindergarten consent.
