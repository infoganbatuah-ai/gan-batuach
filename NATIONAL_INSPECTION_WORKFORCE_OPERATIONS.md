# National Inspection Workforce Operations

Status: workforce operations readiness. This phase does not replace human inspectors and does not create automatic regulatory decisions.

## Purpose

Phase 186 turns inspection from a product feature into a national operating model for a real inspector workforce.

The system supports:

- monthly inspections
- follow-up inspections
- urgent inspections
- complaint-driven inspections
- regional assignments
- inspector workload
- compensation readiness
- performance tracking
- recruitment and training readiness

Digital Observer and AI may assist prioritization, but every inspection decision remains human-reviewed.

## Workforce Model

The `inspection_workforce_profiles` table tracks:

- inspector profile
- region
- city coverage
- active status
- employment type
- monthly capacity
- assigned kindergarten count
- completed inspections
- overdue inspections
- compensation model
- certification status
- training status

Inspector statuses:

- `candidate`
- `training`
- `active`
- `paused`
- `suspended`
- `inactive`

## Assignment Model

The `inspection_workforce_assignments` table supports:

- region assignment
- city assignment
- kindergarten network assignment
- manual admin assignment
- workload balancing

Every kindergarten can have:

- primary inspector
- backup inspector
- regional supervisor readiness

Regional supervisor access must remain scoped to assigned region and must not expose unrelated child, medical, payment or camera data.

## Capacity Model

The `inspection_workforce_capacity_models` table calculates realistic inspector capacity.

Inputs:

- inspections per month
- average inspection duration
- average travel time
- report writing time
- follow-up inspection rate
- complaint inspection rate
- urgent inspection buffer
- work days per month

Outputs:

- max kindergartens per inspector
- overload risk
- recommended hiring point

Baseline planning assumes about 18 kindergartens per inspector under routine monthly inspection conditions, with lower capacity at larger scale due to follow-ups, complaints, travel and urgent buffer.

## Monthly Workload Planning

The `inspection_workforce_monthly_plans` table tracks:

- inspections due by month and week
- inspections due by inspector
- regional gaps
- overloaded inspectors
- unassigned kindergartens
- urgent visits
- follow-up inspections
- complaint-driven inspections

The monthly plan should be reviewed before each cohort is activated.

## Scheduling Engine

The `inspection_workforce_schedules` table supports:

- monthly routine inspections
- follow-up inspections
- surprise inspections
- urgent inspections
- complaint-driven inspections

Tracked fields:

- scheduled date
- expected duration
- location
- status
- assigned inspector
- backup inspector
- notes

## Route Planning Readiness

The `inspection_workforce_routes` table prepares future map integration.

Tracked fields:

- kindergarten address list
- city
- region
- travel distance estimate
- daily inspection route
- time window

Future map providers:

- Google Maps
- Waze
- Mapbox

No real map provider is required in this phase.

## Compensation Model

The `inspection_workforce_compensation` table supports:

- per-kindergarten monthly amount
- per inspection completed
- fixed monthly salary
- hybrid model

Tracked values:

- base amount
- per-kindergarten amount
- per-inspection amount
- bonus
- deductions
- estimated monthly payout

This is payout readiness only. It does not execute real payments.

## Financial Planning

The `inspection_workforce_financial_forecasts` table connects inspector cost to business scale.

Scenarios:

- 25 kindergartens
- 50 kindergartens
- 100 kindergartens
- 250 kindergartens
- 500 kindergartens
- 1,000 kindergartens

For each scenario, the system tracks:

- inspectors needed
- inspector cost
- expected revenue
- support cost estimate
- infrastructure cost estimate
- contribution margin
- operational risk

## Performance Dashboard

The `inspection_workforce_performance` table creates `inspector_performance_score` from:

- inspections assigned
- inspections completed
- overdue inspections
- average completion time
- GPS validation rate
- report quality
- corrective action follow-up
- complaint handling
- manager feedback
- admin review

