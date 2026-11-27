# External webhook durable delivery proposal

The qualified v1 HTTP contract covers a reference-only body, signature, bounded retry and local ACK. The gateway's outbox ends at ingestion. The notification dispatcher binds its attempt rows to a Profile-oriented delivery, while the v1 registry owns the subscription, Site, service account and signing key reference. Connecting these contracts requires an authoritative event-to-subscription binding. This proposal is offline and includes no migration or runtime wiring.

## Minimal additive storage

- A delivery record references the canonical Event and subscription and stores the authoritative Tenant and Site selected server-side. Enforce uniqueness on the Tenant, Site, Event and subscription tuple for the initial `event.created` scope. Store a stable delivery ID, immutable reference-only body or immutable reconstruction inputs and body digest, pinned signing key version, deadline, attempt ceiling, status and next retry time. An equivalent repeated enqueue returns the existing delivery. A conflicting body, ownership tuple or version cannot replace it. Do not persist a secret or media locator. Additional event types need a separately qualified identity.
- An attempt record references exactly one delivery. It stores a monotonically increasing attempt number, unique claim token, lease deadline, signing key version, dispatch marker, and sanitized response or reconciliation status. Use a unique delivery-and-attempt-number constraint. The current claim compares delivery identity, attempt number, token, phase and unexpired lease. Reserve an attempt in the same transaction that moves the delivery to the claimed phase. Write attempt result and delivery status together, with the same fence. A late result from an obsolete claim cannot change state.
- Enqueue alongside canonical event acceptance or use a durable, replayable cursor with an idempotent enqueue. Verify the write boundary against the canonical ingest implementation before any activation. A site transfer, subscription revocation or key rotation must preserve historical delivery receipts. Use restrictive references or retention rules that preserve the required history.

## Authorization and recovery

| Condition | Required handling |
| --- | --- |
| Before claiming or sending | Reload canonical Event ownership, subscription scope and status, service-account event and delivery authorization, and the authorized key version. Validate the destination and resolve the pinned key only inside the future authorized transport. Recheck before changing the persisted claim to dispatching. A revoked key or changed ownership blocks sending. |
| Lease expires before a dispatch marker | The attempt is known unsent. It can become eligible for a fresh, fenced claim after PUSH 39 backoff, subject to deadline, attempt budget and current authorization. |
| Durable temporary failure that proves non-acceptance | Use PUSH 39 backoff and attempt ceilings. A timeout, ambiguous response, or connection break cannot establish non-acceptance. |
| Dispatch marker exists and no result is recorded | Preserve `unknown_outcome` and prevent automatic retry. This includes a crash after the recipient's ACK and before persisting it. A result that remains ambiguous after the send deadline is still evidence of an unresolved attempt. |
| ACK recorded or authenticated reconciliation confirms receipt | Persist acknowledgement without sending again. A verified ACK remains evidence even if the send deadline passes. Require evidence bound to the subscription, stable ID, attempt, body digest and key version. If the recipient cannot produce independent evidence, leave the outcome unresolved. |
| Duplicate claim or stale owner | Reject the second claim while the current lease is active. After recovery a higher attempt number fences previous claims. Acknowledgement is terminal. |

Receivers still need their own stable-ID idempotency. Any retry of an ambiguous result would require a separate policy and a verified receiver deduplication or acknowledgement contract. The v1 signing format remains unchanged.

## Local evidence and next gate

`node --test scripts/qa/check-external-webhook-durability.mjs` uses separate synthetic sender and receiver files. It reopens the sender journal without a local ACK, rejects automatic replay and stale-owner completion, and reconciles only a matching receipt. It also checks duplicate enqueue, delayed recovery of known-unsent work, Site and key-version mismatch, subscription revocation, and preservation of a late ACK. The fixture reuses PUSH 39 transitions for ordinary outcomes and keeps acknowledgement and ambiguity visible separately from the send deadline.

The fixture has one sequential writer and simulates interruption by abandoning the sender before result persistence. It provides no process-kill, power-loss, database-locking, cross-process concurrency, receiver-receipt authentication or production durability proof. Before enabling any dispatcher, qualify the canonical write boundary, transactional claim and receipt storage, concurrent and stale claims, revocation at dispatch, key custody and rotation, authenticated peer reconciliation, and rollback that preserves all pending and unknown attempts.
