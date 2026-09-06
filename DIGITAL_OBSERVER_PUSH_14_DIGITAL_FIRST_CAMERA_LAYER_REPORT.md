# DIGITAL OBSERVER — PUSH 14

# DIGITAL-FIRST UNIVERSAL CAMERA CONNECTION HARDENING

Date: 2026-09-06  
Production origin: `https://ganbatuach.com`  
Production revision: `c62898d335345027810f07e7b90eb8e7d13eea69`  
Production deployment: `dpl_AWbzff7kQVx96ngnDgRk2n8E6xzD`

## FINAL STATUS

`PASS`

Digital Observer now has one canonical, vendor-agnostic camera-source contract, a bounded adapter catalogue, normalized capabilities and health, and an explainable Digital-First connection resolver. The working private home DVR/Gateway path was preserved and represented as the first Production-verified adapter rather than rebuilt.

The real home source was assessed and persisted in Production as:

- Recommendation: `PHYSICAL_GATEWAY_REQUIRED`
- Preferred method: `PHYSICAL_GATEWAY`
- Adapter: `private_dvr_gateway@1.0.0`
- Production eligible: `true`
- Reasons: `LEGACY_RECORDER_REQUIRES_LOCAL_BRIDGE`, `OUTBOUND_AUTHENTICATED_GATEWAY_AVAILABLE`
- Automatic fallback: disabled

This is a justified exception for the current private/legacy DVR. The resolver does not make physical hardware the default for new systems.

## EXISTING CAMERA SYSTEM INVENTORY

| System/path | Classification | Real data | Decision |
|---|---|---:|---|
| Private DVR → persistent Video Gateway → HLS/ONNX | PRODUCTION VERIFIED | Yes | Keep as reference adapter |
| Generic Video Gateway | REAL-DATA CAPABLE | Yes | Keep behind canonical source contract |
| RTSP ingest through Gateway | REAL-DATA CAPABLE | Yes | Keep; second physical-source QA pending |
| ONVIF discovery/profile/URI extraction | EXISTS — NEEDS REAL DEVICE QA | No verified second device | Keep as bounded adapter |
| Cloud discovery/device enrollment | REAL-DATA CAPABLE foundation | Yes for the current Gateway | Keep as authenticated control plane |
| Vendor Cloud/API | ADAPTER FOUNDATION READY | No real vendor verified | Keep as preferred future digital method |
| Direct Secure | CONTRACT ONLY | Not yet verified | Keep unavailable until secure reachability is proven |
| Software Connector | CONTRACT ONLY | Not deployed in this PUSH | Preferred before physical hardware for LAN RTSP/ONVIF |
| Enterprise Edge | CONTRACT ONLY | Not implemented | Explicit enterprise requirement only |
| Demo | MOCK | No | Explicit test/demo only; never Production truth |

Existing source, readiness, discovery, credential-reference, health, stream, reconnect and device-enrollment records were reused. No parallel camera database was introduced.

## CANONICAL CAMERA SOURCE MODEL

The `camera-source-v1` internal contract includes:

- source, tenant and site identity
- camera stream and recorder channel
- display name, vendor and system type
- canonical connection method and protocol
- adapter type/version and configuration version
- standardized capabilities
- boolean credential/endpoint-reference presence, never secret values
- normalized health state, reason, checked/last-seen times and latency
- normalized stream lifecycle, last successful frame, reconnect count and fallback state

Existing `digital_observer_camera_sources` storage is reused. Canonical fields are persisted in its supported columns and versioned metadata, avoiding an unnecessary schema migration.

## ADAPTER CONTRACT

The canonical `CameraConnectionAdapter` interface owns:

- `discover()`
- `assess()`
- `connect()`
- `getStream()`
- `getHealth()`
- `getNativeEvents()`
- `disconnect()`

Observer Core receives canonical source, Event and stream contracts. Adding a vendor no longer requires vendor-specific conditionals in Events, Incidents, Risk, Verification, Watch Rules or Investigation.

Adapter and resolver versions are persisted for auditability:

