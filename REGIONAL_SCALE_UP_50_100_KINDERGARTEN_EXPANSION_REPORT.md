# Regional Scale-Up 50-100 Kindergarten Expansion Report

Status: initial readiness report. This is not a national launch approval.

## Executive Summary

Gan Batuach now has a regional scale-up framework for moving from 10-25 kindergartens to a controlled 50-100 kindergarten cohort.

Baseline readiness score: 59/100.

Recommended decision: continue regional stabilization before activating the cohort.

## Rollout Summary

Initial cohort:

- Cohort: Central Region Controlled Scale-Up
- Target: 75 kindergartens
- Region: Center
- Source: regional rollout
- Status: planned

The cohort should only move to active after the first commercial rollout is stable and operational capacity is assigned.

## Revenue

Baseline forecast:

- Average price per kindergarten: 1,100 NIS/month
- Forecast MRR for 75 gardens: 82,500 NIS
- Current MRR: 0 NIS until cohort activation
- Pricing model: 800 NIS/month base plus 200 NIS/month per additional class

Pricing requires validation against willingness to pay, discount usage, churn risk and support cost.

## Support Load

Forecast:

- 50 gardens: part-time/dedicated support readiness
- 100 gardens: full-time support required
- 250 gardens: specialist support required
- 500 gardens: regional support organization required

Main expected load:

- parent onboarding
- manager onboarding
- staff onboarding
- payment setup
- camera setup
- repeated training questions

## Inspector Load

Forecast:

- 50 gardens: about 2.6 inspectors needed
- 100 gardens: about 5.2 inspectors needed
- 250 gardens: about 13 inspectors needed
- 500 gardens: about 26 inspectors needed

Expansion should not continue without inspector scheduling, travel assumptions and complaint-driven visit capacity.

## Onboarding Performance

Baseline onboarding capacity:

- 6 kindergartens per week
- 18 average activation days
- parent onboarding rate readiness: 62%
- document completion readiness: 68%
- payment setup readiness: 55%

Automation tasks required:

- incomplete manager onboarding reminders
- parent activation nudges
- payment setup escalation
- first inspection scheduling task

## Adoption Metrics

Tracked roles:

- parent
- staff
- manager

No real regional activation exists yet. Adoption baselines are readiness-only until the cohort starts.

Success targets:

- managers complete onboarding: at least 80%
- parents activate: at least 70%
- staff workflows used weekly
- support load manageable
- no critical privacy/security blockers

## Churn Risk

Initial risk signals:

- low parent activation
- repeated support tickets
- failed payments

Customer Health Score 2.0 should be reviewed weekly during the regional cohort.

## Infrastructure Findings

Infrastructure checks now track:

- Vercel latency
- Supabase query load
- database indexes
- storage growth
- audit log growth
- communications volume

Database and audit log growth should be watched before exceeding 100 gardens.

## Camera and AI Findings

Camera scale remains readiness-only.

AI Observer remains shadow-mode only.

Required controls:

- no direct RTSP exposure
- no camera credentials exposed
- parent viewing gated by policy
- no raw AI visible to parents
- human review required
- Gan Batuach Israel restrictions enforced

## Unit Economics

Baseline cost model tracks:

- inspector cost
- support cost
- infrastructure cost
- communication cost
- payment processing cost
- AI/camera cost estimate

Initial contribution margin estimate requires real provider and staffing data before commercial scale decisions.

## Next Expansion Recommendation

Recommended state: pause and stabilize before expanding beyond the first regional cohort.

Required next actions:

- complete first commercial rollout
- assign regional support owner
- hire or assign support capacity
- assign inspector capacity
- validate payment provider load
- monitor Vercel and Supabase performance
- keep camera rollout limited until gateway capacity is proven
- keep AI Observer in shadow mode

## Launch Decision

Current recommendation: continue stabilization.

Not yet recommended:

- national launch
- hundreds of kindergartens
- unrestricted camera rollout
- production AI observer automation

Potential next stage after successful 50-100 validation:

- continue to 250 kindergartens
- expand to a second city/region
- hire support and inspectors
- optimize infrastructure
- adjust pricing if churn or margin requires it
