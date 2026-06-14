# Skeleton Motion Analytics Legal Review Pack

**DRAFT FOR LEGAL REVIEW**

## Allowed Readiness For Gan Batuach

Prepared as non-identifying safety signal readiness:

- pose estimation
- skeleton keypoints
- motion analytics
- suspected fall
- suspected inactivity
- suspected crowding
- restricted-area presence

All outputs require human review.

## Data Model Boundary

Skeleton events should store:

- anonymized skeleton UUID
- camera / zone / garden reference
- keypoint metadata
- confidence
- event type
- review status

Skeleton events should not store:

- face image
- facial embedding
- raw audio
- child name
- parent name
- direct identity fields

## Legal-Review-Only Capabilities

- contextual child association
- soft biometric matching
- gait recognition
- persistent skeleton identity
- cross-day identity tracking

## External Review Questions

- When do skeleton signals become biometric or identifying?
- Is daily ephemeral context permitted?
- What retention applies to skeleton metadata?
- What parent/staff notices are required?
