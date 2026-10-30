# DIGITAL OBSERVER — ZERO-INSTALL-FIRST REQUIREMENTS

Date: 2026-10-18
Current status: FOUNDATION; zero verified Direct/Zero-Install reference systems

## Mandatory product principle

Consumer and small-business onboarding must default to the least intrusive secure path. A customer must not be required to buy or operate a dedicated Digital Observer computer or Gateway when a compatible secure remote connection exists. LAN discovery alone is not Cloud reachability, and arbitrary LAN-only RTSP must never be presented as directly reachable from the Cloud.

## Canonical connection profiles

### Profile A — Direct / Zero-Install

Default for compatible systems. Permitted transports include an authorized vendor Cloud API, supported vendor P2P/relay SDK, manufacturer integration, or another secure persistent remote path. Requirements: scoped enrollment, explicit authorization, TLS, revocation, reconnection, bounded credentials, health truth, no public plaintext RTSP and no permanent phone dependency.

### Profile B — Software Connector

Exception using customer-owned existing compute. It must be outbound-only by default, signed, self-updating, least-privilege, removable, health-monitored and explicit about host availability. The existing real Tapo reference proves one Connector path, not zero-install.

### Profile C — Managed Edge

For enterprise, legacy DVR/NVR/VMS, offline/local processing or specialized connectivity. It includes Physical Gateway and future Enterprise Edge. It must support managed identity, OTA/rollback, self-healing, offline/resync, local privacy policy and remote fleet health. The existing DVR pilot proves a bounded Managed Edge path, not Profile A.

## Resolver order

1. Determine exact camera/system identity and capabilities without exposing secrets.
2. Evaluate lawful and vendor-supported Profile A paths.
3. If no secure persistent direct path exists, evaluate Profile B using existing customer compute.
4. Use Profile C only when local processing, legacy transport, offline needs or enterprise policy require it.
5. Fail closed as Unsupported / Integration Missing when no safe path exists.
6. Record recommendation, rejected alternatives, user authorization, test result, activation result and ongoing health.

## Compatibility truth

| Path | Current implementation | Real proof | Required closure |
|---|---|---|---|
| RTSP | Local adapter/reference | Real Tapo through Connector | Secure remote architecture or bridge; never infer Cloud reachability |
| ONVIF | Discovery/profile foundation | No qualifying remote proof | Real discovery plus secure persistent transport and capability conformance |
| IP camera | Canonical source model | One Tapo local path | Multi-vendor direct/connector matrix |
| DVR | Managed Edge implementation | Ten populated real channels | Independent DVR families and long-duration proof |
| NVR | Contract/foundation | None | Authorized real NVR pilot and recording retrieval |
| VMS | Integration architecture only | None | External business pilot without replacing the VMS |
| Vendor Cloud API | Registry/planner only | None | Authorized executable adapter and account-link lifecycle |
| Vendor P2P | Not implemented | None | Legitimate SDK/API agreement; no undocumented exploitation |
| Manufacturer integration | Not implemented as supported product | None | Partner contract, conformance and support responsibility |
| Recording-system integration | Source-reference contract only | No retrieval adapter | Real source-recording search/playback with policy mapping |

## Non-technical onboarding acceptance flow

Account → Site → camera/system discovery → compatibility assessment → connection recommendation → authorization → bounded test → activation → monitoring → support.

The customer-facing flow must explain what is required, why, expected privacy/cost/support impact and how to recover. Technical transport terms may appear in diagnostics but must not be prerequisites for ordinary customers.

## Required Profile A real proof

PUSH 46 is the proof owner. A qualifying result must include:

- no Digital Observer computer or Gateway at the customer site;
- secure enrollment and revocation;
- remote video or metadata ingestion;
- AI processing through the canonical Event pipeline;
- authorized remote playback;
- Investigation access where supported;
- disconnect/reconnect and credential recovery;
- truthful camera/product health;
- measured bandwidth, inference, storage, database and support costs;
- legal/privacy approval for the exact site and transport.

The proof must run for the agreed external-pilot period and must not reuse a Managed Edge soak as zero-install evidence.

## Ownership

Implementation owner for vendor/account connectivity is PUSH 42; onboarding/product selection remains governed by the existing PUSH 17 contracts. PUSH 45 owns external legal/privacy decisions. PUSH 46 owns the external home proof, PUSH 47 the business/VMS proof and PUSH 49 the cost/economics closure.
