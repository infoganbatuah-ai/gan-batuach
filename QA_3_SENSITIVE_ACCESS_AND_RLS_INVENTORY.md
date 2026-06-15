# QA 3 - Sensitive Access And RLS Inventory

Date: 2026-06-16

Scope: security, permissions, role isolation, RLS and sensitive access review after PHASE 190, 190A, 190B, 190C, 190D and QA 2B.

This inventory is based on source code and migration review. It does not replace live Supabase policy introspection, external penetration testing, or legal/privacy review.

## Summary

| Area | Sensitive data present | RLS exists | Server-side checks exist | Role isolation required | Manual review required | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `profiles` | Yes: roles, contact, active state, garden link | Yes | Yes, `requireUser`, `requireRole`, admin APIs | Yes | Yes | Needs review |
| `parents` | Yes: parent identity/contact, garden link | Yes | Yes in parent and manager flows | Yes | Yes | Needs review |
| `children` | Yes: child identity, status, parent link, medical-adjacent fields | Yes | Mixed: generic CRUD and dedicated parent flows | Yes | Yes | Blocking RLS concern |
| `permanent_child_files` | Yes: parent-owned child profile, ID hash/encrypted fields, medical notes | Yes | Yes in self-service parent child creation | Yes | Yes | Partially safe |
| `parent_kindergarten_links` | Yes: parent-garden affiliation state | Yes | Yes in enrollment and transfer flows | Yes | Yes | Needs review |
| `child_kindergarten_enrollments` | Yes: child-garden assignment and transfer state | Yes | Yes in transfer flow | Yes | Yes | Needs review |
| `kindergarten_enrollment_requests` | Yes: parent/child/garden request metadata | Yes | Yes, parent insert and manager scoped action | Yes | Yes | Safe pattern found |
| `gardens` | Mixed: public-safe profile and internal garden data | Yes | Yes in admin/manager pages | Yes | Yes | Needs review |
| `staff` | Yes: staff identity, documents/status links | Yes | Mixed: generic CRUD and approval APIs | Yes | Yes | Needs review |
| `staff_candidate_profiles` | Yes: identity hash, document status | Yes | Yes, self-service candidate APIs | Yes | Yes | Safe pattern found |
| `staff_job_applications` | Yes: candidate/application data | Yes | Yes, candidate and manager scoped actions | Yes | Yes | Safe pattern found |
| `inspectors` | Yes: inspector identity, assignment, certification | Yes through core tables and server checks | Yes, admin assignment and inspector application APIs | Yes | Yes | Needs review |
| `inspector_applications` | Yes: profile, documents, regions, experience | Yes | Yes, own insert/admin update | Yes | Yes | Safe pattern found |
| `documents` | Yes: child/staff/regulatory/payment/inspection docs | Yes | Generic CRUD plus storage upload checks | Yes | Yes | High review item |
| Supabase storage buckets | Yes: private documents/photos/evidence | Bucket privacy set to false-public | Upload route checks role/bucket/mime | Yes | Yes | High review item |
| `child_health_records` | Yes: allergies, medication, emergency contacts, medical notes | Yes | Dedicated route has audit logging | Yes | Yes | Blocking RLS concern |
| `medicine_given_logs` | Yes: medication administration | Yes | Encrypted write path in generic CRUD helper | Yes | Yes | Blocking RLS concern |
| `billing_invoices` | Yes: invoices, billing status | Yes | Manager subscription route scoped to own garden | Yes | Yes | Needs review |
| `kindergarten_subscriptions` | Yes: Gan Batuach subscription status | Yes | Manager/admin routes scoped | Yes | Yes | Needs review |
| Parent tuition payment records | Yes, if enabled | Partial source review only | Existing payment flows are separated in copy/UX | Yes | Yes | Deferred to QA 4 |
| Digital Observer subscription records | Yes, separate product revenue | Partial source review only | Product routes exist | Yes | Yes | Deferred to QA 4 |
| `camera_streams` | Yes: camera metadata and gateway references | Yes | Camera token route has additional policy checks | Yes | Yes | Strong server checks found |
| `video_stream_sessions` / playback sessions | Yes: viewer/session/token hash | RLS not fully verified in this pass | Server route creates tokenized sessions | Yes | Yes | Needs live DB review |
| `camera_view_logs` / access audit | Yes: camera access events | Yes | Token route writes logs | Yes | Yes | Needs live DB review |
| `ai_camera_events` | Yes: AI observer events, clips/snapshots references | Yes | Admin creation, human review actions scoped | Yes | Yes | Safe pattern found |
| `ai_events` / legacy AI routes | Yes: AI event data | Yes | Some routes use generic CRUD | Yes | Yes | Needs review |
| `audit_logs` | Yes: audit trail | Yes | Admin-only read, authenticated insert | Yes | Yes | Needs review |
| `notifications` | Yes: user-facing event metadata | RLS enabled in later migrations | Server-side inserts in flows | Yes | Yes | Needs review |
| `messages` | Yes: participant communication | Yes | CRUD helper and RLS participant/garden policy | Yes | Yes | Needs review |
| `complaints` | Yes: complaints and possible child/garden safety details | Yes | Parent/manager/inspector flows present | Yes | Yes | Needs review |

## Sensitive Table Notes

### Parent And Child Data

RLS exists for parent-owned child files and enrollment requests. Dedicated self-service APIs correctly check ownership before creating enrollment requests. However, older garden-scoped policies still rely on `public.can_access_garden(garden_id)`, and the latest implementation of `can_access_garden` grants access when an active profile has `garden_id = target_garden_id`, without excluding parent roles.

This creates a blocking review item for tables such as `children`, `child_health_records`, `medicine_given_logs`, `child_daily_journals`, `documents`, `billing_invoices` and other garden-scoped tables if a parent profile receives `garden_id`.

### Manager And Staff Data

Manager approval routes for enrollment and staff applications use server-side service-role writes but first scope the request by `profile.garden_id`. This is the correct pattern. Generic CRUD routes still rely heavily on RLS and should be reviewed after the parent/garden-scope RLS issue is fixed.

### Inspector Data

Inspector candidates are limited through `inspector_applications` RLS and admin-only approval. After approval, assignment appears garden-based. Live policy review should verify that an approved inspector cannot use broad profile state to access unassigned gardens.

### Documents And Storage

Buckets are created as non-public. Uploads are server-side, validate bucket/mime/role, and audit the upload. The upload route currently returns a signed URL valid for 30 days. For sensitive documents, this duration is too long for a production security posture and should be reviewed before launch.

### Camera Access

Camera playback token creation includes role checks, parent policy checks, MFA gate, child enrollment, child present-at-kindergarten validation, room matching, no RTSP playback, token hashing and audit logs. This is one of the stronger access-control areas found in this review.

### AI Observer Access

`ai_camera_events` policies restrict reads/writes to admin or manager/owner/inspector roles scoped by garden. The event creation path sets `shadow_mode`, `requires_human_review`, and `parent_visible=false`. This aligns with Gan Batuach Israel Mode requirements.

## Manual Review Required

1. Live Supabase policy introspection after all migrations are applied.
2. RLS redesign for parent access so parents can access only their own children, approved request state, public-safe kindergarten data and explicitly allowed camera sessions.
3. Storage signed URL duration and download authorization flow.
4. Payment/provider visibility in QA 4.
5. External security review for camera gateway, AI provider callbacks, storage and payment webhooks.
