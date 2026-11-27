# Source-restricted external v1 and embed route matrix

This review describes proposed enforcement for a future, explicitly source-restricted principal. Current Site-scoped service accounts and embedded sessions keep their existing behavior. The [authorization review](README.md) identifies the missing issuer and canonical grant. This matrix adds no product scope, route or SQL.

## External v1

The [dispatcher](../../app/api/digital-observer/external/v1/[...segments]/route.ts) is the route inventory. Resolve the current server-owned grant after request authentication and existing Site, operation and entitlement checks. Resource reads must stay restricted until each underlying query and derived result can enforce the same binding.

| Existing operation | Result or side effect | Future enforcement for a restricted principal |
| --- | --- | --- |
| `GET openapi.json` | Public contract metadata | Preserve existing public schema response. It conveys no entitlement. |
| `GET cameras` and SDK `cameraHealth` | Inventory and health list, cursor | Add canonical source ID to the Site query before ordering/pagination; apply request selector only as an intersection. No sibling rows or sibling-derived cursor. |
| `GET cameras/:id` | Detail and generated product link | Check requested ID and Site against the canonical grant in the lookup. Project reviewed safe fields. Emit a link only to an independently authorizing destination; a link never carries a grant. |
| `GET events`, `GET events/:id` | Filtered list, cursor and direct detail | Establish that `camera_id` is a canonical source for each event; filter before pagination or direct response. Exclude unproven legacy aliases or detached rows. |
| `GET incidents`, `GET incidents/:id` | Aggregate list/detail with primary source, involved cameras, related events, risk and timeline | Keep closed until all contributing observations and derived fields have proven scope. A primary camera match is insufficient. Do not return the ID, count or cursor of excluded mixed/unresolved Incidents. |
| `GET evidence/:id` | Direct Evidence lookup, associated Event ID and product/media paths | Match Evidence ID, canonical Event/source and currently owned Site before returning reference or link. Cross-source and unresolved items cannot expose their presence. No media access path for a scope where media is disabled. |
| `GET evidence/:id/media` | Direct lookup then private storage authorization or signed redirect | Keep closed for restricted principals until canonical provenance and per-use revocation are proven across both storage branches. Do not call either signer or emit a bearer redirect before these checks. |
| `POST investigations/search` | Candidate camera list, compiler result, search, aggregate and report | Keep closed until the grant bounds candidate loading, compilation, query execution, timeline and post-query report. Mixed summaries or counts must never be calculated from unauthorized sources. Preserve privacy and no locator output. |
| `GET watch-rules`, `POST watch-rules` | Rules list, compile/simulate over history, state mutation by ID | Keep closed until source binding is proven through all rule targets, compilation and simulation, and rechecked under the state mutation fence. |
| `GET/POST webhooks/subscriptions` | Account subscription list, register, rotate or revoke | Keep closed until subscription and delivery have a verified source binding. Authorize event subscription and current grant before enqueuing/dispatching and on retries. Existing Site-level registrations cannot be reused as a source grant. |
| `GET integrations/capabilities`, `POST federation/query` | Provider resource list/capability manifest and selected provider IDs | Keep closed for restricted accounts until a server-owned mapping can prove each provider resource only represents the canonical granted source. Registry IDs and a non-executed federation response confer no camera authority. |
| `POST integrations/deep-links` | HTTPS link created using provider integration source and resource selector | Keep closed until provider resource mapping, embedded identifiers and destination enforcement prove source scope. HTTPS validation alone does not establish which camera the provider will open. |
| `GET gan-batuach/contract` | Role mapping and generated link to separate authorization domain | Keep separate from source grants. Any reachable Management data requires its own authority. No source grant inheritance or adapter change is proposed. |

## Embedded dashboard

| Existing surface | Result | Future enforcement for a restricted principal |
| --- | --- | --- |
| [Partner v1 issuance](../../app/api/digital-observer/partner/v1/[...segments]/route.ts) and [partner management issuance](../../app/api/digital-observer/partners/route.ts) | Token issuance | Both routes must preserve the restricted account/grant binding. A human partner request also requires the trusted customer-side approval before issuing a restricted token. Keep issuance closed for such principals until the binding is persisted and validated. |
| [Dashboard OPTIONS/GET](../../app/api/digital-observer/embed/v1/dashboard/route.ts) | CORS negotiation then brand, Site, cameras, health, events, Incidents and Evidence references | OPTIONS stays transport-only. On GET verify session and current source grant before submitting any queries. Filter camera inventory and health before totals/limits. Scope Site and brand fields to reviewed metadata. Keep events, Incidents and Evidence arrays empty for the initial restricted contract until their provenance and aggregation are qualified. Keep existing privacy scopes, eligibility, Origin/audience and final expiry/revocation checks. |

## Evidence and dependency order

The new isolated SDK/handler test loads a synthetic Incident whose primary source is A and whose observations include A and B. Both the list and the direct lookup return the composite record under the existing Site grant. This demonstrates why filtering only by primary camera would be insufficient. It does not demonstrate a bypass of a single-source grant because the current code has no such grant.

1. Verify customer issuer, canonical Tenant/Site/source ownership and the write fence against an explicitly authorized Development catalog. Include restored and legacy rows.
2. Qualify source-restricted account and session mode and a fail-closed grant lookup. Preserve existing Site principals. Verify scoped ownership, revocation and read paths at the persistence boundary before changing external behavior.
3. Implement and qualify the camera inventory, detail and health path with the same source predicate. Test mixed sets, counts, cursors, cached known IDs and metadata links. Confirm only granted facts are serialized.
4. Keep derived paths closed until they prove all contributing provenance and link destinations. Prioritize Events, then Evidence metadata, then Incidents/investigation. Independently verify both storage paths before any delivery. No archive endpoint is required for these steps.

No database, live partner, grant issuance, provider transport or media was used for this qualification.
