# MOBILE 2 - Store Compliance Risk Register

Date: 2026-06-27

| Risk | Severity | Status | Required Action |
| --- | --- | --- | --- |
| Child data privacy disclosure | critical | legal_review_required | Final privacy policy and store labels |
| Camera/video claims | high | store_policy_review_required | Claim only readiness unless live validated |
| AI safety claims | high | store_policy_review_required | No automatic detection or accusation claims |
| Payment/subscription disclosure | high | provider_required | Disclose only configured/sandbox/live state |
| Account deletion instructions | high | privacy_review_required | Publish clear user deletion path |
| Reviewer cannot access gated app | high | reviewer_account_required | Prepare test accounts and synthetic dataset |
| Data retention policy | high | legal_review_required | Publish retention/deletion policy |
| Push notification disclosures | medium | provider_required | Add FCM/APNs details when configured |
| Location permission | medium | conditional | Add only if GPS feature requires native permission |
| Screenshot privacy | medium | screenshot_required | Use synthetic data only |
| App still in pilot/demo mode | medium | store_policy_review_required | Disclose limitations in reviewer notes |

Overall:

- store_compliance_status = not_ready_for_submission
- store_qa_status = ready_for_STORE_QA_1_preflight
