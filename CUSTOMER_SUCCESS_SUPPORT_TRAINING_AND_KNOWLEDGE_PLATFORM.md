# Customer Success, Support, Training & Knowledge Platform

## Purpose

Phase 142 creates the operational layer that keeps Gan Batuach customers successful after activation.

Customer Success starts immediately after a kindergarten is activated. The goal is proactive adoption, fewer unresolved issues, higher satisfaction and lower churn.

## Customer Lifecycle

Lifecycle statuses:

- lead
- demo booked
- approved
- onboarding
- active
- at risk
- renewal pending
- suspended
- churned

Lifecycle changes are tracked in `customer_lifecycle_events`.

## Health Score Model

Customer health is stored in `customer_health_scores`.

Score factors:

- platform usage
- login frequency
- parent adoption
- staff adoption
- inspection completion
- compliance completion

The final `customer_health_score` is a 0-100 score with renewal risk:

- low
- medium
- high
- critical

## Onboarding Model

The Customer Success Center tracks:

- manager onboarding
- staff onboarding
- parent onboarding
- document completion
- payment completion

Follow-up work is represented as `customer_success_tasks`.

Task types:

- onboarding follow-up
- document completion
- payment follow-up
- renewal follow-up
- training
- support follow-up
- adoption review
- churn prevention

## Support Workflow

Support tickets are stored in `support_tickets`.

Supported ticket types:

- issue
- feature request
- bug
- billing
- onboarding
- training
- technical
- account

Ticket statuses:

- open
- assigned
- in progress
- waiting customer
- resolved
- closed

Channels:

- WhatsApp
- Email
- In-app
- Phone
- Admin

The current phase prepares the unified support view. Real provider integration remains connected through the communications platform.

## Training Model

Training content is stored in `training_hub_items`.

Supported formats:

- videos
- tutorials
- walkthroughs
- checklists
- onboarding guides
- articles

Completion is tracked in `training_completion_records`.

Training supports:

- required onboarding material
- role-specific guidance
- progress percentage
- completion status
- future certification issuance

## Knowledge Base

The Help Center is powered by `knowledge_base_articles`.

Categories:

- parents
- staff
- managers
- inspectors
- admins
- billing
- cameras
- onboarding
- troubleshooting

Articles include searchable keywords and publication status.

## Renewal And Retention Model

Renewal and churn risk signals are stored in `renewal_risk_signals`.

Risk sources:

- low usage
- low engagement
- unresolved issues
- failed payments
- incomplete onboarding
- expiring renewal
- support overload

Recommended actions may include:

- schedule training
- contact manager
- resolve tickets
- review onboarding
- open churn-prevention task

## Success Playbooks

Reusable playbooks are stored in `success_playbooks`.

Initial playbooks:

- new kindergarten first 14 days
- low engagement recovery
- renewal risk save

Future playbooks can cover compliance risk, staff adoption issues and payment risk.

## Reporting And Analytics

Customer Success reporting uses:

- `customer_success_surveys`
- `product_adoption_analytics`
- `customer_success_reports`

Tracked outcomes:

- onboarding
- adoption
- retention
- satisfaction
- NPS readiness
- feature usage

## Privacy And Permissions

Access is scoped by existing garden access rules:

- admins can view all customer success data
- assigned users can view their tickets and tasks
- managers and network managers see only data for gardens they can access
- customer-level analytics do not expose private child records

## Remaining Gaps

- Add ticket creation forms for managers and parents.
- Connect WhatsApp, email and in-app support channels into automatic ticket creation.
- Add automated customer health calculation jobs.
- Add guided training player pages.
- Add public searchable Help Center UI for non-admin users.
- Add survey sending and response collection workflows.
