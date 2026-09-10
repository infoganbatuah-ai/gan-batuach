# Connection strategy matrix — ZERO-INSTALL FIRST

PUSH 17D status: hierarchy is executable across normal Product routes. macOS Connector is locally graphically verified; Windows package is implemented with real-host validation pending; mobile contracts are implemented with real-device validation pending. Current real reference counts remain zero-install 0, mobile-assisted 0, Software Connector 1 and Physical Gateway 1.

## PUSH 17C — governing strategy matrix

| Strategy | Technical capability | Current DO coverage | Persistent without phone | Customer computer required | DO hardware required | Customer effort | Priority | Evidence |
|---|---|---|---|---|---|---|---|---|
| Vendor Cloud/API | Vendor-specific; Nest documented | No executable adapter here | Must verify | No | No | Consent/selection, not measured | 1 | Vendor docs, not real DO proof |
| Account Linking | OAuth where supported | Registry/foundation | Depends on persistent adapter | No | No | Vendor authorization | 1 | Nest docs |
| Vendor P2P | Partner API/SDK authorization required | Not verified | Unknown for references | Not assumed | Not assumed | Not measured | 1 if proved | Tapo ecosystem docs do not prove C211 video |
| Direct Secure | Secure remote endpoint required | Planner contract | Hard gate | No | No | Authorize/confirm | 1 | Controlled contract QA |
| Mobile-Assisted | Temporary setup only | Receipt/permission contract | Separate proof required | No | No | OS permission/consent | 2 | No native real-device verification |
| Generic ONVIF | Local discovery/profiles | Adapter foundation | LAN visibility insufficient | Only for needed bridge | Not inherently | Hidden protocol, camera account | Before bridge only with secure persistence | Vendor/contract evidence |
| Generic RTSP | Local stream access | Real local Tapo path | LAN visibility insufficient | Only for needed bridge | Not inherently | Hidden URL, camera account | Before bridge only with secure persistence | Tapo real stream evidence |
| Software Connector | Verified local bridge | Real Tapo core; macOS commercial package locally verified; Windows package implemented | Host must stay available | Yes for this exception | No dedicated DO hardware | Graphical installer/consent; total funnel unmeasured | 3 | PUSH 16C real; PUSH 17D graphical macOS QA |
| Physical Gateway | Local appliance | Real DVR path | Appliance must stay available | No separate customer computer | Appliance for selected path | Setup, unmeasured | 4 last resort | Ten real progressing DVR channels |
| Enterprise Edge | Explicit policy/design | Future canonical work | Deployment dependent | Not assumed | Policy dependent | Not measured | Policy exception | Not implemented |
| Integration Missing | May be documented | Adapter absent | Not established by DO | Not inferred | Not inferred | Explain/revalidate | No forced hardware downgrade | Nest; Tapo requires further scope evidence |
| Unknown/Unsupported | Insufficient evidence | Identification/generic candidates | Not established | Not inferred | Not inferred | Identify/retry | No false activation | Bounded unsupported handling |

## PUSH 17B — capability, coverage and effort are separate

No row is a blanket vendor support claim. Security/persistence proof precedes priority.

