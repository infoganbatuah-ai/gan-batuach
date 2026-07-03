# PILOT FIX 6 - Negative Camera Access Tests

Date: 2026-07-03

No real camera, gateway or A/B Supabase dataset was used. Tests are prepared for manual/staging execution.

| Test ID | Test | Expected result | Actual result | Status | Severity if fail | Fix needed |
|---|---|---|---|---|---|---|
| CAM-NF-001 | anonymous cannot access camera stream/token | denied | not executed | MANUAL_REQUIRED | critical | require auth/role |
| CAM-NF-002 | parent without child link cannot view camera | denied | not executed | MANUAL_REQUIRED | critical | parent scope/RLS |
| CAM-NF-003 | parent with child in Kindergarten A cannot view Kindergarten B camera | denied | not executed | MANUAL_REQUIRED | critical | camera garden check |
| CAM-NF-004 | parent cannot view if `parent_visible` false | denied | not executed | MANUAL_REQUIRED | critical | parent policy gate |
| CAM-NF-005 | parent cannot view if feature flag disabled | denied | not executed | MANUAL_REQUIRED | critical | server flag gate |
| CAM-NF-006 | parent cannot view if token expired | denied | not executed | MANUAL_REQUIRED | high | token expiry validation |
| CAM-NF-007 | staff unassigned cannot view camera | denied | not executed | MANUAL_REQUIRED | critical | staff assignment gate |
| CAM-NF-008 | staff assigned A cannot view Kindergarten B camera | denied | not executed | MANUAL_REQUIRED | critical | garden_id ownership |
| CAM-NF-009 | inspector unassigned cannot view camera | denied | not executed | MANUAL_REQUIRED | critical | inspector assignment gate |
| CAM-NF-010 | inspector assigned A cannot view Kindergarten B camera | denied | not executed | MANUAL_REQUIRED | critical | inspector garden check |
| CAM-NF-011 | manager A cannot view Kindergarten B camera | denied | not executed | MANUAL_REQUIRED | critical | manager garden check |
| CAM-NF-012 | any client role cannot retrieve RTSP/credentials | denied/redacted | static fixed; runtime needed | MANUAL_REQUIRED | critical | redact/sanitize |
| CAM-NF-013 | Digital Observer user cannot access Gan Batuach cameras unless scoped | denied | not executed | MANUAL_REQUIRED | critical | product scoping |
| CAM-NF-014 | Gan Batuach parent cannot access Digital Observer cameras | denied | not executed | MANUAL_REQUIRED | critical | product scoping |

Status: **MANUAL_REQUIRED**
