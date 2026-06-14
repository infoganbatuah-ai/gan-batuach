# Gan Batuach 100 Kindergarten Scale Program

Status: controlled scale readiness only. This program does not approve national launch or uncontrolled onboarding.

## Purpose

Phase 185 prepares Gan Batuach to scale from the first 10-25 commercial kindergartens into a controlled 100-kindergarten operating program.

The program validates whether onboarding, support, inspections, payments, parent adoption, staff adoption, privacy, security, infrastructure and revenue can hold together under real growth.

## Scale Model

The 100-kindergarten program is split into three controlled cohorts:

- First 25: stabilization and repeatability.
- Next 25: operating capacity validation.
- Next 50: pressure test toward 100 kindergartens.

The `kindergarten_scale_cohorts` registry tracks each cohort with owner, dates, region/city, target count, status and success criteria.

Allowed statuses:

- `planned`
- `recruiting`
- `onboarding`
- `active`
- `stabilizing`
- `completed`
- `paused`

## Kindergarten Scale Profile

Each kindergarten in the program is tracked in `kindergarten_scale_profiles`.

Tracked fields include:

- source
- city and region
- manager
- age groups/classes
- subscription amount
- payment status
- onboarding status
- parent activation
- staff activation
- document status
- inspection status
- support status
- churn risk
- customer health score

This keeps the 100-kindergarten program operationally visible instead of becoming a loose sales list.

## Onboarding Capacity

The `scale_100_onboarding_metrics` model tracks:

- average time to activate a kindergarten
- average time to invite staff
- average time to activate parents
- average time to upload documents
- average time to complete payment setup
- support touches per kindergarten
- blocked onboarding count

The scale goal is to reduce manual work per kindergarten before expanding to the next cohort.

## Onboarding Automation

Automation tasks are tracked in `scale_100_automation_tasks`.

Required task types:

- manager onboarding incomplete
- missing documents
- staff not activated
- parents not activated
- payment not completed
- pricing not configured
- first inspection not scheduled
- training not completed

Reminder channel readiness:

- in-app
- email
- SMS readiness
- WhatsApp readiness

No production mass messaging should be activated unless provider mode and communication preferences permit it.

## Adoption Targets

The `scale_100_adoption_targets` table separates parent, staff and manager adoption.

Parent targets:

- 70% activation minimum
- 80% activation healthy
- 90% activation excellent

Tracked parent signals:

- parents invited
- parents activated
- child registration completed
- login rate
- message read rate
- notification opt-in
- payment approval
- daily timeline usage

Staff targets:

- 80% activation minimum
- profile completed
- documents uploaded
- attendance usage
- task usage
- child update usage
- incident reporting readiness

Manager targets:

- login frequency
- command center usage
- child management
- parent communication
- staff management
- payments
- documents
- compliance
- inspections

## Support Capacity

The `scale_100_support_capacity` forecast estimates support needs for:

- 25 kindergartens
- 50 kindergartens
- 100 kindergartens
- 250 kindergartens

Inputs include:

- tickets per kindergarten
- tickets per parent
- tickets per staff member
- average response time
- average resolution time
- repeated issue categories
- unresolved critical tickets
- overloaded support days

Recommendations include:

- no additional support needed
- part-time support needed
- full-time support needed
- dedicated onboarding specialist needed
- technical support specialist needed

## Inspector Capacity

The `scale_100_inspector_capacity` model assumes at least one monthly inspection per kindergarten.

Tracked inputs:

- monthly inspections required
- inspections completed
- overdue inspections
- follow-up inspections
- complaint-driven inspections
- inspection duration
- travel time
- admin/reporting time
- GPS validation completion
- signature completion

The baseline forecast expects about six inspectors or equivalent regional scheduling capacity for 100 kindergartens.

## Monthly Inspection Coverage

100 kindergartens must not break the inspection model.

The required operating state:

- monthly coverage tracked
- overdue inspections surfaced
- unresolved findings tracked
- corrective actions followed
- PDF reports completed
- GPS validation completed
- signatures completed

## Revenue Model

Gan Batuach subscription pricing remains:

- 800 NIS/month base
- includes one age group/class
- 200 NIS/month per additional age group/class
- annual subscription paid monthly

The `scale_100_revenue_unit_economics` table tracks:

- MRR
- ARR
- collected revenue
- projected revenue
- failed payments
- overdue payments
- discounts
- average revenue per kindergarten
- revenue by cohort
- gross margin
- contribution margin
- break-even estimate

