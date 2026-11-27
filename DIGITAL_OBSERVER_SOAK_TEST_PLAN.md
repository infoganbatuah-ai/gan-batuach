# DIGITAL OBSERVER SOAK TEST PLAN

## Scope and duration

The qualifying reference is the real Home: ten populated DVR channels through the Physical Gateway, one Tapo through the Software Connector, and six unassigned DVR slots excluded. The canonical minimum is 24 actual elapsed hours. A laptop sleep, monitor restart or missing interval does not manufacture elapsed evidence; checkpoints retain timestamps and gaps.

Run with `npm run qa:digital-observer-real-home-soak`. Default checkpoints occur every minute. Deep probes occur hourly and decode a current frame through the authorized local playback contract for all eleven cameras, execute real inference for every currently AI-eligible source, and sample local learning/activity across all eleven cameras. Policy-ineligible inference is recorded with its explicit policy reason and is not misreported as an AI outage.

## Checkpoints

Each checkpoint captures Gateway/Connector health, authorization, expected/progressing/stalled streams, DVR session counters, relay lifecycle counter deltas, supervisor and child-runtime identity/uptime/CPU/RSS/open handles, checkpoint continuity, local Journal/offline and AI queue state, queue-file size, disk capacity, log sizes and normalized 401/`setTypeOfService EINVAL`/fatal log counters, and empty-slot truth. Start, hourly and end checkpoints include playback, AI and learning probes. No source configuration or camera credential is changed.

## Gates

- Real elapsed time is at least 24 hours.
- Denominator is eleven expected physical cameras; six empty slots remain excluded.
- Health, frame progression, playback and AI are separate.
- Every deep playback checkpoint verifies eleven current decodable streams.
- No silent acknowledged loss, duplicate Product effect, cross-tenant leakage or unrecorded intervention.
- Process/recovery churn, log growth and memory growth are reported even if service self-heals.
- A checkpoint gap over 2.5 times the configured interval invalidates the run.
- Missing runtime-process evidence invalidates the run; a stable supervisor cannot hide a replaced child runtime.
- Final Home state is 10/10 DVR plus 1/1 Tapo, zero stuck streams.

If any mandatory gate fails, fix the cause and begin a new qualifying interval. Earlier failed evidence remains retained; it is not rewritten into PASS.
