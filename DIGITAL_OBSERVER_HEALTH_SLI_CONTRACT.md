# DIGITAL OBSERVER HEALTH SLI CONTRACT

Measured indicators, not commercial SLA commitments:

- expected-camera availability = healthy expected physical cameras / expected physical cameras;
- frame freshness = expected cameras with fresh progressing frames / expected cameras;
- playback availability = expected cameras with recently verified authorized playback / playback-required expected cameras;
- AI availability = expected cameras with inference progress / AI-required expected cameras;
- component availability = fresh authorized managed components / expected managed components;
- recovery success and latency from PUSH 20 transitions;
- flapping count/rate from bounded state transitions.

For the current Home the expected-camera denominator is 11, never the DVR capacity/source-record count of 17. Six `CHANNEL_EMPTY / UNASSIGNED` slots are excluded. Missing evidence produces `UNKNOWN` or an expired state; it does not inherit indefinite health.

Critical-camera/zone weighting is a policy hook only. No unapproved customer criticality rule or SLA is invented in PUSH 23.
