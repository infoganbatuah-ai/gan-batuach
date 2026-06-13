# AI Privacy-by-Design, DPIA & Responsible AI Governance Platform

## Purpose

Phase 149 creates the Responsible AI governance layer for Gan Batuach and the future Digital Observer ecosystem. AI is treated as an assistant that may recommend, summarize and prioritize, but may not accuse, discipline, punish, make legal decisions, make regulatory decisions or trigger sensitive actions automatically.

## Governance Model

The governance layer connects:

- AI model registry
- vertical capability matrix
- DPIA assessments
- privacy impact registry
- explainability records
- human decision audit trail
- ethics reviews
- responsible AI score

Core rule:

AI output -> human review -> human decision -> action

Never:

AI output -> automatic action

## DPIA Model

`ai_dpia_assessments` tracks Data Protection Impact Assessments.

Each DPIA stores:

- AI system key and name
- vertical
- purpose
- data categories
- affected users
- risk level
- mitigation controls
- residual risk
- reviewer
- approval status
- next review date

Initial DPIAs were created for:

- Gan Batuach Motion Safety Observer
- Gan Batuach Role-Scoped AI Assistant
- Gan Batuach Risk Recommendation Engine

## AI Capability Registry

`ai_capabilities` is the responsible capability registry.

It tracks:

- capability name
- category
- allowed verticals
- restricted verticals
- legal status
- privacy status
- risk classification
- reviewer approval
- human review requirement
- parent visibility
- automatic action policy
- DPIA requirement

Examples:

- pose estimation: allowed with human review
- fall detection: allowed as safety signal with human review
- risk recommendations: restricted, advisory only
- AI assistant summaries: restricted, source-backed only
- face recognition: disabled for Gan Batuach
- audio analytics: disabled for Gan Batuach
- gait recognition and soft biometrics: legal review required

## Review Model

Sensitive AI workflows must pass through human review.

Supported review outcomes:

- pending
- confirmed
- dismissed
- needs follow-up
- escalated
- approved summary
- rejected

`ai_decision_audit_trail` records the reviewer, decision, final action and timestamp. A database constraint prevents `automatic_action_taken = true`.

## Explainability Framework

Every AI output should explain:

- why it occurred
- confidence level
- contributing factors
- supporting signals
- limitations
- human-readable explanation

`ai_explainability_records` stores explanations for observer signals, risk predictions, recommendations, assistant responses, compliance alerts and inspection insights.

## Privacy Impact Framework

`ai_privacy_impact_registry` tracks:

- privacy risks
- affected users
- data categories
- mitigation measures
- review status
- next review date

Current privacy risks covered:

- raw AI content becoming parent-visible
- biometric identification risk
- AI recommendation being mistaken for a decision

## Capability Matrix

Digital Observer Core remains intact, while each vertical controls what is enabled.

Verticals:

- Digital Observer Core
- Gan Batuach
- School Safe
- Business Observer
- Home Observer
- Municipality Observer

Gan Batuach restrictions:

- audio analytics disabled
- face recognition disabled
- child biometric profiling disabled
- raw AI events blocked from parents
- human review required for sensitive events

## Responsible AI Score

`responsible_ai_scores` creates a 0-100 score based on:

- review coverage
- explainability
- DPIA completion
- audit coverage
- governance readiness

The score is shown in `/dashboard/admin/ai-governance`.

## Parent Visibility Rules

Parents may see:

- approved summaries
- approved events
- approved notifications

Parents may not see:

- raw AI events
- raw observer signals
- unreviewed findings
- investigation drafts

## Dashboards

- `/dashboard/admin/ai-governance`: Responsible AI, DPIA, capabilities, explainability and review audit
- `/dashboard/admin/ai-platform`: model registry, calibration and deployment readiness
- `/dashboard/admin/regulatory`: vertical regulatory policy and legal capability matrix

## Remaining Gaps

- Complete formal legal review of each DPIA before production.
- Add source references to every AI assistant response.
- Connect every live AI event review to `ai_decision_audit_trail`.
- Add reviewer UX for DPIA approval and ethics review updates.
- Add automated alerts for expired DPIA reviews without triggering AI decisions.
