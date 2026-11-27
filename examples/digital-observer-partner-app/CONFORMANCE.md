# PUSH 43 partner sandbox conformance

The [external proof register](../../DIGITAL_OBSERVER_EXTERNAL_ACTIVATION_PROOF_REGISTER.json) keeps OEM partner proof open. The checked register and [Development ledger](../../DEVELOPMENT_INTEGRATION_LEDGER.json) contain no documented approved partner, contact, browser Origin or external sandbox for this run. Use the matrix below to prepare. An independent run can begin only after approving the items below.

## Approval and fixture

Obtain one access-controlled approval record for the named partner and its executor, the approved agreement and data-processing terms, the exact sandbox API origin and partner-owned browser Origin, the synthetic customer/Site fixture, the authorized test window, and the operator who can revoke tokens, transfer the synthetic Site and read sanitized meter deltas. Confirm the traffic and cost boundary before opening the window. Share approval details privately. Use a random opaque `p43-...` run reference in the receipt.

- Use a dedicated sandbox with two synthetic customer Sites, exactly two synthetic camera records on the allowed Site in known newest-first order, and another Site the partner credential cannot read. Use synthetic records only and the existing v1 routes.
- Pin the SDK source to the project-approved revision and preserve the artifact or commit reference. `7cea7e8460886e797d9cc208997be5080e31e95a` is the local qualification reference. The SDK is supplied through an authorized source artifact or checkout. Registry publication is outside this package.
- Use one temporary customer-resource `dosvc_` credential with only the required camera-read and Site scope. Load it through the partner's approved server-side secret mechanism. The browser receives only a short-lived `doemb_` token for the exact Origin, Site and audience. Keep the credential and token out of URLs, persistent browser storage, console logs, HAR files and screenshots. Use the approved internal operator for session issuance, revocation, transfer and meter readback.

## Signed SDK checks

From the repository root, use Node 22.22 or later within the supported project range. Supply these inputs through the partner runner's protected environment. Read the exact API origin independently from the approval record.

| Input | Meaning |
| --- | --- |
| `PARTNER_APPROVED_API_ORIGIN` | Exact approved HTTPS origin |
| `PARTNER_EXTERNAL_V1_URL` | That origin followed by `/api/digital-observer/external/v1` |
| `PARTNER_RUN_REF`, `PARTNER_SDK_REVISION` | Approved opaque run label and exact 40-character source revision |
| `PARTNER_SERVICE_CREDENTIAL` | Dedicated rotating sandbox credential, server-side only |
| `PARTNER_ALLOWED_SITE`, `PARTNER_DENIED_SITE` | Approved and excluded synthetic Site IDs |
| `PARTNER_FIRST_SOURCE`, `PARTNER_SECOND_SOURCE` | The two synthetic source IDs in expected order |

```sh
umask 077
node examples/digital-observer-partner-app/conformance.mjs --run-approved-sandbox > conformance-receipt.json
```

The runner sends up to three signed GETs with an eight-second timeout per request, rejects redirects, and performs no lifecycle operation. It asks for two one-item pages, requires the second page to end pagination, then expects a 403 with `EXTERNAL_API_SITE_SCOPE_DENIED` for the other Site. Exit code 0 means both scripted checks passed. Exit code 1 records a failed check. Exit code 2 means the run was refused before recording results. Stop on failure and keep any unrun steps marked `NOT_RUN`.

## Partner browser and coordinated lifecycle

1. **Browser embed.** In an actual browser on the approved partner-owned Origin, run the existing SDK browser component with the temporary token in memory. Confirm preflight 204, dashboard 200 for only the approved Site and two synthetic sources, no cookies on the dashboard request, and `raw_video_embedded=false`. Review only the status and scoped assertions. A server fetch or loopback mock cannot fill this row.
2. **Session revocation.** The authorized operator revokes this exact token while the Site remains in place. From the same Origin, try one dashboard read using the revoked token. Expect HTTP 403 and no browser data. Because denial has no readable CORS response, use the authorized service-side result or browser network status to confirm the server response. Record only the assertion outcome.
3. **Site transfer.** Use a separate, still-valid token that the partner has first verified on the allowed Site. The authorized operator reassigns that synthetic Site to the second test tenant, while retaining the pre-transfer relationship for the denial check. The same token and original credential must be rejected, with no dashboard or inventory data. Verify `403` for one browser read and one signed SDK inventory read. Restore the synthetic fixture or revoke all temporary access under the approved cleanup procedure.
4. **Usage attribution.** Have the operator compare meter totals immediately before and after the scripted run, using an account and Site free of other traffic. If the run crosses an hourly boundary, sum only its affected buckets. Expect exactly two successful `cameras.list` increments on the approved account/Site. The denied Site and post-transfer signed read must add zero. Record deltas only, without account, Site or bucket identifiers. Embedded reads use a separate session contract.

## Receipt and evidence

Start with [the receipt template](conformance-receipt.template.json). The scripted run emits a candidate receipt for two checks. The independent partner fills the remaining cells after observing each check and confirms provenance through the approved channel. The reviewer verifies the run reference, source revision, environment, exact registered Origin and approval separately. A receipt produced from a stub, internal operator alone or replay of local evidence cannot establish an independent partner run.

Keep only the schema marker, opaque run reference, evidence classification, exact SDK revision, contract version, UTC timestamp, and check statuses. Optional usage evidence consists solely of success and denied-request deltas. Exclude emails, contacts, hostnames, tenant/Site/source IDs, tokens, hashes of secrets, headers, signatures, cursor values, payloads, request IDs, screenshots and media. Use `FAIL` for an executed failed check and `NOT_RUN` for any missing observation. The receipt is a candidate until the project reviews it.

| Check | Local Development evidence | Independent partner |
| --- | --- | --- |
| `signed_paging` | PASS through Next and native PostgREST | NOT_RUN |
| `cross_site_denial` | PASS in isolated signed SDK tests | NOT_RUN |
| `browser_embed` | PASS in local Chrome through Next and native PostgREST | NOT_RUN |
| `browser_revocation` | PASS in local Chrome after revocation | NOT_RUN |
| `site_transfer` | PASS in local browser and signed SDK after transfer | NOT_RUN |
| `usage_attribution` | PASS in local SQL/Data API with two successful writes and no post-transfer increments | NOT_RUN |

This package qualifies the core v1 access and embed contract. External SSO, customer domains, durable Webhook delivery, vendor/VMS compatibility, settlement and release retain their own gates in the register.