- Source contract: `camera-source-v1`
- Resolver: `digital-first-resolver-v1`
- Configuration version: `1`

## CAPABILITY MODEL

Bounded canonical capabilities are:

- `LIVE_STREAM`
- `CAMERA_DISCOVERY`
- `CHANNEL_DISCOVERY`
- `NATIVE_MOTION_EVENTS`
- `NATIVE_PERSON_EVENTS`
- `LINE_CROSSING_EVENTS`
- `PTZ`
- `RECORDING_ACCESS`
- `HEALTH`
- `REMOTE_CONFIGURATION`

Capabilities are adapter-observed, not vendor marketing claims. The home adapter currently reports `LIVE_STREAM`, `CHANNEL_DISCOVERY`, `RECORDING_ACCESS` and `HEALTH`.

## REAL HOME DVR ADAPTER

Verified Production source:

- Site: `cc1673b8-3eb0-4785-a12c-1fb88f425a41`
- Camera/source: `e9f8abf3-5895-494e-b1cf-ea8818602851`
- DVR channel: `11`
- Stream: stored server/device-side and not returned by the assessment API
- Gateway: `62df97e2-3c0b-427f-9108-bde029bc10e7`

The adapter assessment was executed through the authenticated Production API and persisted normally. The response contained only safe capability and reference-presence metadata; no credential reference, source URL, RTSP URL or private stream identifier was returned.

## RTSP STATUS

Classification: `REAL_DATA_CAPABLE`.

The existing Gateway RTSP path remains available with server/device-side credentials, bounded timeouts, TCP-oriented recorder handling, codec/frame probes, freshness checks, reconnect handling and normalized errors. Internet-exposed plaintext RTSP is rejected by the resolver. A secure direct RTSP path requires explicit reachability and transport evidence.

No second physical RTSP source was available in this PUSH. It is therefore not promoted to `PRODUCTION_VERIFIED` as a universal adapter.

## ONVIF STATUS

Classification: `EXISTS_NEEDS_REAL_DEVICE_QA`.

Existing ONVIF discovery, authentication, profile and stream-URI foundations were retained. Direct ONVIF is eligible only when secure transport and reachability are explicitly established. LAN-only ONVIF recommends the outbound Software Connector before physical hardware.

No physical ONVIF device was available; contract and security QA passed, while real-device validation remains pending.

## VENDOR CLOUD/API STATUS

Classification: `FOUNDATION_READY`.

The adapter/resolver foundation can represent an authorized TLS vendor API and gives it first preference. No unsupported vendor claim was added and no vendor credentials were introduced. A vendor Cloud/API adapter remains ineligible until a real provider implementation proves authorization, capabilities and health.

## CONNECTION ASSESSMENT

The new authenticated assessment API evaluates safe facts only:

- provider/system type
- available protocols
- remote versus LAN reachability
- secure transport
- outbound-only connectivity
- native capabilities
- credential/endpoint reference presence
- local-processing/privacy constraints
- software/Gateway/enterprise availability

New assessments cannot contain passwords, secret fields, credentialed URLs or raw source URLs. Existing-source assessments are site scoped. Read-only assessment follows normal site access; persistence requires manage access or the existing scoped Digital Observer Admin claim.

## DIGITAL-FIRST RESOLVER

The deterministic priority is:

1. authorized TLS Vendor Cloud/API
2. secure outbound direct connection
3. securely reachable RTSP/ONVIF
4. outbound Software Connector for LAN protocols
5. authenticated outbound Physical Gateway when legacy/private/local-policy constraints justify it
6. Enterprise Edge only for an explicit enterprise requirement

Every result includes recommendation, preferred method, alternatives, reason codes, missing requirements, security notes, capabilities and transport/cost characteristics.

## GATEWAY EXCEPTION LOGIC

`PHYSICAL_GATEWAY` cannot be selected only because it is convenient. Selection requires a legacy recorder, LAN-only reachability, a local-processing/privacy requirement or another explicit local constraint, plus an enrolled outbound-only Gateway for Production eligibility.

