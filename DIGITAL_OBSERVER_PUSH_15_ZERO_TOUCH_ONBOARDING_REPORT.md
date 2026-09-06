# DIGITAL OBSERVER — PUSH 15

## FINAL STATUS

PASS

## PRODUCTION RELEASE

- Production revision: `ce860281f11807dd8f5f6a97a95f7aca1ca78373`
- Production deployment: `dpl_3Sp77MfUr1omE5cVmGXBMDSoGzQG`
- Canonical hostname: `https://ganbatuach.com`
- Release preflight, typecheck, focused lint, build, environment safety, shared-DVR-session QA, product QA, camera-connection QA, and onboarding QA passed.

## CURRENT ONBOARDING INVENTORY

The existing camera-source, connection-assessment, Gateway enrollment, discovery, readiness, and health foundations remain the source of truth. PUSH 15 adds a bounded customer-facing onboarding layer rather than a second camera system.

## CANONICAL ONBOARDING STATE MACHINE

`START → SYSTEM_IDENTIFICATION → ASSESSING → CREDENTIALS_REQUIRED/DISCOVERY → CONNECTION_RECOMMENDED → TESTING → CAMERA_MAPPING → READY_TO_ACTIVATE → ACTIVE`.

The flow also supports truthful `DEGRADED`, `ACTION_REQUIRED`, and `UNSUPPORTED` states. State transitions are validated, resumable, and persisted without retaining raw credentials in the draft.

## SYSTEM IDENTIFICATION / “I DON'T KNOW”

The flow supports vendor/system selection, DVR/NVR and IP-camera paths, and an explicit “I don't know which system I have” path. It guides the user to safe identification or support handoff rather than requiring RTSP, ONVIF, codec, or relay knowledge.

## ASSESSMENT / RECOMMENDATION

The customer-facing recommendation uses the canonical Digital-First resolver and explains its reason in plain language. It can truthfully recommend direct connection, a future Software Connector handoff, a Physical Gateway, or unsupported/manual integration.

For the real home pilot, the verified result is:

- Recommendation: `PHYSICAL_GATEWAY_REQUIRED`
- Adapter: `private_dvr_gateway` v`1.0.0`
- Reason: legacy recorder requires a local bridge; an outbound authenticated Gateway is available.
- Automatic insecure fallback: disabled.

Physical Gateway is therefore an explicit exception for this local legacy DVR, not the default onboarding choice.

## CREDENTIAL SECURITY

Credential collection is adapter-specific and server-side only. Onboarding payload validation rejects raw credential/secret shapes; onboarding drafts store only safe state, mappings, and bounded audit metadata. Production verification confirmed `secrets_exposed: false`.

## DISCOVERY / MAPPING

Discovery records safe camera/channel metadata and capabilities, remains idempotent, and presents duplicate candidates rather than silently creating duplicate physical sources. Mapping supports customer-friendly names, site assignment, area labels, and ignored channels without exposing database identifiers or stream credentials.

## ACTIVATION TRUTH

`ACTIVE` requires an existing runtime source that is connected/active, healthy, in a live/testable mode, and recently seen. Discovery or an assessment alone cannot claim active monitoring. Failed or incomplete tests remain `ACTION_REQUIRED`, `DEGRADED`, or `UNSUPPORTED` as appropriate.

## RESUME / RECOVERY

Safe onboarding progress and a bounded audit trail are stored in the existing onboarding-draft metadata. The user may resume without re-entering non-sensitive choices; invalid raw secrets are never retained in browser or draft state. A safe diagnostic reference can be used for support without credentials.

## AUTHORIZATION / TENANT BOUNDARY

Normal users remain restricted to their authorized site. Digital Observer product administrators can use the onboarding route for an eligible Digital Observer site only; that path is explicitly limited to non-kindergarten sites with no garden binding and has no media, credential, or cross-tenant discovery privilege. This matches the existing connection-assessment authorization model.

## REAL HOME PILOT REGRESSION

Authenticated Production verification completed against the established home pilot source:

- Onboarding contract: `camera-onboarding-v1`
- Reassessment: non-destructive
- Source recommendation: `PHYSICAL_GATEWAY_REQUIRED`
- Mock used: no
- Manual event used: no
- Secrets exposed: no

The canonical connection regression also verified a recent `REAL_CAMERA_AI` incident through the existing real source. No re-enrollment or interruption of the monitored home source was required.

## RTSP / ONVIF / CONNECTOR STATUS

- RTSP: existing capability/contract path remains available; independent real-source onboarding is pending.
- ONVIF: onboarding contract is represented truthfully; real-device validation remains pending.
- Software Connector: the appropriate recommendation and handoff are implemented; full deployment belongs to PUSH 16.
- Vendor cloud/API: the Digital-First adapter foundation is represented; no unsupported vendor is claimed as production verified.

## MOBILE / ACCESSIBILITY

The flow uses explicit labels, safe loading/disabled states, bounded error categories, and no accidental duplicate activation. The onboarding contract includes a basic mobile-width QA check; this PUSH does not redesign the product UI.

## TEST MATRIX

| Check | Result |
| --- | --- |
| Onboarding lifecycle and safe transitions | PASS (7/7 onboarding QA) |
| Digital-First recommendation and Gateway exception | PASS |
| Existing home source non-destructive reassessment | PASS in Production |
| Credential redaction / tenant scope | PASS |
| Camera connection layer | PASS (15/15) |
| Environment and Gateway safety | PASS |
| Product regression | PASS (68/68) |
| Typecheck, focused lint, production build | PASS |
| Production deployment | PASS |

## PUSH 16 READINESS

The onboarding flow can now hand off truthful `SOFTWARE_CONNECTOR_REQUIRED` recommendations. The next scoped work is Software Connector deployment and real second-source validation; no such deployment was started in PUSH 15.

ARE WE READY FOR PUSH 16 — SOFTWARE CONNECTOR DEPLOYMENT?

YES
