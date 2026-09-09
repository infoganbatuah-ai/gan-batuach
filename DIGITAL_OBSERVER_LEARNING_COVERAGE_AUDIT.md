# DIGITAL OBSERVER — LEARNING COVERAGE AUDIT

## Finding

The Product previously displayed several percentages under one visual language even though they represented different things. This could make collection-window progress or baseline sample maturity look like AI accuracy. PUSH 28 makes the meaning explicit and replaces unsupported zeroes with `NOT YET MEASURABLE`.

## Current formulas

- Hero collection window: elapsed learning days / configured target days. It is time coverage only.
- Local camera-activity `confidence_level`: `samples/288` per camera, capped at 0.98. It is baseline sample maturity, not AI accuracy.
- Site activity `sample_count`: accepted collection cycles, not number of frames, Events or cameras.
- `last_active_camera_count`: cameras accepted in the latest collection batch.
- Real-event context maturity: Event count plus day/time coverage and configuration freshness; not detector accuracy.
- Review coverage: reviewed Event/Incident outcomes divided by the eligible set only when that eligible set is known.

## Camera coverage

The UI now derives expected physical cameras with the canonical PUSH 23 empty-channel predicate and reports `sampled / expected`. Six `CHANNEL_EMPTY / UNASSIGNED` DVR slots are excluded. A large count from one camera cannot masquerade as Site-wide learning.

The latest Product observation supplied for this PUSH indicates one locally sampled camera out of 11 physical cameras (`1/11`). The current scoped QA accounts could not reread the Home source/baseline rows on 2026-09-10, so exact live collection-cycle and per-camera sample totals are `NOT MEASURED` in this closure; they are not reconstructed from UI prose.

## Categories

`normal_camera_activity` has a real local motion/luminance sampler. The canonical real-event context baseline has real Event-based maturity logic. Occupancy, generic activity-level, active-hours and zone-usage cards remain foundations/placeholders unless their own baseline rows contain real measurable inputs. They now render as `NOT YET MEASURABLE` rather than `0%` quality.

## Root cause of one-camera coverage

The sampler iterates eligible sources but accepts only sources with a configured `gateway_stream_id` whose local insight endpoint returns a valid activity sample. Evidence confirms the Product had only one accepted local source; the exact current per-source rejection breakdown is unavailable under the current Site authorization and therefore remains an operational coverage gap, not a fabricated diagnosis.