## Payment Separation

Revenue streams remain separated:

1. Gan Batuach subscriptions: kindergarten pays Gan Batuach.
2. Parent tuition payments: parent pays kindergarten account/provider.
3. Digital Observer subscriptions: Digital Observer customer pays the Digital Observer product account.

The 100-kindergarten program must not mix parent tuition payments into Gan Batuach revenue.

## Infrastructure Readiness

The `scale_100_infrastructure_checks` registry tracks:

- Vercel performance
- Supabase performance
- API latency
- database load
- storage usage
- auth usage
- realtime usage
- build health
- background jobs
- provider health
- database scale
- communications volume
- camera scale
- AI Observer scale

Scale alerts should be created for:

- slow routes
- slow queries
- high error rate
- storage growth
- provider failure
- webhook failures

## Database Readiness

Database readiness focuses on:

- slow queries
- missing indexes
- large tables
- audit log growth
- notification log growth
- payment log growth
- observer event growth
- RLS performance
- migration safety

Recommended actions include adding indexes, archiving logs, optimizing queries, paginating heavy tables and reducing client payloads.

## Communications Volume

The program tracks readiness for:

- email
- SMS
- WhatsApp
- push
- in-app notifications

Cost and provider limits should be estimated before large-scale reminders are enabled.

## Camera And AI Readiness

Camera scale is readiness-only unless explicitly approved.

Tracked camera signals:

- cameras per kindergarten
- total cameras
- online/offline cameras
- gateway load
- parent viewing sessions
- token creation volume
- audit log volume
- bandwidth estimate
- camera support tickets

AI Observer remains restricted:

- no raw AI events visible to parents
- Gan Batuach Israel Mode enforced
- human review required
- shadow mode for unproven observer behavior

## Privacy And Security

The `scale_100_privacy_security_checks` model validates:

- MFA adoption
- sensitive action MFA gates
- audit coverage
- medical data encryption
- private document storage
- camera access logs
- parent data isolation
- staff data isolation
- inspector scope
- admin action logging
- RLS
- service role safety

High-risk alerts include:

- parent access boundary risk
- sensitive file exposure
- RLS gap
- unaudited sensitive access
- service role misuse risk

## Customer Health And Churn Prevention

The `scale_100_customer_health` score combines:

- manager usage
- parent activation
- staff activation
- payment status
- support load
- document completion
- inspection readiness
- compliance readiness
- satisfaction
- churn indicators

Health statuses:

- `healthy`
- `needs_attention`
- `at_risk`
- `critical`

The `scale_100_churn_risk_signals` table triggers recommended actions such as calling the manager, scheduling training, offering onboarding help, reviewing payment issues or resolving support blockers.

## Training And Knowledge Base

Training modules and support articles are tracked in `scale_100_training_knowledge`.

Required categories:

- registration
- login
- payments
- documents
- staff onboarding
- parent onboarding
- manager onboarding
- camera setup
- notifications
- inspections
- privacy/security
- daily operations

The goal is support deflection and repeated-issue reduction before expansion.

## Regional Sales Insights

The `scale_100_sales_insights` table tracks:

- leads by city
- parent demand by city
- demo conversion by city
- sales objections
- lost reasons
- referral sources
- high-demand kindergartens
- competitor mentions

These signals guide which region should be selected for the next cohort.

## Scale Risk Register

The `scale_100_risk_register` covers:

- technical
- support
- inspection
- payment
- legal/privacy
- security
- camera
- AI
- onboarding
- customer success
- reputation

Severity levels:

- critical
- high
- medium
- low

Statuses:

- open
- in_progress
- mitigated
- accepted_risk
- closed

## Success Criteria

Baseline success criteria:

- 100 kindergartens onboarded or in active rollout
- 85% manager onboarding completed
- 70% parent activation minimum
- 80% staff activation minimum
- 95% successful billing configuration
- monthly inspection coverage operational
- no critical privacy/security incidents
- support load within forecast
- positive unit economics
- churn risk manageable

## Expansion Decision Model

After the 100-kindergarten program, admin can recommend:

- pause and stabilize
- continue to 250 kindergartens
- expand to another region
- hire inspectors
- hire support
- improve onboarding automation
- adjust pricing
- delay camera rollout
- delay AI rollout
- strengthen infrastructure

The baseline recommendation is to pause and stabilize until the first 25 and next 25 cohorts prove repeatable onboarding, support, inspections, billing and privacy/security controls.
