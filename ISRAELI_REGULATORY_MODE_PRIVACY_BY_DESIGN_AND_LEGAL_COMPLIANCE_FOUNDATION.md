# Israeli Regulatory Mode, Privacy-by-Design & Legal Compliance Foundation

## Purpose

Phase 145 adds a regulatory control layer for Gan Batuach and future Digital Observer verticals. The Digital Observer Core keeps its capabilities, while each vertical decides whether a capability is enabled, disabled, or requires legal review.

This is a product and governance foundation. It is not a legal opinion.

## Regulatory Mode

`GAN_BATUACH_ISRAEL_MODE` is the active kindergarten mode for Israel.

When enabled, Gan Batuach applies kindergarten-specific restrictions:

- Audio recording is disabled.
- Audio analysis is disabled.
- Keyword detection is disabled.
- Speech recognition is disabled.
- Sound classification is disabled.
- Face recognition is disabled.
- Facial identification is disabled.
- Facial embeddings are disabled.
- Facial matching is disabled.
- Child biometric profiles are disabled.
- Child face databases are disabled.
- Persistent biometric identifiers are disabled.

These controls are represented in `vertical_capability_matrix` and mirrored into the existing AI capability matrix where relevant.

## Capability Matrix

The regulatory capability matrix supports:

- Digital Observer Core
- Gan Batuach
- School Safe
- Business Observer
- Home Observer
- Municipality Observer

Each capability has one of three statuses:

- `enabled`
- `disabled`
- `legal_review_required`

Digital Observer Core capabilities are not removed. They remain available at the core level, while Gan Batuach Israel Mode disables or restricts capabilities that are not appropriate for Israeli kindergarten deployment.

## Allowed Gan Batuach AI Capabilities

Gan Batuach allows non-identifying safety and motion analytics with mandatory human review:

- Pose estimation
- Skeleton tracking
- Motion analytics
- Fall detection
- Crowd density detection
- Restricted area detection
- Inactivity detection
- Anomaly detection

These capabilities are advisory. They can detect, classify and recommend, but they cannot decide, accuse, discipline or notify parents automatically.

## Restricted AI Capabilities

The following capabilities require legal review and are not enabled by default:

- Gait recognition
- Persistent skeleton identity tracking
- Soft biometric identification
- Cross-day identity matching

## Human Review Requirements

AI may:

- Detect safety signals.
- Classify operational patterns.
- Recommend follow-up actions.

AI may not:

- Accuse a person.
- Make disciplinary decisions.
- Make regulatory decisions.
- Notify parents automatically about sensitive AI events.

Human review remains mandatory before escalation, parent visibility or operational action.

## Parent Visibility Rules

Parents may see:

- Approved summaries.
- Approved incidents.
- Approved notifications.

Parents may not see:

- Raw AI events.
- Raw observer signals.
- Investigation drafts.
- Internal review material.

Parent-facing information must be scoped to the relevant child, family and kindergarten.

## Privacy-by-Design Controls

The initial control framework covers:

- Data minimization.
- Purpose limitation.
- Access limitation.
- Retention limitation.
- Parent visibility.
- Human review.
- Auditability.

The current readiness model is intentionally conservative. Final production deployment still requires legal review of retention schedules, data inventory and sensitive observer workflows.

## Legal Feature Registry

The legal feature registry tracks:

- Feature key.
- Feature category.
- Legal status.
- Allowed verticals.
- Restricted verticals.
- Approval requirement.
- Parent visibility rule.
- Restriction summary.

Initial entries include raw AI visibility, approved parent safety summaries, automatic parent panic notifications, automatic disciplinary decisions, camera-without-audio policy and investigation draft visibility.

## Audit Requirements

The regulatory audit layer records:

- Capability changes.
- Policy changes.
- Feature activation.
- Feature restrictions.
- Restriction overrides.
- Legal review records.
- Regulatory mode activation.

Any future UI action that changes capability status or overrides restrictions should write to `regulatory_policy_audit_events`.

## Remaining Legal Gaps

- Formal Israeli legal counsel review is still required before real deployment.
- Retention schedules must be mapped per data class.
- Data processing register must be finalized.
- Parent consent and camera notices need final legal wording.
- Browser QA must verify that parents cannot access raw AI events or investigation drafts.
- Future School Safe, Business Observer, Home Observer and Municipality Observer modes require separate legal review.
