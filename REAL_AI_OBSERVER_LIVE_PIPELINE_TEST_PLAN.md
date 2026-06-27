# Real AI Observer Live Pipeline Test Plan

Date: 2026-06-27

Purpose: define the safe path from AI readiness/mock to controlled shadow inference without exposing camera credentials, raw frames, secrets or raw AI events to parents.

## Preconditions

- `npm run build` passes.
- PROD 3 camera gateway setup has a safe frame source or a secure non-sensitive test frame.
- `AI_PROVIDER_MODE` is `test_inference` or `real_inference`, not `production`.
- `AI_INFERENCE_ENDPOINT` or provider-specific endpoint is configured server-side.
- `AI_PROVIDER_API_KEY` or webhook secret is configured server-side if the provider requires it.
- `AI_SHADOW_MODE_ENABLED=true`.
- `AI_REVIEW_QUEUE_ENABLED=true`.
- Gan Batuach Israel Mode remains `GAN_BATUACH_AI_LEGAL_MODE=israel_restricted`.

## Required Frame Source

One of:

- Gateway snapshot from a configured camera.
- Secure test frame from private storage.
- Uploaded non-sensitive test clip.
- Digital Observer site stream in its own product context.

No raw RTSP, local camera IP, camera username/password, gateway secret or provider token may be client-visible.

## Provider Contract

Input:

- frame reference or buffer
- camera id
- garden id or observer site id
- product context
- model version
- allowed capability set

Output:

- candidate event type
- confidence
- timestamp
- model version
- explanation/reason
- processing status
- optional bounding boxes or skeleton metadata only if allowed

Forbidden output:

- face identity
- audio-derived result
- automatic accusation
- parent-visible raw event
- raw unrestricted frame URL

## Shadow Event Creation Test

1. Use a non-sensitive test frame or gateway snapshot.
2. Run inference in `test_inference` mode.
3. Create a shadow event with `parent_visible=false`.
4. Confirm `requires_human_review=true`.
5. Confirm event status is `candidate` or equivalent open/review state.
6. Confirm audit/job log exists.

## Human Review Queue Test

1. Sign in as admin and verify event appears in AI review queue.
2. Sign in as manager for the same kindergarten and verify scoped visibility if policy allows.
3. Sign in as manager for another kindergarten and verify denial.
4. Sign in as assigned inspector and verify only allowed reviewed/reviewable signals.
5. Confirm reviewer can dismiss, confirm, mark false positive, or request follow-up.

## False Positive Tracking Test

1. Mark an event false positive.
2. Confirm reviewer, reason, timestamp and model version are retained.
3. Confirm calibration/quality view reflects the outcome.
4. Confirm no parent notification is sent.

## Parent Visibility Denial Test

1. Sign in as parent.
2. Try parent AI/safety report and raw event routes.
3. Confirm raw event is not visible.
4. Confirm only reviewed parent-approved summaries can be shown.
5. Confirm no raw confidence score, raw frame URL or internal review note appears.

## Digital Observer Separation Test

1. Create a Digital Observer site-scoped shadow event.
2. Confirm Gan Batuach garden users cannot see it.
3. Confirm Digital Observer site owner/admin sees only their site context.
4. Confirm billing/customer/provider status remains product-separated.

## Legal Mode Checklist

- Audio disabled.
- Face recognition disabled.
- Raw parent alerts disabled.
- Automatic accusations disabled.
- Human review required.
- Legal-review-required capabilities disabled.
- Parent visibility only through reviewed approved summary.

## Rollback Plan

1. Set `AI_PROVIDER_MODE=disabled` or `mock`.
2. Disable AI worker scheduler/test endpoint.
3. Stop frame sampling jobs.
4. Mark candidate events archived/dismissed where appropriate.
5. Revoke/rotate provider secrets if exposure is suspected.
6. Preserve audit logs for investigation.

## Current Result

No real frame source or inference endpoint was configured during PROD 4. Real AI live remains false.
