# DIGITAL OBSERVER SCALE QUALIFICATION PROFILE

The deterministic profile uses ten tenants and fifty Sites with mixed critical, normal and learning priorities plus hot-camera traffic. Jobs are metadata-only synthetic `observer-ai-job-v1` work; they are not fake physical cameras or Product Events.

Milestones process the full generated workload:

- 10 cameras: 200 jobs, 2 workers.
- 100 cameras: 1,000 jobs, 4 workers.
- 1,000 cameras: 4,000 jobs, 8 workers.

Capacity curves compare 1/2/4/8 workers on the same 400-job workload and 25/50/75/100/overload offered batches on four workers. Reports include throughput, queue-age median/p95/max by priority, completion, failures, dead letters, duplicates, backlog and process RSS before/admission/after.

This is `SYNTHETIC_LOAD` plus local process/node contract evidence. It is not a real 100/1,000-camera deployment, multi-host, multi-zone or Production scale proof.
