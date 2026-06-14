# Regional Scale-Up, Operational Scaling and 50-100 Kindergarten Expansion

Status: readiness framework only. This phase prepares a controlled regional rollout and does not authorize national launch.

## Purpose

Phase 175 prepares Gan Batuach to grow from the first 10-25 commercial kindergartens into a controlled regional cohort of 50-100 kindergartens while keeping support, inspections, payments, privacy, security, parent adoption and system performance stable.

The rollout must remain regional and measured. Camera viewing and AI Observer features stay gated by the existing privacy, legal, MFA, audit and capability-policy controls.

## Regional Rollout Model

The `regional_rollout_cohorts` registry tracks each 50-100 kindergarten cohort by city, region, sales source, kindergarten network or parent-demand cluster.

Core controls:

- Cohort size is constrained to 50-100 kindergartens.
- Cohort statuses are `planned`, `recruiting`, `onboarding`, `active`, `stabilizing`, `completed` and `paused`.
- Each cohort tracks owner, success criteria, dates and operational notes.
- The dashboard surfaces target kindergartens, active kindergartens, rollout status and launch decision.

## Growth and Demand Planning

The `regional_growth_plans` and `regional_parent_demand_scaling` tables track city-level demand:

- total target kindergartens
- active kindergartens
- leads
- parent demand requests
- demo bookings
- conversion rate
- inspector coverage
- support load
- recommended outreach priority

This lets the company prioritize the strongest city or region without rushing into national launch.

## Onboarding Capacity Model

The `regional_onboarding_capacity` model measures how many kindergartens can be onboarded per week.

Tracked signals:

- average activation time
- manager onboarding time
- staff onboarding time
- parent onboarding rate
- document completion rate
- payment setup completion
- support interventions required

Automation tasks are tracked in `regional_onboarding_automation_tasks` for:

- incomplete manager onboarding
- staff not activated
- parents not activated
- missing documents
- payment not completed
- first inspection not scheduled

## Support Model

The `regional_support_forecasts` table estimates support load for 50, 100, 250 and 500 kindergartens.

Forecast dimensions:

- tickets per kindergarten
- parent support volume
- manager support volume
- staff support volume
- payment support volume
- camera support volume
- average response and resolution time
- recommended support staffing

The phase recommends assigning support before 100 active gardens and creating specialist paths for payments, cameras and parent onboarding before larger scale.

## Inspector Model

The `regional_inspector_capacity` and `regional_inspector_workloads` tables calculate inspector capacity using:

- one inspection per kindergarten per month
- average inspection duration
- travel time
- follow-up inspections
- complaint-driven inspections
- urgent inspections

The dashboard highlights overload risk, overdue inspections and complaint visits. A regional cohort should not activate unless inspection capacity is assigned.

## Revenue and Pricing Model

Regional revenue validation is tracked in `regional_revenue_scale_validation`.

Pricing baseline:

- 800 NIS/month base package
- includes one age group/class
- 200 NIS/month for each additional age group/class
- annual subscription paid monthly

The `regional_unit_economics` model tracks per-kindergarten economics:

- subscription revenue
- extra class revenue
- discounts
- inspector cost
- support cost
- infrastructure cost
- communication cost
- payment processing cost
- AI/camera cost estimate
- gross margin
- contribution margin
- break-even estimate

## Infrastructure Scale Readiness

The `regional_infrastructure_scale_checks` registry tracks:

- Vercel performance
- Supabase performance
- database query load
- storage growth
- API latency
- background jobs
- email/SMS/WhatsApp volume
- push volume
- RLS performance
- audit and event log growth

Scale-up should pause if infrastructure checks move to `blocked` or repeated `needs_optimization`.

## Database Scale Readiness

Database readiness focuses on:

- slow queries
- missing indexes
- large tables
- RLS performance
- storage growth
- audit log growth
- event log growth

The dashboard links back to the database integrity center for deeper migration/RLS/storage review.

## Camera and AI Scale Readiness

The `regional_camera_observer_scale_readiness` model tracks camera and AI scale separately.

Camera readiness:

- cameras per kindergarten
- active streams
- offline cameras
- gateway load
- parent viewing sessions
- viewing token volume
- audit log volume
- bandwidth estimate

AI Observer readiness:

- observer events
- review queue volume
- false positives
- false negatives
- reviewer workload
- calibration status
- shadow mode status

Gan Batuach restrictions remain active:

- no raw AI parent visibility
- no audio monitoring
- no face recognition
- no automatic accusations
- human review required

## Adoption Metrics

The `regional_adoption_metrics` table separates:

- parent adoption
- staff adoption
- manager adoption

Tracked examples:

- invited users
- activated users
- daily active users
- timeline usage
- messages
- notifications
- payment usage
- attendance usage
- task completion
- command center usage

## Churn Prevention

The `regional_churn_risk_signals` and `regional_customer_health_scores` models track:

- low manager usage
- low parent activation
- repeated support tickets
- failed payments
- incomplete onboarding
- unresolved bugs
- poor satisfaction
- low staff adoption

Customer Health Score 2.0 combines usage, payment status, support load, onboarding completion, parent adoption, staff adoption, compliance readiness, inspection completion and satisfaction.

## Customer Success Workflow

The `regional_customer_success_tasks` table creates operational tasks for:

- low adoption kindergarten
- high support kindergarten
- payment risk
- missing onboarding
- staff not activated
- parents not activated
- inspection overdue
- renewal risk

The `regional_training_content_needs` table tracks repeated support issues and new content requirements for manager onboarding, parent onboarding, staff onboarding, payments, documents, camera setup, inspections and privacy.

## Sales Operations Scaling

The `regional_sales_operations_metrics` table tracks:

- leads per week
- demos per week
- overdue follow-ups
- conversion rate
- lost reasons
- city demand
- referral performance

This ties regional demand and referral growth back into commercial operations.

## Risk Register

The `regional_rollout_risks` register tracks:

- technical risks
- support risks
- payment risks
- legal/privacy risks
- camera risks
- AI risks
- inspection capacity risks
- customer success risks
- churn risks
- reputation risks

Severity levels are `critical`, `high`, `medium` and `low`.

## Expansion Decision Framework

The `regional_expansion_decisions` table supports recommendations after 50-100 kindergartens:

- pause and stabilize
- continue to 250 kindergartens
- expand to new city
- hire support
- hire inspectors
- optimize infrastructure
- adjust pricing
- delay camera/AI rollout

The `regional_scale_readiness_scores` table calculates a 0-100 readiness score based on:

- regional growth
- onboarding capacity
- support readiness
- inspector capacity
- revenue validation
- infrastructure readiness
- adoption metrics
- churn prevention

## Remaining Scale Blockers

- Complete the first 10-25 commercial rollout before activating a 50-100 cohort.
- Assign regional support ownership and staffing.
- Assign inspector pool and travel model.
- Validate real payment provider and invoice provider volume.
- Monitor Supabase and Vercel performance under realistic regional load.
- Keep cameras readiness-only until gateway capacity and legal parent viewing approvals are validated.
- Keep AI Observer in shadow mode with human review and no raw parent visibility.
