# Gan Batuach 100 Kindergarten Scale Program Report

Status: initial executive readiness report. This is not a national launch approval.

## Executive Summary

Gan Batuach now has a controlled operating framework for scaling toward 100 kindergartens through three cohorts: first 25, next 25 and next 50.

Baseline readiness score: 61/100.

Recommended decision: pause and stabilize until support, inspector capacity, billing reliability and privacy/security checks are validated during the first cohorts.

## Cohort Summary

Initial structure:

- First 25 Stabilization Cohort
- Next 25 Operating Cohort
- Next 50 Expansion Cohort

The 100-kindergarten program should remain controlled and should not become a national launch.

## Revenue

Pricing baseline:

- 800 NIS/month base package
- includes one age group/class
- 200 NIS/month per additional age group/class
- annual subscription paid monthly

Initial model:

- Average revenue per kindergarten: about 1,100 NIS/month
- Projected MRR for 100 kindergartens: about 110,000 NIS
- Projected ARR: about 1,320,000 NIS

Actual revenue should be measured only after paid kindergartens are activated.

## Unit Economics

Tracked costs:

- support cost
- inspector cost
- infrastructure cost
- communication cost
- payment processing cost
- invoice cost
- camera/AI cost estimate
- onboarding cost

Baseline contribution margin requires validation against real provider costs, support staffing and inspector routing.

## Support Load

Forecast:

- 25 kindergartens: part-time support needed
- 50 kindergartens: full-time support needed
- 100 kindergartens: onboarding specialist required
- 250 kindergartens: technical support specialist required

Main expected support pressure:

- parent onboarding
- login and registration
- document uploads
- payment setup
- staff onboarding
- camera setup if enabled

## Inspector Load

Inspection assumptions:

- one inspection per kindergarten per month
- 90 minute inspection
- 45 minute travel estimate
- 30 minute admin/reporting estimate
- follow-up and complaint-driven inspections included

100 kindergartens require roughly six inspectors or an equivalent route-optimized regional scheduling model.

## Parent Activation

Targets:

- 70% minimum
- 80% healthy
- 90% excellent

Parent activation is a critical go/no-go factor because low parent adoption reduces product value and increases churn risk.

## Staff Activation

Target:

- 80% staff activation minimum

Tracked signals:

- profile completion
- document completion
- attendance usage
- task usage
- child update usage
- incident reporting readiness

## Manager Adoption

Tracked signals:

- login frequency
- command center usage
- child management
- parent communication
- staff management
- payments
- documents
- compliance
- inspections

Manager adoption is the strongest operational indicator that a kindergarten is actually using Gan Batuach.

## Infrastructure Findings

The scale program now tracks:

- Vercel latency
- Supabase load
- API latency
- database load
- storage growth
- auth and realtime usage
- background jobs
- provider health
- communications volume
- camera and AI readiness

Database checks should focus on slow queries, missing indexes, large tables, audit log growth, notification log growth, RLS performance and migration safety.

## Privacy And Security Findings

Scale checks cover:

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

Critical blockers include parent boundary failures, sensitive file exposure, service-role exposure, medical data exposure, unaudited sensitive access and raw AI exposure to parents.

## Camera And AI Findings

Camera scale is readiness-only unless explicitly approved.

AI Observer remains constrained:

- no raw AI parent visibility
- Gan Batuach Israel Mode enforced
- human review required
- no automatic accusations
- shadow mode for unproven detection behavior

Camera and AI should not be expanded at the same time as onboarding unless support and gateway capacity are proven.

## Churn Risk

Initial churn signals:

- low parent activation
- failed payments
- unresolved support tickets

Recommended actions:

- call manager
- schedule training
- offer onboarding help
- review payment issue
- resolve support blocker

## Next Expansion Recommendation

Current recommendation: pause and stabilize.

Required next actions:

- run the first 25 cohort
- measure real parent activation
- assign support owner
- assign inspector pool
- validate payment health
- review privacy/security checks weekly
- keep cameras and AI limited until operational capacity is proven

## Not Approved Yet

This report does not approve:

- national launch
- onboarding hundreds of kindergartens
- unrestricted camera rollout
- production AI automation
- mass real notifications
- weakening privacy/security controls for speed
