# DIGITAL OBSERVER — ENTERPRISE, OEM AND WHITE-LABEL REQUIREMENTS

Date: 2026-10-18
Enterprise status: FOUNDATION / PARTIAL
OEM and white-label status: NOT STARTED with internal foundations only

## Current truth

The repository has tenant/Site schemas, RLS, role foundations, fleet inventory, edge identities, audit records, internal first-party APIs, standalone memberships/subscriptions and an admin-only integration-client registry. It does not yet provide a supported public API, enterprise organization hierarchy, SSO/SCIM, enterprise service accounts, SDK, partner sandbox, OEM provisioning, embedded reference application or branded external deployment.

## Enterprise product requirements

PUSH 41 owns the organization and authorization plane:

- organization → business unit → Site → camera/fleet hierarchy;
- multi-tenant and multi-Site policy;
- monitoring-center teams and least-privilege roles;
- SSO, session policy and where selected SCIM lifecycle;
- scoped service accounts with rotation, revocation and audit;
- camera inventory, fleet health, reports and support access;
- retention, legal hold and export controls;
- SLA/SLO definitions backed by measured telemetry;
- billing/entitlement boundaries separate from technical health;
- independent cross-organization isolation tests.

## OEM / B2B2C model

PUSH 43 owns the partner product surface, dependent on PUSH 41 and 42. Required hierarchy:

Digital Observer platform → Partner tenant → Partner customer/account → Site → camera/system → authorized users/service accounts.

The partner may pay Digital Observer and independently bill end customers. Digital Observer must meter and invoice only its contractual counterparty and must not assume control of partner retail pricing. Data isolation, support ownership, incident responsibility, retention and subprocessors must be explicit per contract.

DO-NS-194 adds partner/end-customer hierarchy and provisioning. DO-NS-195 adds partner usage metering and settlement. Neither is satisfied by the current static integration-client registry.

## White-label and embedded delivery

Supported modes may include:

- branded hosted UI with tenant-scoped theme/configuration;
- embedded components that remain inside the partner interface;
- API-only integration;
- supported SDKs;
- webhooks/event callbacks;
- SSO and partner provisioning;
- deep-link/open-camera into the partner VMS;
- partner-scoped authorization and audit.

Branding must never alter authorization, provenance, health truth, legal notices or support boundaries. Upgrade/version compatibility and end-of-life policy are mandatory.

## Public API platform requirements

PUSH 42 must provide versioned contracts for camera inventory/health, Events, Incidents, Watch Rules, authorized Evidence references, investigation requests where lawful, provisioning and usage. Mandatory controls:

- OAuth/service-account authentication and scoped authorization;
- tenant/Site resource binding;
- explicit API version and deprecation window;
- rate limits, quotas and retry guidance;
- idempotency for mutating operations;
- signed, replay-protected webhooks with delivery lifecycle;
- complete audit and correlation IDs;
- sandbox/test tenant and deterministic fixtures;
- integration documentation and conformance tests;
- usage metering by partner/customer/API credential;
- no raw camera credentials, private object paths or unrestricted media URLs.

## SDK requirements

At least one supported SDK must be generated or hand-maintained from the published contract, with semantic versioning, secure defaults, examples, migration guide, compatibility matrix and support policy. A first-party internal client is not SDK proof.

## Acceptance proof

An independent consumer must provision an isolated customer, ingest or read authorized camera/status/Event data, receive a signed webhook, open authorized Evidence, embed or brand a supported flow, rotate credentials, hit rate limits safely and upgrade across one version. Cross-partner and cross-customer negative tests must pass. A real business or monitoring-center pilot supplies operational proof in PUSH 47/48; PUSH 49 reconciles usage economics; PUSH 51 proves a signed commercial partner outcome.
