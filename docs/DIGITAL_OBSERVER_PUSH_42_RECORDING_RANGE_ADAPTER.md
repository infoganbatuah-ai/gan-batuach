# Push 42 recording range adapter

Local source qualification for DO-NS-086. The initial scope is one configured Physical Gateway DVR archive channel. The fixture represents that channel with a synthetic identity and the existing `observer-source-recording-reference-v1` contract. No archive transport or live source is configured by this change.

The adapter receives a server-derived session grant for the exact Tenant, Site and source. It requires a UTC interval of up to five minutes, full coverage by one retained recording, and an Event inside the interval. The lookup returns a trusted tuple of recording, Event and Evidence. The adapter independently checks their identities and the Event–Evidence–recording linkage. It returns an internal range handle only after the audit writer confirms the entry. A failed lookup or audit, missing retention, expired session, crossed scope or inconsistent link fails closed. The range handle carries no URL, token or media and cannot authorize playback by itself.

## Next integration gate

1. Obtain the DVR recovery handoff with identified advancing CH1 and Tapo frames in the original account browser, plus authorization for one existing CH1 archive interval.
2. Verify the installed DVR archive interface supports bounded reads. Use one approved source mapping and a fresh server-side authorization check. There is no verified archive reader in this change. The existing source reference schema deliberately distinguishes source recordings from Event Evidence. A trusted lookup must establish their link with validated records before wiring this adapter. The [review-only linkage proposal](../review-only/push42-source-recording-link/README.md) identifies the specific missing relationship and the evidence required before registering it.
3. Connect the existing durable audit mechanism and prove acknowledgment. Normalize timestamps to UTC ISO format. Reauthorize and recheck expiry at playback, and constrain the media serving boundary to the exact range. Keep the locator server-side.
4. In the original account, select the source and interval, retrieve and play advancing recorded frames, verify Event and Evidence linkage and the durable access audit, and verify the cross-site negative case with an authorized test identity. Genuine archive retrieval and playback: **NOT RUN**.

## Local validation

`node --experimental-strip-types --test scripts/qa/check-recording-range-retrieval.mjs` exercises the adapter with synthetic records. It covers scope, time and coverage, Event/Evidence identity, retention, expired sessions, lookup failure, and fail-closed audit acknowledgment. This branch adds no route, migration, provider configuration, or media delivery.

## Investigation handoff

The existing Hebrew investigation API adds a chronological timeline from the current authorized result page after site access, entitlement and history-privacy checks. The UI filters that page by camera. Only grounded rows with available Event Evidence show an archive candidate interval, clipped to the query and current time. Evidence playback retains its existing path. The archive candidate has no playback action and does not establish that a source recording exists.

The server-side preparation function rebuilds the candidate from authorized results and passes it to the range adapter. No transport calls it yet. The best-effort `writeAuditEvent` continues to log and swallow failures for its existing callers. The server-only audited adapter uses a separate acknowledged writer for the existing audit store. Before activating archive access, bind the trusted archive–Evidence lookup and verify the writer against an authorized Development database. Record the authorization without raw archive identifiers, URLs or credentials. No SQL or schema changes are included here. Focused tests cover clock normalization, authorization, linkage, privacy and audit failure alongside the existing Hebrew investigation regression.

## External consumer conformance

| Boundary | Verified in the local unit | Remaining proof |
| --- | --- | --- |
| Push 42 external v1 | Existing SDK signs Event, Evidence, camera-health and investigation requests. A disconnected transport verifies the real signature and applies a synthetic one-camera grant. The investigation route now uses the shared history privacy policy before reading cameras or events. Its grounded report explicitly marks source recording unavailable and supplies no archive locator, credential or media grant. | A real independent consumer must exercise account/Site authorization, separate Evidence permission, expiry and revocation. Current canonical service account grants are Site/organization based; `camera_id` filters are not per-source ACLs. Proving a one-source-only account needs an authoritative source grant. |
| Push 43 embedded v1 | Existing browser SDK sends the short-lived token and audience without cookies in the synthetic transport. Dashboard now skips Event, Incident and Evidence reads without the corresponding scope or when history privacy disallows them. Cameras remain a required scope; health fields and heartbeat times also require `camera_health.read`. | Independent partner, authorized origin, actual token expiry/revocation and isolation on the integrated branch. |
| DO-NS-193 Gan Batuach boundary v1 | Role map grants no inherited access to parents or staff, and the status adapter is disabled by default and separate from external API investigation. Existing status implementation checks server credentials, active client and a linked kindergarten Site. | The role map is descriptive. The status adapter does not bind the integration client to a specific garden/Site or establish the end user's role. A trusted exact mapping and audited runtime negatives are required before enabling it. This unit does not change Gan Batuach. |
| Archive | No external archive endpoint or playback permission added. | Authorized real archive lookup, acknowledged audit, bounded transport, identified post-recovery video, and independent partner/browser acceptance remain open. |

