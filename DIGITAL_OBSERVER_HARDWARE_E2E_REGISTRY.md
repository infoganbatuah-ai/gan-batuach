# DIGITAL OBSERVER HARDWARE E2E REGISTRY

Date: 2026-09-06
Purpose: prevent deterministic CI from claiming proofs that require physical hardware, real media, or bounded Production verification.

## EXECUTION RULE

Hardware E2E and Production smoke tests are never mandatory normal PR CI. They must record the physical source, environment, provenance, evidence report, date and safe teardown/rollback state. Mock, replay, uploaded or manually seeded data cannot satisfy a real-hardware PASS.

## REGISTRY

| Proof | Tier | Required hardware/environment | Safe execution condition | Latest known status | Evidence |
|---|---|---|---|---|---|
| Real DVR person detection | Tier 3 + Tier 4 smoke | Private DVR, Physical Gateway, channel 11, ONNX, Production backend | Read-only source; no credential/session ownership change | PASS | `DIGITAL_OBSERVER_PUSH_3_REAL_CAMERA_E2E_REPORT.md`; `DIGITAL_OBSERVER_PUSH_4_REAL_AI_PRODUCT_OBSERVER_REPORT.md` |
| Real tracking and directional entry/exit | Tier 3 | Same camera, controlled person pass, stable Journal ownership | Existing thresholds and line geometry; no manual Event | PASS for proven entry/exit path; future regressions require a fresh physical pass | `DIGITAL_OBSERVER_PUSH_5_REAL_TRACKING_ZONES_REPORT.md`; `DIGITAL_OBSERVER_PUSH_5B_REAL_EXIT_VERIFICATION_REPORT.md`; `DIGITAL_OBSERVER_PUSH_9D_ENTRY_GEOMETRY_ROOT_CAUSE_REPORT.md` |
| Real Evidence capture, persistence and playback | Tier 3 + Tier 4 smoke | Evidence-enabled real Event, Gateway capture, private Storage, authorized browser | Recording grant and retention policy active; no public media URL | PASS | `DIGITAL_OBSERVER_PUSH_7_EVIDENCE_PRODUCTION_REPORT.md`; `DIGITAL_OBSERVER_PUSH_7B1_MEDIA_CLOSURE_REPORT.md` |
| Real Incident → Risk → Verification → Decision | Tier 3 + Tier 4 smoke | Fresh real camera Event and authorized Production UI/API | No temporary risk weights, thresholds or manual Event | PASS | `DIGITAL_OBSERVER_PUSH_9_RISK_DECISION_ENGINE_REPORT.md`; `DIGITAL_OBSERVER_PUSH_10_INCIDENT_VERIFICATION_REPORT.md` |
| Natural-language Rule match on real Event | Tier 4 smoke | Authorized Production rule and naturally occurring real Event | Explicit preview/confirmation; no external action provider | PASS | `DIGITAL_OBSERVER_PUSH_12_NATURAL_LANGUAGE_RULE_COMPILER_REPORT.md` |
| Investigation result with real Evidence playback | Tier 4 smoke | Authorized Production history and unexpired signed Evidence | Tenant/media authorization enforced | PASS | `DIGITAL_OBSERVER_PUSH_13_NL_VIDEO_INVESTIGATION_REPORT.md` |
| Real Software Connector E2E | Tier 3 | Independent RTSP/ONVIF camera or separate DVR/source; isolated Software Connector identity | Must not open a second unsafe home-DVR session or duplicate customer monitoring | BLOCKED — independent real source required | `DIGITAL_OBSERVER_PUSH_16B_REAL_CONNECTOR_E2E_REPORT.md` |
| Real ONVIF discovery/device validation | Tier 3 | Independent ONVIF device on safe test network | Device credentials and discovery isolated from home Gateway | NOT VERIFIED | `DIGITAL_OBSERVER_PUSH_14_DIGITAL_FIRST_CAMERA_LAYER_REPORT.md` |
| Second-source RTSP onboarding | Tier 3 | Independent RTSP source | No production source ownership collision | PENDING | `DIGITAL_OBSERVER_PUSH_15_ZERO_TOUCH_ONBOARDING_REPORT.md` |
| Physical Gateway fleet OTA/rollback | Tier 3 | Non-home test Gateway, signed artifact, rollback target | Never first test on active home Gateway | NOT IMPLEMENTED / FUTURE | No PASS report yet |
| Enterprise Edge runtime | Tier 3 | Dedicated supported edge host and isolated sources | Resource/security benchmark and rollback available | NOT IMPLEMENTED / FUTURE | No PASS report yet |
| Multi-site pilot/scale E2E | Tier 3 + Tier 4 | Multiple independent sites/sources and authorized pilot users | Capacity, privacy and tenant-boundary plan approved | NOT EXECUTED | No PASS report yet |

## PUSH 16 PRESERVATION

PUSH 16 remains `OPEN / BLOCKED — independent real RTSP/ONVIF camera required`. PUSH 24 does not alter this status, does not open a DVR session and does not modify Camera/Connector/Gateway runtime behavior.

## EVIDENCE MINIMUM

Every future registry update must include:

- physical device/source class and isolated environment;
- canonical source/device identity without credentials;
- real provenance and timestamp;
- automated Event/observation path where required;
- customer-impact and duplicate-monitoring checks;
- teardown/rollback outcome;
- linked immutable report or CI artifact.
