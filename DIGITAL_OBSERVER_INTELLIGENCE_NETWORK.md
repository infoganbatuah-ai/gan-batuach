# Digital Observer Intelligence Network

## Purpose

The Digital Observer Intelligence Network connects camera events, audio events, correlated observer events, incidents, complaints, inspections, compliance issues, camera health and staff attendance anomalies into one operational safety layer.

The network is advisory only.

- No automatic accusations
- No disciplinary decisions
- No parent panic notifications
- Human review is required for sensitive events

## Signal Model

Primary table:

`observer_intelligence_signals`

Core fields:

- `signal_type`: ai_camera, audio, correlated, safety_incident, complaint, inspection, compliance, camera_health, staff_attendance, pattern
- `source_type`: originating system table
- `source_id`: source record
- `kindergarten_id`: Gan Batuach garden scope
- `observer_site_id`: standalone observer site scope
- `severity`: info, low, medium, high, urgent, critical
- `confidence`: optional 0-1 confidence
- `review_status`: needs_review, reviewing, confirmed, dismissed, escalated, resolved
- `recommended_action`: careful operational recommendation
- `risk_score`: 0-100 prioritization score
- `parent_visible`: false by default

Supporting tables:

- `observer_signal_reviews`: human review history
- `observer_safety_recommendations`: action recommendations that require human approval
- `observer_network_score_snapshots`: readiness score snapshots

## Aggregation Sources

The migration seeds unified signals from:

- AI camera events
- Legacy AI events
- Audio observer events
- Correlated observer events
- Safety incident reports
- Complaints
- Compliance alerts
- Camera health history
- Staff attendance anomalies

The system also tracks repeated patterns by `pattern_key` and increases prioritization when similar signals repeat.

## Risk Prioritization

Risk score is based on:

- Severity
- Confidence
- Repetition
- Recent complaints
- Unresolved findings
- Camera reliability
- Compliance context

The score is used to sort review queues. It is not proof and must not be treated as an accusation.

## Human Review Workflow

Recommended workflow:

1. Signal is created from a source system.
2. Signal enters `needs_review`.
3. Admin, manager or inspector reviews the context.
4. Reviewer chooses one outcome:
   - `confirmed`
   - `dismissed`
   - `escalated`
   - `resolved`
5. Any follow-up action is documented in `observer_signal_reviews`.
6. Recommendations remain advisory until a human approves or completes them.

## Safe Recommendations

Allowed recommendation types:

- Review camera footage
- Contact kindergarten manager
- Schedule follow-up inspection
- Verify staff presence
- Request document update
- Review complaint context
- Check camera health

These are operational prompts, not conclusions.

## Inspector Escalation

Observer signals may recommend:

- Follow-up inspection
- Urgent review
- Complaint review
- Camera health review

The inspector must approve, schedule and document the action. The observer does not create enforcement outcomes automatically.

## Manager Safety Digest

Managers see a simplified digest:

- Issues requiring attention
- Camera issues
- Compliance issues
- Unresolved observer events
- Safe next steps

Technical details and raw confidence logic are hidden.

## Parent Visibility Boundary

Parents must not see raw observer signals.

Parents may see only:

- Human-reviewed summaries
- Approved kindergarten updates
- Approved safety or inspection summaries

Parents must not receive automatic panic notifications from raw AI, audio, camera or correlated observer events.

## Privacy Protections

- RLS scopes signals by admin, garden access or observer site membership.
- Parent visibility is false by default.
- `parent_visible = true` is allowed only after `confirmed` or `resolved`.
- Sensitive recommendations require human approval.
- The system does not create biometric assumptions.
- The system does not score children or staff for discipline.

## Production Requirements Still Needed

- Real-time review actions from the UI
- Reviewer assignment and SLA tracking
- Signal deduplication tuning after real pilot data
- False positive / false negative measurement from calibration review
- Formal legal/privacy approval before parent-facing summaries
- External security review of RLS and API routes
