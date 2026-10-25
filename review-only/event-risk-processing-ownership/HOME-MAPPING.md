# Model A historical Home mapping — source-only, not backfilled

Candidate canonical Tenant: an existing row in
`public.digital_observer_organizations` (`organization_type` permits `family`
and `business`). This is a **proposal**, not a verified historical mapping.
`public.observer_sites.digital_observer_organization_id` is nullable and its
existing FK uses `ON DELETE SET NULL`. The current schema does not prove one
organization per customer, nor that every Home Site has one. Do not infer a
Tenant from email, name, Site label, `owner_profile_id`, a `do-site:` billing
key, or nullable enrollment `tenant_id`.

| Record category | Existing authoritative identity | Candidate chain/cardinality | Source evidence | Ambiguity and treatment |
| --- | --- | --- | --- | --- |
| Customer Tenant | `digital_observer_organizations.id` exists, with owner profile and type | One customer → one organization; one organization → many Sites | `20260820010000_digital_observer_product_runtime.sql` | Customer/organization uniqueness and historic ownership unproven. **BLOCKED FOR BACKFILL** until restricted row-level ownership review and owner decision. |
| Site | `observer_sites.id` is PK; optional `digital_observer_organization_id` FK | Exactly one Tenant per non-garden Site | multisite foundation + product runtime migrations | NULL, historical owner changes, or conflicting organization membership may exist; counts only in unrun preflight. **BLOCKED FOR BACKFILL**. |
| Gateway enrollment | `video_gateway_device_enrollments.id`, Site FK, nullable `tenant_id` added later without FK | One enrollment → one Site/Tenant | gateway enrollment + managed-device identity migrations; `gateway-auth.ts` reads Site but not Tenant | Legacy/Hardened population and tenant/Site agreement unverified. Do not copy `tenant_id` to Site. **BLOCKED FOR BACKFILL**. |
| Camera Source | `digital_observer_camera_sources.id`, non-null Site FK | One Source → one Site → Tenant | product runtime migration; event route scopes Source to authenticated Site/Gateway | Source metadata Gateway IDs are not Tenant authority; historical Site consistency requires restricted preflight. |
| Canonical Event | `observer_intelligence_signals.id`, nullable Site FK; camera source ID in JSON metadata | One Event → one Source/Site/Tenant | intelligence migration; cloud-events route | Nullable Site and JSON-only camera reference cannot prove all history. Only validated `REAL_CAMERA_AI` subset is eligible. **BLOCKED FOR HISTORICAL CLAIMS** on missing/malformed metadata. |
| Incident link | `observer_correlated_event_links.source_id` with polymorphic `source_type`; unique signal timeline index | One eligible Event → zero or one Incident; unmatched exit is valid zero | correlation migration and function | Link/Incident/Event Site equality is not globally enforced. Mismatch cannot be auto-fixed. |
| Incident | `observer_correlated_events.id`, nullable Site FK | One eligible Incident → one Site/Tenant | correlation migration | Legacy garden rows coexist; Site null/foreign ownership needs classification before any constraint validation. |
| Risk Decision | `digital_observer_risk_evaluations.id`, non-null Site/Incident/Event FKs, unique Incident/Event/version | One Risk row → exact Event/Incident/Site/Tenant | risk migrations | Independent FKs do not enforce matching Sites; prior privileged synthetic mismatch was accepted. It was **not** an ordinary-user RLS bypass. |

`SITE-PREFLIGHT-READ-ONLY.sql` contains unrun aggregate counts. A future
separately approved restricted inspection must classify every ambiguous row
without printing PII, credentials, verifier data or media. Validation of an
existing FK/index from migration text is not proof it is present or validated
in the actual Development database. No automatic Tenant assignment, deletion,
overwrite or owner-role change is proposed.
