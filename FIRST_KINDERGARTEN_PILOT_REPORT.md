# First Kindergarten Pilot Report

This report prepares Gan Batuach for the first real kindergarten pilot.

The pilot is a real customer environment. The goal is validation, observation, UX learning and operational readiness, not large architecture changes.

## Pilot Profile

Initial profile created:

- Pilot name: First real kindergarten pilot
- Kindergarten name: גן פיילוט ראשון
- Manager: מנהלת הגן
- Contact person: איש קשר לפיילוט
- Children: to be updated before activation
- Staff: to be updated before activation
- Classrooms: to be updated before activation
- Camera availability: test mode until real cameras are available
- Observer participation: enabled in shadow/review mode
- Onboarding date: migration date
- Activation date: pending
- Pilot status: planned

Admin dashboard:

```text
/dashboard/admin/pilot-health
```

## Deployment Checklist

Required checks:

- Manager account active
- Staff accounts active
- Parent accounts active
- Onboarding completed
- Permissions validated
- Communication channels tested
- Camera health checked or test mode enabled
- Observer review workflow ready
- Pilot support owner assigned

## Manager Journey Validation

Validate:

- Login
- Onboarding
- Children management
- Parent management
- Staff management
- Documents
- Cameras
- Observer

Track:

- Confusion points
- UX issues
- Missing actions
- Screens that feel slow or unclear

## Parent Journey Validation

Validate:

- Registration
- Child access
- Attendance visibility
- Messages
- Documents
- Pickup workflow
- Cameras if enabled

Track:

- Mobile readability
- Language clarity
- Trust and privacy concerns
- Any place where parent does not understand what to do next

## Staff Journey Validation

Validate:

- Invitation
- Onboarding
- Permissions
- Attendance
- Tasks
- Communication

Track:

- Friction points
- Missing permissions
- Long forms
- Tasks that are unclear

## Camera Pilot Validation

Validate:

- Camera connection
- Camera health
- Playback permissions
- Camera monitoring

If no real cameras exist:

```text
Use test deployment mode.
```

Camera rules:

- No RTSP URL in browser
- No camera credentials in browser
- Gateway secrets server-only
- Parent playback requires permission
- Playback is audited

## Observer Pilot Validation

Validate:

- Observer events
- Review workflow
- Audio workflow
- Correlation workflow
- Calibration workflow

Track:

- False positives
- Missed events
- Reviewer feedback
- Confidence stability

Observer rules:

- Shadow mode only
- No automatic accusations
- No disciplinary actions
- Human validation mandatory

## Feedback Collection

Feedback table:

```text
pilot_feedback
```

Collected from:

- Manager
- Staff
- Parent
- Inspector

Categories:

- UX
- Performance
- Reliability
- Confusion
- Missing feature

Existing dashboard feedback widget now supports these categories.

## Issue Tracking

Issue table:

```text
pilot_issues
```

Severity:

- Critical
- High
- Medium
- Low

Tracked fields:

- Reported by
- Affected role
- Status
- Resolution
- Verification

Current seeded issue:

- Real pilot browser QA required

## Usage Analytics

Usage table:

```text
pilot_usage_analytics
```

Track:

- Daily active users
- Login frequency
- Feature usage
- Onboarding completion
- Screen usage

Purpose:

- Identify unused areas
- Find confusing screens
- Find drop-off points

## Success Criteria

Tracked in:

```text
pilot_success_criteria
```

Criteria:

- Manager satisfaction
- Parent satisfaction
- Onboarding completion
- Issue resolution
- Observer readiness
- Camera readiness

Pilot should not expand to multiple kindergartens until:

- No unresolved critical issues
- High issues have an owner and clear fix path
- Manager can complete core workflows
- Parents can register and understand child access
- Staff onboarding and permissions work
- Camera mode is either working or explicitly test-only
- Observer remains human-reviewed

## Readiness Assessment

Initial status:

```text
Planned / validation required
```

The platform is structurally ready to track the pilot, but not ready to expand until real use produces evidence.

Main readiness risks:

- Real browser QA still required
- Real user journey validation not yet completed
- Real usage analytics need data
- Camera pilot may remain in test mode if no camera is available
- Observer must remain shadow-only
- External security findings from PHASE 104 must remain visible before customer expansion

## Recommended Fixes Before Multi-Kindergarten Deployment

1. Fill real pilot profile details.
2. Activate manager account and complete onboarding.
3. Invite limited staff and parent group first.
4. Run guided manager session.
5. Run parent mobile walkthrough.
6. Validate permissions with real roles.
7. Keep cameras in test mode unless gateway is ready.
8. Keep observer in review mode.
9. Review feedback daily during first week.
10. Close critical/high issues before adding another kindergarten.

