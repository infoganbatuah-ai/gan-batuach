# Super Admin & National Control Center

Date: 2026-06-11

Scope: PHASE UX-FINAL-6 super admin executive command center.

## Goal

Transform the admin experience into a national-level command center for kindergartens, inspectors, subscriptions, AI systems, cameras, communication and launch readiness.

## Screens Changed

- `/dashboard/admin`
- Shared admin control-center styling in `app/globals.css`

## National Command Center

The admin dashboard now starts with:

- platform health score
- active kindergartens
- active inspectors
- active children
- active staff
- active subscriptions
- launch blockers
- security findings

The first screen answers:

> What is the health of the entire platform?

## Executive KPI Center

The dashboard now shows:

- MRR
- ARR
- active customers
- weekly growth rate
- churn risk
- launch readiness
- inspection completion

These are calculated from existing subscription, garden, launch and inspection data where available.

## National Safety Dashboard

The dashboard now groups:

- critical complaints
- active incidents
- overdue inspections
- observer alerts
- recent complaint and observer feed

## Kindergarten Control Center

The admin dashboard now includes a compact kindergarten list with:

- kindergarten name
- city
- status
- safety score / inspection status
- link to kindergarten profile

Detailed bulk workflows remain in the existing kindergarten management screens.

## Inspector Management Center

The admin dashboard now includes inspector visibility:

- inspector name
- assigned city/region
- active status
- link to inspector management

## Digital Observer Control Center

The dashboard now exposes:

- observer alert count
- AI alert routing
- link to observer calibration/control pages

## Camera Operations Center

The dashboard now exposes:

- total cameras
- offline/unhealthy cameras
- camera health score
- link to camera deployment/operations

## Communication Operations Center

The dashboard now exposes:

- communication failures
- communication health score
- link to communication operations

## Subscription & Revenue Center

The dashboard now exposes:

- active subscriptions
- expiring subscriptions
- overdue accounts
- MRR and ARR

No payment provider integration was changed in this phase.

## National Complaint Center

The dashboard now shows:

- open complaints
- critical/high complaints
- recent complaint feed
- link to complaint management

## National Search

The admin shell already includes global search behavior. The dashboard primary search action routes to user management for now because no dedicated `/dashboard/admin/search` page exists yet.

## AI Executive Assistant Foundation

The dashboard now includes executive prompt links:

- Which kindergartens need attention?
- Which inspectors are overloaded?
- Which subscriptions are at risk?
- What are the top safety concerns this month?

No new AI backend was added.

## Launch & Readiness

The dashboard surfaces:

- launch readiness score
- launch blockers
- security findings
- active pilot programs

## Remaining Admin UX Issues

- Dedicated national search page is still missing.
- Revenue trend charts need historical subscription/payment data normalization.
- Bulk kindergarten actions remain in existing management surfaces and were not rebuilt here.
- Executive report generation remains routed through existing report screens; no new PDF/report engine was added.
- Browser QA on tablet/mobile still requires a running local or deployed environment.
