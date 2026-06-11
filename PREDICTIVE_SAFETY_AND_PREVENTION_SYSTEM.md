# Predictive Safety And Prevention System

## Purpose

The predictive safety layer helps Gan Batuach identify early risk patterns and recommend preventive action before incidents grow into larger operational problems.

This system is advisory only:

- No automatic accusations
- No disciplinary decisions
- No automatic enforcement
- No parent panic notifications
- Human review remains mandatory

## Prediction Model

The model collects signals from existing operational domains:

- Inspections
- Incidents
- Complaints
- Observer events
- Compliance alerts
- Attendance anomalies
- Camera outages
- Unresolved findings

These signals are normalized into `early_warning_signals`.

Supported warning examples:

- Rising complaint trend
- Repeated safety events
- Repeated staffing issues
- Declining compliance
- Increasing observer alerts
- Camera reliability concerns

Each warning stores:

- Kindergarten scope
- Optional observer site scope
- Warning type
- Severity
- Confidence score
- Supporting signals
- Review status
- Recommended action
- Human review requirement

## Confidence Model

Every prediction includes a confidence score from 0 to 100.

Confidence should be based on:

- Number of supporting signals
- Signal severity
- Signal repetition
- Recent trend direction
- Data completeness
- Existing unresolved findings

Confidence is not proof. It is a prioritization aid for human reviewers.

## Prevention Model

Preventive recommendations are stored in `prevention_recommendation_actions`.

Supported recommendation types:

- Schedule inspection
- Increase supervision
- Review staffing
- Complete compliance actions
- Review safety procedures
- Review camera coverage
- Contact manager

All recommendations are advisory. The system can suggest a next step, but a human must approve and perform any operational action.

## Escalation Model

Predictions may recommend escalation into:

- Follow-up inspection
- Urgent review
- Compliance review
- Management action

Escalation requires human approval. The platform must not automatically contact authorities, parents, staff, or external parties based only on a prediction.

## Accuracy Tracking

Prediction outcomes are tracked in `prediction_accuracy_reviews`.

Validation outcomes:

- Pending
- Accurate
- Inaccurate
- Inconclusive

The purpose is to measure and improve the model over time while preserving human judgment.

## Prevention Readiness Score

`prevention_readiness_scores` stores a 0-100 readiness score per kindergarten.

The score combines:

- Compliance readiness
- Inspection readiness
- Incident history
- Observer readiness
- Corrective action completion

This score helps managers, inspectors, and admins understand where preventive attention is needed.

## Parent Safety Boundary

Parents do not see:

- Raw predictions
- Internal risk models
- Internal warning signals
- Reviewer notes
- Unsupported safety assumptions

Parents may only see approved safety communications, human-reviewed updates, and parent-safe summaries.

## Privacy Protections

The predictive safety system must follow these rules:

- No child profiling
- No staff scoring visible to parents
- No automatic blame
- No automatic enforcement
- No raw observer or AI signals shown to parents
- Role permissions must be enforced before any prediction is shown
- Predictions are scoped to the correct kindergarten or observer site

## Admin Workflow

1. Review high-risk kindergartens.
2. Review early warning signals.
3. Check confidence and supporting evidence.
4. Select or approve a preventive recommendation.
5. Assign human follow-up if needed.
6. Validate prediction accuracy after the outcome is known.

## Manager Workflow

Managers see:

- Current prevention readiness
- Risk trend
- Recommended actions
- Unresolved preventive actions

Managers should receive operational guidance, not technical model details.

## Inspector Workflow

Inspectors see:

- Predicted high-risk kindergartens
- Emerging concerns
- Recommended inspections
- Unresolved warnings

Inspectors decide whether a warning justifies inspection, follow-up, or dismissal.

## Production Requirements Still Needed

- Real historical validation data
- Calibrated thresholds by region and kindergarten type
- Human review SLAs
- External legal review for predictive-risk language
- Monitoring for false positives and bias
- Clear approval process before any parent-facing communication
