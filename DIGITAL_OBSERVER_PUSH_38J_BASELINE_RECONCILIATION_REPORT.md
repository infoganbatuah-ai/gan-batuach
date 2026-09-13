# DIGITAL OBSERVER — PUSH 38J live baseline reconciliation

Date: 2026-09-13. Result: **NOT READY FOR LIVE BOOTSTRAP**. This was read-only investigation. No live runtime, camera configuration, identity, trust root, OTA slot, or service was changed. PR #28 stays draft/open/unmerged; the real pre-soak and v8 have not started.

## Exact discrepancy

The sole changed member is `services/video-gateway/journal-loop.mjs` relative to the Gateway runtime root. It is **runtime code**, not configuration, generated state, cache, log, or a dependency artifact; it correctly belongs inside a versioned release. The previously signed baseline member is 21,548 bytes, SHA-256 `1c3013914b8a12ab3dad45f44559af245e0cfc166822af97eabf5a17a8a11151`. The current installed member is 21,646 bytes (+98), SHA-256 `d53d531be773c3e7948b6c400f1d89142f36c6b5d636acf972af10fc2e58a169`. Its filesystem creation/modification time is 2026-09-13 04:29:51 +03:00, owner is the local user, and mode is `0644`.

The entire observed code diff wraps the existing bounded `/cloud/event-manifest` refresh with a condition that reuses the last accepted manifest for up to 10 seconds. Syntax checking passed; this specific diff contains no visible secret injection, foreign binary, or new external endpoint. The Gateway supervisor process started at 04:29:56 +03:00, five seconds after the changed file was written, so this file is part of the currently loaded installation. A repository-history search did **not** find this edit in a committed revision. The inspected baseline, repository and service evidence did not identify a signed release or reliable custody record explaining who authored/approved/applied it. The edit's *functional purpose* is clear; its *provenance and authorization* are not. This is an out-of-band runtime-code mutation, not a release-boundary error. It is not justified to label it malware, nor to certify it trusted.

## Read-only state and gate

The signed original Gateway archive still has SHA-256 `aa57572e873662d65faf241fb503eaec070c444bdcbff751dafe0fa4be89d2ae`; its manifest remains intact, but its bytes no longer represent the installed runtime. The read-only comparison found 490 matching Gateway files, one changed, none missing, and `LIVE_BASELINE_CONTENT_CHANGED`. Connector matched all 250 files against its existing authorized baseline; no Connector rebuild is needed on present evidence. Both installed service layouts were compatible, and planner write count was **zero**. The protected live trust root is not installed, which is expected before a separately authorized bootstrap.

At a single read-only health snapshot, Gateway reported 10/10 connected DVR cameras, six unassigned channels, no stalled relays, and ready authorization. Connector reported 1/1 connected Tapo source, no stalled relays, and ready authorization. This is not playback, AI, or 60-minute stability evidence.

The user's integrity rule requires STOP when the live code's authorization cannot be explained. Therefore **no new baseline candidate was captured, signed, or registered**; there is no new release ID/hash/file count to report. New-baseline isolated restore and automatic managed rollback were **not attempted**. The 38I isolated rollback proof remains valid for its older signed artifacts, but cannot establish rollback from this changed Gateway installation.

**Internal live-bootstrap safety blocker: 1 HIGH — unproven provenance/authorization of changed Gateway runtime code.** Security attestation, new exact-baseline signing, and the final two-device readiness dry-run cannot pass until this is resolved. A safe continuation requires a verifiable change record and authorization for this exact edit, followed by a fresh exact-runtime capture, secret/content review, QA signing, isolated service-manager restore/rollback, and a new zero-write live comparison. Do not silently revert the live edit or treat the prior archive as current known-good.

Production Ed25519 custody, Apple Developer ID distribution signing, and notarization remain separate external/operational gaps. No live bootstrap, pre-soak, v8, PUSH 39, or PR merge is authorized by this report.
