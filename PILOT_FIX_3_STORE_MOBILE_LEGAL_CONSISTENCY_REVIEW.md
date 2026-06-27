# PILOT FIX 3 - Store/Mobile Legal Consistency Review

Date: 2026-06-28

Compared sources:

- `MOBILE_2_APPLE_PRIVACY_LABELS_DRAFT.md`
- `MOBILE_2_GOOGLE_PLAY_DATA_SAFETY_DRAFT.md`
- `STORE_QA_1_APP_STORE_GOOGLE_PLAY_SUBMISSION_COMPLIANCE_QA_REPORT.md`
- `MOBILE_2_STORE_LISTING_METADATA_DRAFT.md`
- `MOBILE_2_REVIEWER_NOTES_DRAFT.md`

## Consistency Findings

| Area | Draft legal docs | Mobile/store drafts | Status |
| --- | --- | --- | --- |
| Child data | disclosed as sensitive child profile/docs/attendance/messages | store drafts conservatively flag child data | consistent, legal review required |
| Photos/documents | disclosed as uploads and private storage | Apple/Google drafts include user content/photos/docs | consistent |
| Location/GPS | only if staff/inspector attendance/GPS is used | mobile drafts flag if enabled | consistent, needs exact permission review |
| Camera | readiness/configuration only; no automatic parent viewing | store QA rejects live camera overclaims | consistent |
| AI | shadow/review only, no raw parent AI, no face/audio | store QA rejects AI overclaims | consistent |
| Payments | three streams separated | mobile/store drafts require no live claim unless configured | consistent |
| Account deletion | draft instructions + dashboard privacy portal | store drafts require deletion request support | partial; public instructions route required |
| Privacy policy URL | draft only, no public route | store readiness requires live URL | blocker |
| Terms URL | draft only, no public route | store readiness requires live URL | blocker |
| Support URL/contact | partial `/service-charter`; draft support email placeholder | store notes require support contact | blocker until real contact/URL |

## Result

`store_consistency_required`

The content direction is consistent, but store submission and real pilot require public reviewed URLs and final legal/privacy approval.

