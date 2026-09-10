# DIGITAL OBSERVER — AI ROUTING POLICY

Date: 2026-09-10
Policy: `observer-ai-routing-policy-v1`

## Two-phase decision

1. **Eligibility:** enforce capability/model/input compatibility, privacy, tenant policy, region/provider constraints, source accessibility, health, revocation and available capacity.
2. **Preference:** rank only eligible targets using job priority, expected latency, load, locality, measured quality/reliability and an explicit tenant preference.

An optimization score can never override a rejection. Every decision is `TARGET_SELECTED` or `NO_ELIGIBLE_TARGET` and records eligible targets, bounded rejection reasons, selected target, explanation, policy version and audit digest.

## Privacy classes

- `EDGE_ONLY`: only `EDGE_LOCAL`; no failover to local-dedicated or Cloud.
- `LOCAL_ALLOWED`: Edge or authorized local-dedicated target.
- `CLOUD_ALLOWED`: any otherwise authorized target, including future Cloud adapters.
- `DEDICATED_ONLY`: local-dedicated or Cloud-dedicated, subject to tenant, region and provider policy.

Tenant policy is passed per decision and cannot mutate another tenant. It may constrain target classes, regions, providers, shared Cloud use and dedicated execution.

## Health, capacity and priority

Unavailable, unhealthy, crash-looping or revoked targets are rejected. At-capacity targets are rejected before preference. CRITICAL/HIGH jobs weight expected latency more strongly; learning jobs tolerate latency. PUSH 31 queue priority, fairness and backpressure remain authoritative and are not replaced by routing.

## Failover

A retryable target failure releases the same leased job for bounded failover. The router excludes the failed target, records normalized history and chooses another eligible target. Job ID, idempotency key and observation time remain unchanged. Queue ACK/result uniqueness still permits one canonical downstream result effect.

If no eligible target remains, the decision is `NO_ELIGIBLE_TARGET`; the durable job remains pending under its existing retry/expiry contract. An `EDGE_ONLY` job never crosses its privacy boundary.

## Cost and quality boundary

Measured PUSH 28 quality may influence preference; model confidence may not. Cost class/accounting metadata is emitted for PUSH 33, but cost does not affect PUSH 32 scoring. No price or savings is fabricated.
