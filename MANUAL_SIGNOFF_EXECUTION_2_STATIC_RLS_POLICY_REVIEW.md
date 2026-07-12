# MANUAL SIGNOFF EXECUTION 2 - Static RLS / Policy Review

Static review result language: **STATIC_REVIEW_PASS_BUT_REAL_SUPABASE_TEST_REQUIRED** means local policy evidence exists, but this does not replace real Supabase testing.

| Area | Policy/migration/code found | Observed protection | Result | Risk |
|---|---|---|---|---|
| Parent-child access boundaries | `supabase/migrations/20260616000100_parent_rls_scope_hardening.sql` | Comments and policies state parents do not receive whole-kindergarten access through `can_access_garden`; parent access is child/enrollment scoped. | STATIC_REVIEW_PASS_BUT_REAL_SUPABASE_TEST_REQUIRED | Remote policy drift can still break real isolation. |
| Manager-kindergarten boundaries | `can_access_garden` and role dashboard guards | Manager/owner access is scoped through garden access policies and `requireRole`. | STATIC_REVIEW_PASS_BUT_REAL_SUPABASE_TEST_REQUIRED | Needs Manager A/B remote test. |
| Staff assignment boundaries | Staff-related access references in RLS hardening and role dashboards | Staff access appears assignment/context scoped, not broad admin access. | STATIC_REVIEW_PASS_BUT_REAL_SUPABASE_TEST_REQUIRED | Needs staff unassigned/assigned A test. |
| Inspector assignment boundaries | Inspector RLS and dashboards using assigned gardens | Inspector access appears scoped by assignment/garden access. | STATIC_REVIEW_PASS_BUT_REAL_SUPABASE_TEST_REQUIRED | Needs inspector unassigned/assigned A test. |
| Payment/provider record restrictions | Provider/payment reports, admin routes, `PILOT_FIX_8_*` evidence | Provider records are treated as admin/manager scoped and not parent/staff/inspector-facing. | STATIC_REVIEW_PASS_BUT_REAL_SUPABASE_TEST_REQUIRED | Needs real route/API/RLS test. |
| Camera credential restrictions | Camera gateway migrations, admin/garden camera pages, playback token route | UI/report evidence states no RTSP/passwords/gateway keys in browser; tokenized playback route exists. | STATIC_REVIEW_PASS_BUT_REAL_TEST_REQUIRED | Server-side response redaction must be tested with real camera data. |
| AI event restrictions | AI migrations include `parent_visible default false`, `human_review_required`, and review queue policy | Parents should not see raw AI events; human review is represented in schema/policies. | STATIC_REVIEW_PASS_BUT_REAL_SUPABASE_TEST_REQUIRED | Needs real Parent A/B and raw AI test. |
| Document/storage policies | Storage/signed URL references exist in prior reports and migrations | Sensitive documents are documented as private and signed URL gated. | MANUAL_REQUIRED | Needs bucket policy and TTL verification in Supabase dashboard. |
| Signed URL TTL helpers | Prior camera/document reports and code references | Short-lived token/signed URL policy is documented. | MANUAL_REQUIRED | TTL must be verified against real implementation. |
| Service role use | `lib/supabase/admin.ts`, server/admin routes | Service role appears server-side/admin helper oriented; no client-side env exposure was detected in static search. | PASS_STATIC | Needs deployed bundle review before production. |

## Static Review Conclusion

Static review found meaningful protections and no obvious broad RLS bypass in the reviewed areas. However, because the Supabase CLI/dashboard was unavailable, the final RLS gate remains **REQUIRES_SUPABASE_DASHBOARD_ACCESS**.