The current home DVR satisfies that exception. A generic new recorder without proven constraints is directed toward a Software Connector assessment rather than assumed hardware.

## CREDENTIAL SECURITY

- Credentials remain in Keychain/server/device-side references.
- Browser/API responses expose only boolean reference presence.
- Raw camera/DVR/RTSP credentials and endpoint references are excluded.
- Assessment payloads reject secret-shaped fields and credentialed URLs.
- Site and source queries are tenant/site scoped.
- Digital Observer Admin access uses the existing app-metadata claim and remains scoped to Observer data; media and secret access are not granted by this route.
- No insecure fallback is automatic.

## HEALTH / LIFECYCLE

Normalized health states:

`HEALTHY`, `DEGRADED`, `AUTH_FAILED`, `OFFLINE`, `NO_FRAMES`, `HIGH_LATENCY`, `UNSTABLE`, `UNSUPPORTED`, `CONFIG_REQUIRED`.

Normalized lifecycle:

`DISCOVERED → CONFIGURED → CONNECTING → STREAMING → DEGRADED → RECONNECTING → OFFLINE`.

The product can now render these states without vendor-specific logic. Current degraded/offline sources remain visible as such rather than being described as monitored.

## FALLBACK

Fallback is bounded and auditable:

- `automaticFallbackEnabled = false`
- every alternative records eligibility and reason
- plaintext or otherwise weaker transport is never selected silently
- primary/fallback method fields exist in the canonical stream state
- operator/configuration approval is required before changing methods

Controlled QA proved Vendor API failure can lead to a Software Connector/Gateway recommendation without an insecure automatic downgrade.

## DISCOVERY / DEDUPE

Discovery identity includes tenant, site, adapter and stable device/channel evidence. Exact stable device + channel identity may be proposed for automatic reuse. Ambiguous model/name similarity requires review and is not merged automatically.

Repeated ONVIF/RTSP discovery therefore avoids obvious duplicates without incorrectly merging unrelated cameras. Cross-tenant identity keys remain distinct.

## SECURITY ASSESSMENT

The assessment reports warnings and missing requirements for:

- plaintext Internet-exposed RTSP
- missing TLS
- missing vendor authorization
- LAN-only reachability without an outbound connector
- unsupported protocols
- unprovisioned enterprise/local requirements

No port forwarding is created, no browser receives camera credentials, and no unsupported system is presented as connected.

## OUTBOUND-FIRST NETWORKING

The current persistent home Gateway initiates authenticated operations outward to the cloud control plane. The cloud does not require inbound DVR exposure and does not receive raw DVR credentials. The new resolver records this as `OUTBOUND_AUTHENTICATED_GATEWAY_AVAILABLE`.

Software Connector readiness is modeled with the same outbound-only requirement. Inbound port exposure is not an accepted fallback.

## CONNECTION UX

The existing Add Camera/System flow now:

1. identifies the installed system and safe pairing method
2. calls the bounded assessment API before advancing
3. displays the recommended method, adapter, reasons and missing requirements
4. states that existing customer hardware is attempted first
5. explains when a Software Connector or physical Gateway is actually required
6. blocks activation when no safe assessment exists

Existing camera/dashboard pages expose canonical method, adapter and normalized health instead of assuming every source is a Gateway source.

The authorized browser session rendered the Production Digital Observer camera inventory, including channel 11. During navigation to the updated camera page the local browser-automation bridge lost its Chrome accessibility window. This was treated as a tooling failure, not as product proof. The same UI pages compiled in the final Production build, and their backing authenticated Production API passed.

## OBSERVABILITY

Canonical source state now exposes:

- adapter and version
- selected connection method
- health and reason
- checked/last-seen timestamps
- last successful frame
- latency
- reconnect count
- fallback state
- transport mode and estimated bandwidth mode
- native-event support

The home Gateway health probe reported the object detector ready, model loaded, self-test passed and startup phase `ready`. Continuous relay monitoring reported all 10 expected live channels progressing.

## OBSERVER CORE INDEPENDENCE

