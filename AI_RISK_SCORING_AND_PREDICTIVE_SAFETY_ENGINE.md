# AI Risk Scoring And Predictive Safety Engine

PHASE 112 adds an advisory risk layer for Gan Batuach. The purpose is early prevention: identify repeated signals, explain what changed, and recommend calm human review before a problem grows.

## Core Principle

The engine does not accuse, discipline, notify parents in panic, or enforce actions automatically.

Every output is:

- advisory
- explainable
- reviewable by a human
- scoped to authorized roles
- hidden from public parent views unless later converted into an approved summary

## Risk Profile Model

The main table is `kindergarten_risk_profiles`.

It stores one current profile per kindergarten:

- `overall_risk_score`
- `safety_risk`
- `compliance_risk`
- `operational_risk`
- `staffing_risk`
- `observer_risk`
- `risk_level`
- `risk_trend`
- `predicted_risk_level`
- `prediction_summary`
- `top_contributors`
- `recommended_prevention_actions`
- `explanation`

Scores are 0-100, where a higher number means more risk. The system intentionally separates risk from quality rating: a strong kindergarten can still have a temporary rising risk if several signals repeat in the same week.

## Scoring Model

The current weighted model:

- Safety risk: 28%
- Compliance risk: 18%
- Operational risk: 20%
- Staffing risk: 14%
- Observer risk: 20%

Inputs include:

- complaints
- incidents
- inspections
- unresolved findings
- compliance alerts
- observer alerts
- camera outages
- attendance anomalies
- pickup anomalies
- rating trend changes

The score is capped at 100 and stored with a timestamp so the platform can show trend history.

## Prediction Model

The engine looks for repeated patterns in recent activity:

- repeated incidents
- repeated complaints
- repeated compliance failures
- repeated staffing issues
- repeated observer alerts
- repeated camera outages
- repeated pickup anomalies

These patterns create records in `predictive_risk_signals`.

Review statuses:

- `needs_review`
- `reviewing`
- `confirmed`
- `dismissed`
- `escalated`
- `resolved`

The model is not a final judgment. A signal means: "this pattern deserves attention."

## Recommendation Model

The table `risk_prevention_recommendations` stores prevention actions such as:

- increase supervision
- complete compliance action
- schedule follow-up inspection
- review staffing
- review camera coverage
- review observer events

Recommendation statuses:

- `open`
- `accepted`
- `in_progress`
- `completed`
- `dismissed`

All recommendations include:

- priority
- explanation
- expected impact
- due date when relevant
- approval fields
- completion fields

## Explanation Model

Every risk profile stores explanation data:

- why the score increased
- why the score decreased
- strongest contributors
- how to improve
- privacy notes

Dashboards present these explanations in plain Hebrew, not technical terms.

## Privacy Safeguards

The engine must preserve these boundaries:

- no child profiling
- no staff scoring visible to parents
- no automatic accusations
- no automated enforcement
- no parent panic notifications
- no raw observer signals exposed to parents
- no sensitive recommendation exposed publicly

Child and staff indicators may be used only as operational internal signals. They must not become labels, rankings, or public judgments.

## Role Visibility

Admin:

- national risk overview
- all risk profiles
- high-risk and rising-risk kindergartens
- predictive signals
- prevention recommendations

Manager / owner:

- their kindergarten risk profile
- internal prevention recommendations
- explanations and improvement actions
- no public exposure to parents

Inspector:

- risk profiles only for assigned kindergartens
- prioritization for inspections
- early warning signals that may justify follow-up

Parent:

- no direct access to risk profiles
- no raw predictive signals
- only human-reviewed, approved summaries may appear in trust flows

## New Routes

- `/dashboard/admin/risk-intelligence`
- `/dashboard/garden/risk`
- `/dashboard/inspector/risk`

## Database Objects

- `kindergarten_risk_profiles`
- `kindergarten_risk_history`
- `predictive_risk_signals`
- `risk_prevention_recommendations`

The migration is designed to be rerunnable with `create table if not exists`, idempotent indexes, guarded seed inserts, and scoped RLS policies.

## Remaining Production Work

- connect scheduled recalculation to a trusted server job
- add reviewer workflow actions for accepting or dismissing signals
- add richer trend charts once enough history exists
- calibrate weights with pilot data
- add legal review before any public risk summary is introduced
