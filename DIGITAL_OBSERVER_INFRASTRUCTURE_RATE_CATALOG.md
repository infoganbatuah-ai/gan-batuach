# DIGITAL OBSERVER — INFRASTRUCTURE RATE CATALOG

Date: 2026-09-10
Contract: `observer-cost-rate-catalog-v1`

## Rules

A rate is versioned by catalog/version, provider, resource, unit, currency and effective interval. It includes a source and confidence classification. Historical cost reports retain the rate ID/version used at calculation time.

Provider credentials and signing material are never stored in the catalog. Release of a rate does not authorize billing or routing changes.

## Current production truth

No authorized Vercel, Supabase, notification-provider, Cloud-AI invoice, local electricity tariff or hardware-amortization source was available to this PUSH execution. Therefore the production catalog contains no invented seeded monetary rates and current provider reconciliation is:

`NOT AVAILABLE / NOT RECONCILED`

The deterministic QA catalog uses an explicitly test-only rate to prove arithmetic, effective-date lookup, attribution and reconciliation. It is not Production economics and is not migrated as a default rate.

## Rate lifecycle

1. Obtain an authorized provider invoice, usage export, contract or approved estimate.
2. Normalize provider/resource/unit/currency.
3. Record source, effective date, version and confidence.
4. Calculate usage without rewriting historical records.
5. Reconcile calculated and actual provider cost.
6. Record variance; approved tolerance must be explicit rather than invented.
7. Retire/supersede rates by a new version/effective interval.

Future secure provider import may automate steps 1–5, but missing provider access remains an evidence gap rather than a code defect.