Static QA examined Incident correlation, Risk/Decision, Verification, Watch Rules and Investigation. No private-DVR/manufacturer/channel-specific logic was found in those downstream contracts.

The pipeline remains:

`Canonical Camera Source → canonical stream/anchor → Event → Incident → Risk/Verification/Rules/Search`.

Private DVR details terminate at the adapter/Gateway boundary.

## REAL HOME REGRESSION

Production verification passed after deployment:

- Production health: HTTP 200
- Source assessment: HTTP 200, authenticated and persisted
- Channel 11 relay: connected and progressing
- ONNX capability: ready, model loaded, self-test passed
- Journal: a diagnostic probe briefly competed for the single warm inference session and observed `journal_http_503`; the following normal cycle recovered without restart
- Recovered channel 11 state: `sampled`
- Outbox delivery failures: `0`
- Latest canonical real Incident: `bdf84923-cc3b-4f31-a8ea-57de8b9edcb5`
- Related real Event: `7b7d90ce-cf49-4a57-9a67-953c0f25240c`
- Provenance: `REAL_CAMERA_AI`
- Mock/manual Event used: no

No new physical person pass was required. The verification used the live Gateway/ONNX health and Journal plus an existing persisted real Production Incident through the authenticated product path.

## SECOND CONNECTION METHOD STATUS

RTSP is the second method verified at contract/integration and real-data-capable Gateway level. Security, lifecycle, health, resolver and failure contracts passed. There was no independent second physical RTSP/ONVIF device, so real-device universal-adapter validation remains explicitly pending.

This does not block PUSH 14 because no physical validation was fabricated and the current home Production path remained intact.

## TEST MATRIX

| Test | Result |
|---|---|
| Camera connection layer focused QA | PASS — 15/15 |
| Home DVR → canonical adapter | PASS |
| Adapter capability/status honesty | PASS |
| Vendor Cloud and Direct Secure priority | PASS |
| Software Connector before hardware for LAN RTSP/ONVIF | PASS |
| Gateway justification guard | PASS |
| Plaintext Internet RTSP rejection | PASS |
| Direct ONVIF secure-transport guard | PASS |
| Credential/reference client projection | PASS |
| Tenant-scoped discovery/dedupe | PASS |
| Normalized health/failure states | PASS |
| Observer Core vendor-independence scan | PASS |
| Digital Observer Product QA | PASS — 68/68 |
| Camera Gateway contract | PASS — 3/3 |
| Shared DVR session/reconnect QA | PASS |
| Journal/Event/Outbox/Ingest QA | PASS |
| Real detection → Event bridge QA | PASS |
| Product Observer provenance/mock isolation | PASS |
| Incident, Evidence, Risk, Verification QA | PASS |
| Feedback, Watch Rule, Investigation QA | PASS |
| Investigation QA | PASS — 10/10 |
| Tenant boundary QA | PASS — 15/15 |
| Environment safety QA | PASS |
| Focused lint | PASS |
| Local typecheck before release | PASS |
| Final Production TypeScript/build | PASS — 486 routes/pages generated |
| Production release preflight | PASS — clean snapshot, rollback revision, no secret-shaped value |
| Authenticated Production camera assessment | PASS |
| Live Gateway/ONNX/channel 11 regression | PASS |

Final Production deployment:

- ID: `dpl_AWbzff7kQVx96ngnDgRk2n8E6xzD`
- State: `READY`
- Revision: `c62898d335345027810f07e7b90eb8e7d13eea69`
- Aliases verified: `ganbatuach.com`, `gan-batuach.vercel.app`

## PUSH 15 READINESS

The canonical connection layer, real home reference adapter, assessment API, explainable resolver, security guards and onboarding presentation are now in place. PUSH 15 can focus on zero-touch discovery/onboarding UX without changing Observer Core or treating hardware as the default.

Remaining honest validation item: obtain a separate physical RTSP or ONVIF device for adapter-specific real-device QA. This is not represented as completed.

ARE WE READY FOR PUSH 15 — ZERO-TOUCH CAMERA ONBOARDING + CONNECTION RECOMMENDATION UX?

YES