Run `node --experimental-strip-types --test scripts/qa/check-push42-investigation-consumer.mjs` for the disconnected conformance suite. Synthetic grant checks and SDK transport do not prove deployed authorization, device playback, or RLS.

## Acknowledged access audit

Server-only `createAuditedRecordingRangeAdapter` composes the scoped range adapter with the existing `immutable_audit_events` store. The critical writer submits a unique UUID and requests that exact ID back from the insert. Rejection, transport failure, missing row, or mismatched ID prevents delivery of an archive handle. The range adapter checks session and retention again after the write. A response may be lost after insert, so a missing receipt denies access but does not prove there is no audit row.

The event records actor, Tenant, Site, camera, Event, Evidence, authorized UTC interval and authorization time. Raw archive references, recording locators and credentials are omitted. No route calls the composed adapter. The tests use the installed Supabase client with a synthetic transport that intercepts every request. An actual Development insert and its permissions, source ownership, trusted archive lookup, and browser playback remain unverified. No migration is proposed.

## Local multi-camera incident reconstruction

The first-party history response projects an incident's linked Events from the already validated result set. A timeline-summary row alone cannot supply a verified observation. Scope, source identity, time window, history privacy and grounded Evidence are checked again in the projection. Canonical camera IDs take precedence over legacy stream aliases. An alias shared by multiple cameras does not establish source identity. Camera counts use canonical IDs even when display names are identical.

Recorded timestamps are normalized to UTC, then displayed in the Site timezone. Groups span less than one minute from their first observation. A group is temporal proximity only. Cross-camera synchronization is unverified. Disagreement between observation and stored timestamps is shown without estimating clock drift. Rows with no explicit timezone are left out of the chronological view. Stored-time-only rows and missing Evidence are labeled separately.

Each incident shows at most 25 observations on the current search page. The page cursor does not combine pages or change the submitted search. The view exposes an existing Event Evidence route only when grounded and available. The application creates no movement or identity claim, incident mutation, archive grant, or new media route. Browser, live media, archive retrieval and real multi-camera clock measurement remain untested.

## Bounded incident observation export

The first-party investigation UI offers a JSON export for one incident on the current authorized page, with at most 25 corroborated observations. Initial scope is the Site owner. On each export request, the existing investigation endpoint verifies the active session, trusted mutation origin, exact Site ownership, investigation entitlement and history-privacy policy. It reruns the submitted search and cursor on the session client. A changed, stale or missing incident snapshot returns a conflict. The attachment is private and uncacheable. Authentication or audit failure produces an error without an attachment.

The document contains stable Site, Incident, Event, source and available Evidence IDs, UTC times, timestamp basis, and coverage and uncertainty flags. It carries no media, path, URL, free-text question, camera label, name, or identity inference. Expired or missing Evidence appears as a state with no Evidence ID. The source states that observations came from an authorized investigation page. The version is `observer-incident-observations-v1`. Verify `content_sha256` by hashing the UTF-8 JSON of the `report` object with object keys sorted recursively and no added whitespace, preserving array order. The existing audit writer must acknowledge a row for the report digest before download. Verification of origin requires the corresponding trusted audit record. The digest alone does not authenticate origin or establish chain of custody.

The route conformance tests execute the handler with synthetic data, identity and audit boundaries. Browser download, actual authorized database writes, live or archive media, external sharing and forensic chain of custody remain unverified. No additional persistence or migration is included.

## Synthetic local playback qualification

On November 27, 2026, the existing `ObserverLivePlayer` was bundled without source changes and mounted in a loopback-only browser fixture. The fixture served a ten-second 320×180 H.264 test pattern with 240 source frames, no audio, and one-second HLS segments. Its synthetic grant endpoint scoped the allowed source, issued one claim, and returned 403 for a second source. It used no account, device data, or live recorder. The real Product identity and delivery edge were not part of this fixture.

| Surface | Measured result |
| --- | --- |
| Chrome, native HLS | The existing player reached `playing`. Presented frames advanced 242→245 at media times 1.042→1.167 seconds after seeking into the fixture. The denied source reached error with no media source. |
| Chrome, forced hls.js fallback | With native HLS detection disabled in the fixture only, the existing component attached a MediaSource and reached `playing`. Frames advanced 242→245 at 1.042→1.167 seconds. The denied source had no media source. |
| macOS WKWebView, native HLS | The existing component reached `playing`. Twelve presented-frame callbacks advanced from 0 to 0.458 seconds at 320×180. This is desktop WebKit evidence. |
| Chrome Event Evidence MP4 pattern | The existing inline-video pattern was exercised with a synthetic 307 media redirect. At 320×180, four presented frames advanced from 0.042 to 0.167 seconds. This qualifies the media pattern, not the real storage signer. |
| Canonical authorization and Event Evidence regression | The DVR grant handler's four synthetic authorization cases passed, together with the existing Event Evidence contract checks. |

