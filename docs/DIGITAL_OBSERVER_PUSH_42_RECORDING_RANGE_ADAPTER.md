# Push 42 recording range adapter

Local source qualification for DO-NS-086. The initial scope is one configured Physical Gateway DVR archive channel. The fixture represents that channel with a synthetic identity and the existing `observer-source-recording-reference-v1` contract. No archive transport or live source is configured by this change.

The adapter receives a server-derived session grant for the exact Tenant, Site and source. It requires a UTC interval of up to five minutes, full coverage by one retained recording, and an Event inside the interval. The lookup returns a trusted tuple of recording, Event and Evidence. The adapter independently checks their identities and the Event–Evidence–recording linkage. It returns an internal range handle only after the audit writer confirms the entry. A failed lookup or audit, missing retention, expired session, crossed scope or inconsistent link fails closed. The range handle carries no URL, token or media and cannot authorize playback by itself.

## Next integration gate

1. Obtain the DVR recovery handoff with identified advancing CH1 and Tapo frames in the original account browser, plus authorization for one existing CH1 archive interval.
2. Verify the installed DVR archive interface supports bounded reads. Use one approved source mapping and a fresh server-side authorization check. There is no verified archive reader in this change. The existing source reference schema deliberately distinguishes source recordings from Event Evidence. A trusted lookup must establish their link with validated records before wiring this adapter. A client-supplied link or a fabricated Evidence row cannot fill that gap.
3. Connect the existing durable audit mechanism and prove acknowledgment. Normalize timestamps to UTC ISO format. Reauthorize and recheck expiry at playback, and constrain the media serving boundary to the exact range. Keep the locator server-side.
4. In the original account, select the source and interval, retrieve and play advancing recorded frames, verify Event and Evidence linkage and the durable access audit, and verify the cross-site negative case with an authorized test identity. Genuine archive retrieval and playback: **NOT RUN**.

## Local validation

`node --experimental-strip-types --test scripts/qa/check-recording-range-retrieval.mjs` exercises the adapter with synthetic records. It covers scope, time and coverage, Event/Evidence identity, retention, expired sessions, lookup failure, and fail-closed audit acknowledgment. This branch adds no route, migration, provider configuration, or media delivery.

## Investigation handoff

The existing Hebrew investigation API adds a chronological timeline from the current authorized result page after site access, entitlement and history-privacy checks. The UI filters that page by camera. Only grounded rows with available Event Evidence show an archive candidate interval, clipped to the query and current time. Evidence playback retains its existing path. The archive candidate has no playback action and does not establish that a source recording exists.

The server-side preparation function rebuilds the candidate from authorized results and passes it to the range adapter. No transport calls it yet. The durable service `writeAuditEvent` currently logs insert errors internally and returns no acknowledgment, so a resolved promise from it cannot satisfy this adapter. Before activating archive access, bind the trusted archive–Evidence lookup and an acknowledged writer to the existing audit store. Record the authorization without raw archive identifiers, URLs or credentials. No SQL or schema changes are included here. Focused tests cover clock normalization, authorization, linkage, privacy and audit failure alongside the existing Hebrew investigation regression.