| Strategy | Customer software required | Hardware required | Mobile-only onboarding possible | Persistent after phone leaves | Customer effort | Current DO coverage | Technical capability | Priority |
|---|---|---|---|---|---|---|---|---|
| Vendor Cloud/API | None additional | No DO hardware | Yes if implemented | Must prove | Account authorization | Planner/registry only | Vendor-dependent | 1 |
| OAuth / Account Linking | None additional | No DO hardware | Yes if implemented | Must prove | Vendor consent | No executable adapter verified here | Vendor-dependent | 1 |
| Supported Vendor P2P | None additional | No DO hardware | Potentially | Must prove | Vendor authorization | Not implemented | Supported SDK/API required; unknown references | 1 |
| Direct Secure | None additional | No DO hardware | Potentially | Must prove | Authorize/confirm | Planner foundation | Endpoint/security dependent | 1 |
| Mobile-Assisted Provisioning | Temporary app | No persistent phone | Yes for persistent outcome | Mandatory proof | Temporary LAN permission | Contract only | Native OS/device dependent | 2 |
| Generic ONVIF | Depends on transport | Depends on reachability | Not for LAN-only bridge | LAN discovery does not prove it | Hidden discovery/auth | Local adapter foundation | Local protocol available for supported devices | 1–3 after assessment |
| Generic RTSP | Depends on transport | Depends on reachability | Not for LAN-only bridge | LAN stream does not prove it | Hidden URL/auth | Real local reference | Local stream capability, not public remote authorization | 1–3 after assessment |
| Software Connector | Always-on host service | Existing suitable computer | Setup can hand off; phone not bridge | Host must remain available | Installer/OS approval; E2E incomplete | Real Tapo pilot; local mac package QA | Verified local bridge, global necessity unproven | 3 exception |
| Physical Gateway | Appliance runtime | Local appliance | Setup only | Appliance must remain online | Appliance binding | Real ten-camera DVR reference | Dedicated hardware necessity unknown | 4 last resort |
| Enterprise Edge | Site deployment | Policy dependent | Not claimed | Deployment dependent | Enterprise setup | Future work | Explicit approved design required | Policy exception |
| Integration Missing | Do not force installation | Not inferred | No executable path yet | Not verified | Explain limitation | Honest planner outcome | May exist but DO adapter missing | No forced downgrade |
| Unsupported | None offered | Not inferred | No | No proven path | Safe next step | Honest unsupported outcome | Unknown/unavailable | No activation |

Reference samples: zero-install 0, mobile-assisted 0, Connector 1, Gateway 1. Manual-support count and commercial rates are unmeasured. No percentages.

Priority applies only after hard authorization/security/persistence gates. Current implementation is a resolver foundation; a row is not a vendor integration claim.

| Strategy | Customer installation | Persistent without phone? | Hardware required? | Typical use | Security requirements | Priority |
|---|---|---|---|---|---|---|
| Vendor Cloud/API | None for a supported adapter | Must be proved | No Observer hardware | Vendor-hosted remote streams/events | Supported API, scoped auth, TLS, recovery | First |
| Account Linking | None | Must be proved | No Observer hardware | Vendor OAuth | OAuth/state/token protection, least privilege | First |
| Vendor P2P | None where authorized SDK permits | Must be proved | No Observer hardware | Supported persistent vendor relay | No undocumented exploitation, auth/TLS/privacy | First; unavailable here |
| Direct Secure | None | Must be proved | No Observer hardware | Supported secure remote endpoint | No unsafe inbound exposure; authenticated transport | Before local bridge |
| Mobile-Assisted Provisioning | Existing mobile app temporarily | Only after provisioning a persistent path | No permanent phone/hardware dependency | LAN setup of supported remote capability | OS permission, scoped short-lived metadata | Before local bridge |
| ONVIF/RTSP direct | None only if safe persistent architecture exists | Not implied by LAN discovery | Depends on safe transport architecture | Standard protocol adapter | Never expose plaintext internet RTSP or auto-forward ports | Before bridge only with proof |
| Software Connector | Always-on host service | Yes, if host stays available | Existing supported computer | LAN-only cameras/local processing | Scoped enrollment, outbound auth, protected secrets | Exception |
| Physical Gateway | Local appliance | Yes, if device stays available | Yes | No suitable host/legacy/policy | Same scoped core and secure lifecycle | Last resort; justification required |
| Enterprise Edge | Site infrastructure | Yes | Deployment-dependent | Explicit enterprise processing policy | Separate approved enterprise design | Policy-only future coverage |
| Unsupported / Integration Missing | No misleading install offer | No proven path yet | Unknown, not automatically required | Missing adapter/capability | Fail closed, safe guidance/reference | No executable path |

Current real references: one Tapo Software Connector system and one ten-camera DVR Gateway system. These are not 11 independent onboarding attempts. Zero verified zero-install systems in this reference set. No commercial percentage is inferred.