The registered iPhone 13 Pro was visible to Xcode and no simulator was booted. The pilot contract at `3a775c49` pins `com.digitalobserver.app.pilot` to the existing Product HTTPS origin, with cleartext disabled and no navigation override. Launching that build would take the test outside the local fixture. **Physical pilot playback remains NOT RUN.** The next device test needs an approved signed Development-only QA build with a trusted, isolated synthetic HTTPS origin that preserves the native shell and source authorization. A real DVR archive test also needs a verified archive-to-Event/Evidence link, trusted lookup, actual audit acknowledgment and bounded authorized transport.

No player defect was observed under these synthetic conditions, so this unit changes no player code. All launched fixture listeners were closed and verified absent, the two browser tabs were closed, and generated clips and binaries were removed. The fixture sources remain on the external drive for reproducibility.

## iOS pilot and separate Development preflight

The physical iPhone 13 Pro returned exactly one installed Product pilot entry, `com.digitalobserver.app.pilot`, version 1.0 build 1, from the read-only installed-app inventory. The pilot was not opened. Its pinned Product origin means a playback check through the installed bundle is a Product-account check. That check belongs with the camera recovery owner and needs its own approved account and source scope. Device inventory and the previous macOS WebKit result do not establish iPhone playback.

CoreSimulator reported the iOS 26.3 runtime available but zero registered devices in both the default and explicit external device-set views. There are old device directories on the external drive. The running service did not recognize them as registered devices. No device was created, repaired, registered or booted. Simulator playback remains untested.

The checked-out separate `PersonalTeamQA` identity is `com.ganbatuach.app.qa`. Its existing finalizer rejected the loopback HTTP fixture and returned the expected `PUSH44_QA_REMOTE_BUILD_BLOCKED` on an otherwise valid scoped HTTPS input. Neither check wrote a bundle configuration or issued a network request. The source guard blocks the legacy embedded-credential bootstrap. No existing isolated synthetic HTTPS destination with a verified runtime-auth contract was established in this preflight.

The smallest next native qualification is a separately identified Development build that uses the existing player, an approved isolated synthetic HTTPS destination with a valid certificate chain, and runtime-only scoped authentication. Use a recognized simulator for synthetic playback first if one becomes available. Check a physical device separately only within its authorized scope. Keep the installed Product pilot intact. No iOS build, installation, launch, origin change, trust change, live media, or provider activation occurred here.

## Local source-to-player qualification

`gbi` was stopped, and the exact `colima-gbi` context had no Docker socket. No other database was substituted. Catalog, privileges, RLS and durable audit persistence were not tested.

The disconnected fixture joins the canonical Event and Evidence, anchors the first synthetic archive segment by byte digest, verifies the Ed25519 source/clock receipt against that exact link and requested range, and invokes the existing acknowledged audit writer through an in-memory storage substitute. Only an acknowledged write allows the fixture to issue a bounded playback token. The fixture enforces one receipt per operation and checks expiry, current scope and revocation on media requests. The local registrar, acknowledgment and token lease are synthetic and have no production or public caller.

On the isolated Chrome loopback page, the existing `ObserverLivePlayer` showed a five-second synthetic HLS clip. Presented frames advanced 122→125 at 1.042→1.167 seconds, 320×180. The server recorded one claim, one audit acknowledgment, one playlist response and six segment requests, including the seek. After revocation a new request to the same media URL returned 403. The tab and listener were closed, and generated media and the browser bundle were removed. No live recorder, real device, hosted service or SQL was used.

Run `node --test scripts/qa/check-source-recording-flow.mjs` for the end-to-end contract cases. These cover cross-Tenant/Site/source/actor denial, missing Event, expired session and receipt, mismatched archive anchor despite matching time, one-time receipt, failed audit and revocation.

Before a Stage 3 archive API or permission can be exposed, verify the canonical schema and grants in an isolated Development database, qualify a trusted recorder link and durable single-use registrar, and prove acknowledged audit and range-limited authorized transport. Exercise negative Site/source authorization, expiry and revocation on that actual runtime. Real DVR retrieval remains unverified.

## Service-account route qualification

The existing signed SDK was exercised against the actual v1 route and authorization services with an in-memory PostgREST/application-boundary fixture. The flow checks expiry and revocation on each request. Invalid expiry also denies access. Partner delegation now checks the account's current partner organization, the mapping's partner/customer identity, the active sandbox customer, the exact linked Site and the Site's current customer organization. The authorization and subsequent rate-limit gate independently enforce the current organization. A stale link after Site reassignment cannot authorize reads.

The signed SDK's camera filter narrows the results inside an already authorized Site. It does not grant or revoke access to an individual camera. Existing Evidence metadata has its own permission. The route accepts only the exact Evidence metadata and media route shapes. Extra path segments and unknown archive paths return 404. No archive endpoint, source entitlement or media signer was added or opened.

`node --test scripts/qa/check-external-service-account-route.mjs` covers the real handler, signed SDK, synthetic persistence, revoked/expired/invalid-expiry credentials and accounts, direct and delegated Tenant/Site denials, stale mapping, camera filtration, independent Evidence scope and rejected archive paths. Production or hosted authorization, deployed RLS, real partner enrollment and archive retrieval remain unverified.
