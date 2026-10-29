# Pilot stream incident handoff — 2026-10-29

## Superseding owner-authorized recovery unit

The human owner explicitly approved the certificate/pin recovery, controlled
same-version service reload and detailed disclosure to the specification chat
in the next turn. The rejection recorded below is historical; it is not a new
request for the same authorization.

Current result: HOME_QA TLS and both device authorizations recovered; actual
leaf rotation verified with unchanged camera PIDs/release pointers. Scheduled
local maintenance is installed. See RECOVERY_RESULT_HE.md and the separate
recovery evidence files. Product Production playback remains unresolved and
the DVR has not passed an all-source stability qualification.

Additional owned paths: the five new `scripts/qa/pilot-loopback-tls*` files.
No pre-existing Product/runtime source file was replaced. Applied changes are
limited to private local QA certificate/pin files and service definitions, with
protected verified configuration backups. Source patches in other worktrees
and integration/development were not overwritten. There are no migrations.

Installed issuer/leaf service: Application Support private path class
`Digital Observer/push38-qualification/loopback-tls-v3-20261029`.
The existing live `remote-ingress` label is now persistent; the stale duplicate
`qa-control-ingress` is retained with RunAtLoad=false. The existing signed OTA
self-healing process remains, but new release discovery/download is held by
the local ingress. Future release ownership must reconcile that explicit hold
without removing certificate maintenance or changing identity bindings.

Validation scope: focused Node/Python checks and local live TLS/auth/rotation;
not all six exact-candidate CI gates, not Product playback, not a new PUSH38
soak or a reboot/restore exercise. Keep remote preservation and integration
pending until their corresponding evidence exists. The final recovery commit
and exact validation are included in the cross-chat summary after the bounded
observation completes.

## Original diagnosis and delivery history

Final recovery source commit: `8930486ef0d198c3bb0d1c61e6e767ed79ef966a`.
The five-minute observation completed: TLS/auth 21/21 and Tapo 21/21;
effective all-ten-DVR availability only 10/21; strict all-source progression
FAIL retained. A further read after approximately 15 minutes of process uptime
still showed both authorizations ready on the same 101/40 versions and TLS401;
DVR remained degraded. See post-refresh-auth-check.json.

Delivery after human approval: **NOT DELIVERED / TECHNICAL BLOCK**. Two attempts
through send_message_to_thread returned `Cannot steer conversation ... without
an active turn id`. A direct history check found no recovery summary in the
destination. Navigating to the existing chat succeeded, but native app access
was denied for safety reasons. No alternate app, credential, CLI, database
injection or indirect-message workaround was used. Authorization is present;
the blocker is technical/platform access. SPEC_HANDOFF_HE.md is the complete
prepared handoff for a single manual delivery or a later supported-tool retry
after deduplication. Do not ask the owner to approve the same disclosure again.

Canonical integration handoff is integration-unit.json. Remote preservation,
exact-candidate full CI and Development integration remain explicitly pending;
no shared ledger or another task's source branch was overwritten.

Owner: parallel incident chat `01a18505-5d8c-7731-829c-0c3eb9c4a6cc`.
Worktree: `/Users/danielderi/.codex/worktrees/87c7/Gan-Batuach`.
Owned paths: only this incident directory. No Product, runtime or migration files.
Feature branch: `codex/pilot-stream-incident-20261029`.
Base: `2da8f75a` (exact full base in canonical-sources.json).

Result: diagnosis and comprehensive coverage documentation prepared; actual
Product streams remain BLOCKED. See INCIDENT_REPORT_HE.md for precise recovery
authorization, evidence, rollback requirements and source-by-source limits.
No runtime, credentials, trust, service, rollout, database, main or Production
was changed. No physical command or extra DVR login. No paid service activation.

Validation: three fresh read-only local health samples; full TLS validation
rejects expired QA certificate; QA upstream and tunnel readiness return 200;
bounded Production SELECT and existing authenticated Product UI observations;
52 unique PUSH numbers, 197 unique capability IDs, JSON parse and scoped
email/private-key/bearer-URL pattern checks. Full CI/hardware playback/soak were
not run or claimed for this documentation-only unit.

PUSH38: historical Development acceptance exception retained; no new DONE or
24-hour PASS. The installed 101/40 rollback state differs from the historical
102/41 acceptance. Historical PR28 remains open draft/unmerged; no new release PR.

Preservation: commit this directory on the named feature branch; the exact
documentation SHA is available in `git log -1` on that branch and is included
in the final cross-chat handoff. Remote push and Development ledger integration
are **PRESERVED_LOCAL / PUSH_PENDING / INTEGRATION_PENDING**: current provider
no-build branch-trigger settings were not freshly verified, so no remote push
or CI/deployment was initiated. This is an explicit pending handoff, not a
claim of durable remote preservation. Integration owner should record the
exact documentation commit in the canonical Development ledger after safe
remote preservation. Do not merge the historical PUSH38 branch or alter its
acceptance records as part of integrating this incident evidence.

Next owner action: authorize the narrowly scoped HOME_QA certificate/pin
renewal and controlled service reload on unchanged signed versions, with
rollout prevented and protected backups, or assign that exact operation to
the existing live-runtime owner. Product Production reconnection and media
routing remain a separate reviewed authorization. No physical home action or
new password is currently proven necessary.

Deliver exactly one complete summary to specification chat
`01a17446-bdbb-76d1-971d-1d3b23e1565d`, identifying this as a parallel incident
that does not cancel the primary camera task. Delivery acknowledgment belongs
in the current chat's tool history; do not send duplicate follow-ups.

Delivery attempt: **REJECTED / NOT DELIVERED** by automatic approval review.
The reviewer did not recognize a trusted human message authorizing disclosure
of the detailed internal incident report, operational identifiers, paths and
hashes to that destination. No workaround, second attempt or indirect delivery
was made. A direct human authorization identifying this report and destination
is required before retrying. The attempted summary referenced documentation
commit `72a94701fc4a45b0e9abedc624f99b2091b660ae`; this delivery-status addendum
is preserved separately. The camera incident and coverage artifacts are intact.
