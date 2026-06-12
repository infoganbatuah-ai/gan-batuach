# AI Training, Calibration & Model Management Platform

## Purpose

Gan Batuach AI is managed as a controlled platform, not as an autonomous decision system.

The AI platform supports:

- Model registry
- Model versions
- Training dataset readiness
- Human review feedback
- Calibration thresholds
- Evaluation and drift monitoring
- Governance approvals
- Vertical capability restrictions
- Audit trail

No model is promoted to production automatically.

## Model Lifecycle

Supported lifecycle:

1. `draft`
2. `testing`
3. `pilot`
4. `approved`
5. `production`
6. `retired`

Promotion rules:

- Testing requires measurable evaluation.
- Pilot requires human approval.
- Production requires governance approval.
- Rollback must remain available.
- No automatic promotion is allowed.

## Model Categories

Supported categories:

- Pose estimation
- Skeleton tracking
- Motion analytics
- Anomaly detection
- Risk scoring
- Recommendation engine
- Compliance intelligence
- Inspection intelligence

These categories are architecture-ready for Digital Observer and future verticals.

## Calibration Workflow

Calibration tracks:

- Confidence threshold
- Alert threshold
- False positive rate
- False negative rate
- Reviewer
- Review date
- Calibration status

Workflow:

Observer event
→ Human review
→ Confirmed / dismissed / uncertain
→ Feedback dataset
→ Calibration update
→ Evaluation
→ Governance review

Human review remains mandatory.

## Training Dataset Registry

The registry tracks dataset readiness only.

Dataset sources:

- Internal
- Approved external
- Synthetic
- Human review feedback
- Observer shadow mode

The registry does not store raw datasets. Personal data requires privacy review before any training use.

## Explainability Framework

Every model output should expose:

- Prediction reason
- Confidence score
- Contributing factors
- Source signals
- Review status
- Recommended next human action

The system must not produce blame, discipline, or autonomous conclusions.

## Governance Workflow

Governance reviews cover:

- Privacy
- Safety
- Accuracy
- Deployment
- Rollback
- Regulatory fit

Possible decisions:

- Pending
- Approved
- Approved with restrictions
- Rejected
- Needs changes

## Vertical Capability Matrix

Supported verticals:

- Digital Observer Core
- Gan Batuach
- School Safe
- Business Observer
- Home Observer

Each vertical can enable or disable capabilities independently.

Regulatory modes:

- `disabled`
- `restricted`
- `shadow_only`
- `human_review`
- `approved_use`

## Safety Rules

- No automatic accusations
- No disciplinary actions
- No parent panic notifications
- No raw AI event exposure to parents
- No production deployment without approval
- No automatic retraining
- No automatic enforcement

## Remaining Production Work

- Connect real model evaluation jobs.
- Define external AI provider contracts.
- Add reviewer approval UI for deployments.
- Add rollback execution workflow.
- Add dataset privacy review workflow.
- Add source-backed assistant response scoring.
