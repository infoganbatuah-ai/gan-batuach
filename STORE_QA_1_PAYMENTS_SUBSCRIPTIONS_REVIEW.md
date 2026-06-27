# STORE QA 1 - Payments And Subscriptions Review

Date: 2026-06-27

## Result

payments_subscriptions_result = acceptable_for_draft_readiness_only

## Findings

- Store drafts do not claim live payments.
- Gan Batuach subscription is described separately from parent tuition.
- Digital Observer billing is treated separately.
- Payment capabilities are described as provider-dependent/sandbox/readiness.
- No card data or provider secrets were found in store-facing docs.

## Required Before Submission With Payments

- Decide whether payments are present in the submitted build.
- If subscriptions are sold through the app, review Apple/Google in-app purchase policy before submission.
- If external payments are used for business customers, document the business flow and ensure store policy compliance.
- Finalize payment terms, cancellation terms, invoices/receipts and support path.
- Verify live provider status only if live credentials and webhooks are configured.

Status:

- payment_claims_ok = true for readiness-only
- provider_required = true for live claims
- store_policy_review_required = true before monetized submission