Performance tracking supports coaching and quality improvement. It must not be used as an automatic employment action without human review.

## Quality Review

The `inspection_workforce_quality_reviews` table tracks:

- incomplete forms
- missing GPS
- missing signature
- weak notes
- missing photos/evidence
- late reports
- repeated corrections

Each issue creates a quality improvement task.

## Training Model

The `inspection_workforce_training` table tracks inspector training modules:

- Gan Batuach inspection standard
- child safety basics
- documentation requirements
- GPS validation
- digital forms
- evidence upload
- complaint handling
- privacy and confidentiality
- camera/AI observer boundaries
- professional conduct

## Certification Model

The `inspection_workforce_certifications` table tracks required inspector documents:

- ID verification
- background check readiness
- training completion
- confidentiality agreement
- service agreement
- professional certification if relevant
- insurance/contractor documents if relevant

Document statuses:

- `missing`
- `uploaded`
- `under_review`
- `approved`
- `expired`
- `rejected`

## Candidate Pipeline

The `inspection_workforce_candidates` table prepares recruitment tracking.

Candidate statuses:

- lead
- contacted
- interview
- documents_requested
- training
- approved
- active
- rejected

Tracked fields:

- region
- availability
- experience
- expected pay
- notes

## Mobile Operations

Inspector mobile flow should support:

- daily schedule
- navigation readiness
- inspection form
- GPS validation
- evidence upload
- digital signature
- complaint review
- follow-up actions
- offline draft readiness

This phase prepares workforce data for those flows.

## Complaint-Driven Inspection Workflow

High-severity complaint flow:

1. Complaint received.
2. Human review.
3. Inspector assigned.
4. Visit scheduled.
5. Inspection completed.
6. Findings recorded.
7. Parent or manager response where allowed.
8. Case closed after review.

No complaint creates an automatic regulatory result.

## Observer-Driven Recommendation Workflow

Observer signal flow:

1. AI/Observer signal created.
2. Human review.
3. Inspector recommendation.
4. Admin or inspector approval.
5. Inspection request.

No automatic inspection order is created without human review.

## Follow-Up Inspection Workflow

When findings require correction:

1. Finding created.
2. Corrective action assigned.
3. Due date set.
4. Evidence submitted.
5. Follow-up inspection if required.
6. Closure verified.

The follow-up workload is part of inspector capacity planning.

## SLA Model

The `inspection_workforce_slas` table defines:

- monthly inspection completion
- complaint response time
- urgent inspection response
- report submission deadline
- corrective action follow-up

SLA breaches feed admin alerts and workforce risk.

## Alerts

Inspector alerts include:

- upcoming inspection
- overdue inspection
- new complaint assignment
- follow-up due
- missing report
- GPS validation issue
- document expiration
- schedule change

Admin alerts include:

- overloaded inspector
- region without coverage
- SLA breach
- repeated late reports
- missing inspector documents
- high complaint region
- inspector cost exceeding forecast

Channels are readiness-only unless provider mode allows sending:

- in-app
- email
- SMS/WhatsApp readiness
- push readiness

## Audit Trail

The `inspection_workforce_audit_events` table tracks:

- assignment changes
- schedule changes
- inspection submissions
- GPS validation
- evidence upload
- signature
- report edits
- compensation calculations
- admin overrides

Audit events are append-only readiness and should be connected to the immutable audit service where available.

## Workforce Risk Register

The `inspection_workforce_risks` table tracks:

- staffing
- coverage
- quality
- cost
- SLA
- legal/privacy
- operational
- reputation

Statuses:

- open
- in_progress
- mitigated
- accepted_risk
- closed

## Workforce AI Assistant

The admin assistant may answer operational questions using stored data only:

- How many inspectors do we need for 100 kindergartens?
- Which inspector is overloaded?
- Which region lacks coverage?
- What is inspector cost per kindergarten?
- Which inspections are overdue?
- Which inspectors need training?
- Which kindergartens need follow-up inspection?

The assistant may not make regulatory decisions or replace inspector judgment.
