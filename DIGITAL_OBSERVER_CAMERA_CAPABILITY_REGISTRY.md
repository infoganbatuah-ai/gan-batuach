# Camera Capability Registry — PUSH 17

Status: implemented foundation, not a universal compatibility claim. Version: `connectivity-registry-v1`.

## Schema and ownership

Canonical implementation: `lib/domain/digital-observer/connectivity-registry.ts`. A family has a bounded ID, vendor, model, customer label, authentication category, limitations, and capability records. Each capability includes kind, evidence, reference, adapter implementation flag, verification date and firmware scope. Product code reads this registry rather than maintaining vendor conditionals across screens.

## Provenance

| State | Meaning |
|---|---|
| VERIFIED_REAL | Specific physical-device/protocol evidence exists; not all firmware or vendor models |
| VERIFIED_VENDOR_DOCUMENTATION | Vendor documents the capability; our adapter is not necessarily implemented |
| INTEGRATION_TESTED | Controlled integration evidence, not physical verification |
| INFERRED | Hypothesis only; cannot authorize connection |
| UNKNOWN | No verified capability claim |

## Current references

| Family | Evidence | Boundary |
|---|---|---|
| Tapo C211 | PUSH 16C real RTSP → separate Software Connector → ONNX → Product | Existing local path verified; no supported persistent zero-install integration verified |
| Tapo ONVIF | [Tapo third-party access documentation](https://www.tapo.com/us/faq/34/) | Service discovery is not authenticated ONVIF profiles/stream-URI QA; no new real ONVIF PASS |
| Generic RTSP / ONVIF | Existing canonical adapter and deterministic QA | Protocol candidate, not a connected camera |
| Existing private DVR | PUSH 16C/home runtime reference | Ten progressing relays; vendor/model remote capability still unknown; hardware technical necessity not proven |
| Nest indoor wired reference | [Google SDM camera documentation](https://developers.google.com/nest/device-access/api/camera-wired) | Documentation-only capability; Digital Observer adapter/account linking absent. Integration missing, not hardware required |

Unknown families go through identification or already-authorized discovery. No intrusive network scan is added. The generic recorder entry deliberately does not infer a physical-Gateway requirement.

## Version / firmware / freshness

Registry version is included in plans, new source onboarding metadata and connectivity observations. Current firmware scope is UNKNOWN, not a wildcard real-device PASS. Capabilities older than 90 days need revalidation; the interval is internal freshness policy, not vendor warranty. Historical records retain their version. Future schema versions need an explicit reader/migration; current aggregation accepts v1 records only.

## Learning promotion and security

Twenty eligible samples only produce CANDIDATE_KNOWLEDGE, never automatic approval. Reviewer validation and a versioned registry release are required; a promotion workflow is not yet shipped. Server adapter proof—not registry metadata or customer JSON—must establish authorization, transport safety, recoverability and persistence. Ranking cannot disable authentication, expose ports, weaken TLS or share credentials across sites.
