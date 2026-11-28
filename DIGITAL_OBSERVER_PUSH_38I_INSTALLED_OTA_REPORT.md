# DIGITAL OBSERVER — PUSH 38I installed OTA and crash-loop closure

Date: 2026-09-13. PUSH 38 remains **NOT DONE**. All updates and rollback drills in this report used isolated macOS QA services and synthetic device/configuration fixtures. Neither live Home runtime was changed. PR #28 remains draft and unmerged; the real 60-minute pre-soak, v8, and PUSH 39 have not started. The bounded result ledger is `DIGITAL_OBSERVER_PUSH_38I_QA_EVIDENCE.json`.

## Final signed QA releases

Both artifacts were rebuilt from exact source commit `069c91593f8b1f74519f8ac2f85b80d4002f9166` after the OTA-agent HTTP runtime and interrupted-rollback recovery fixes. The previous PUSH 38I/38H packages are historical QA evidence only. Manifest trust uses Ed25519 QA signer `qa-p38f-ed25519-20260913`; this is not Production release custody.

| Profile | Release ID | Version | Artifact SHA-256 |
| --- | --- | --- | --- |
| Physical Gateway | `qa-p38i-gateway-069c91593f8b` | `0.2.8-p38i` | `c202aafe65ac7f3cf14e8bc51b9bdfcb84702fa1b1de2629fc03685af316e028` |
| Software Connector | `qa-p38i-connector-069c91593f8b` | `0.2.8-p38i` | `244ccc5661bcde5e85fcfe6b6712fc7096ee099e63153783ed2bafac6a8aa882` |

The Connector QA OTA archive passed strict macOS app-signature verification after final packaging. It is a QA-only archive, not a Developer ID/notarized distribution package. Release artifacts and private signing material remain outside Git in separate controlled QA locations; no private key was installed in the component fixtures.

## Isolated installed lifecycle

Both profiles passed the same installed `launchd` lifecycle: signed legacy baseline bootstrap; independently installed OTA agent; signed remediation release discovered from the QA channel without invoking the update manager manually; manifest/artifact verification; staging; supervisor stop/switch/start; bounded health gate; promotion. A later signed delayed-crash release was discovered and installed automatically; persistent failure crossed the bounded crash-loop threshold; the agent quarantined it, restored the previously promoted signed known-good archive and restarted via the service manager. The final known-good artifact hashes were the Gateway and Connector hashes above. OTA-agent kill/restart did not stop or change the camera-runtime/supervisor PID. Bootstrap/agent installation was idempotent. Synthetic identity, Site/source, configuration, queue and trust fixtures were unchanged.

The managed-agent process previously lacked the camera runtime's macOS HTTP crash guard and could terminate with bundled-Undici `setTypeOfService EINVAL` during rollback. The management package now includes the pinned HTTP runtime dependency, and the agent imports its guard. A separate persistent-state regression covers agent death after `ROLLING_BACK` and after the CURRENT pointer moved: on restart, signed known-good verification, supervisor handoff, health, quarantine and terminal `ROLLED_BACK` state complete idempotently. Known-good failure leads to bounded `ACTION_REQUIRED`, not an infinite rollback loop.

Core two-profile QA, full installed two-profile service-manager QA, release trust/OTA tests, and unsigned/untrusted/revoked/tampered/wrong-profile/wrong-architecture/replay negatives passed. The Connector post-sign mutation negative passed. These are local GUI-session/macOS `launchd` proofs, not a full machine reboot or real-device update proof. Security, static migration and release-contract gates passed; typecheck and canonical lint passed without regression. The full Web production build passed when run with the local process/port permissions Turbopack requires; the first sandboxed build attempt failed solely on an operating-system port-binding denial during compilation.

## Read-only live gate: blocked by baseline drift

The final planner performed **zero live writes**. Both installed service labels/runners were active and matched the expected layout; the Connector still matched all 250 files in its authorized captured baseline. The Gateway matched 490 files, but its `journal-loop.mjs` differs from the signed legacy baseline. The current live file SHA-256 is `d53d531be773c3e7948b6c400f1d89142f36c6b5d636acf972af10fc2e58a169`; the captured baseline member SHA-256 is `1c3013914b8a12ab3dad45f44559af245e0cfc166822af97eabf5a17a8a11151`. A read-only diff shows a new 10-second event-manifest refresh guard around the existing bounded cloud request. The live file modification timestamp is 2026-09-13 04:29:51 +03:00; the actor/source revision of this change has not been established. The signed Gateway baseline archive retains its original digest, but it is **not** an exact current-runtime capture; do not register it as live known-good or use it for bootstrap. The protected live trust root is also not yet installed, as expected before a separately authorized bootstrap.

A read-only point-in-time local health check returned Gateway 10/10 connected, six unassigned channels and zero stalled relays; Connector 1/1 connected and zero stalled relays. Both devices reported ready. This does not establish Product playback, AI progression, or a stability interval.

**Isolated internal OTA/crash-loop blockers: 0 after the final QA. Live-bootstrap safety blocker: 1 (Gateway captured baseline no longer matches live content). LIVE BOOTSTRAP READINESS = NO.** Reconcile the changed Gateway file through a read-only provenance review, then recapture/authorize the exact running baseline and repeat the live dry-run before considering any live management bootstrap. No live update, pre-soak or v8 is authorized by this report.

Production Ed25519 release-signing custody, Apple Developer ID distribution signing and notarization remain separate external/operational gaps. QA signing is not commercial distribution readiness.
