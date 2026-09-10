# DIGITAL OBSERVER — LEARNING COVERAGE MODEL

Date: 2026-09-10

Site Learning coverage is measured per expected physical camera, not by aggregate sample count and not by configured DVR capacity.

For each camera the Product exposes:

- sample count;
- whether it has ever been sampled;
- last observation time;
- represented time buckets;
- scheduling reason (`SCHEDULED_SITE_LEARNING` or `UNDER_COVERED`).

Site coverage is `sampled expected cameras / expected physical cameras`. For the reference Home the denominator is 11: ten populated DVR channels plus one Tapo. Six empty DVR slots are excluded and receive zero learning work.

## Root cause and correction of 1/11

The prior runner called `/insights` concurrently for every connected source. That path unnecessarily invoked the shared ONNX inference session even though learning uploads only motion/luminance. One dominant/available inference path could therefore prevent fair collection from the other cameras.

The corrected runner uses `/activity`, which performs cheap local metrics without ONNX, and a persistent fair `SITE_LEARNING` schedule. Work is bounded and processed sequentially so every eligible source receives intentional coverage. A read-only real-input scheduler proof selected 11/11 sources with one learning sample each; persisted Product coverage changes only after updated local packages run and upload accepted samples. Existing stored coverage must remain truthful until then.

Camera confidence remains `samples / 288` up to its cap. Site baseline confidence is the minimum among sampled camera baselines. Neither number is AI accuracy, recall, risk or verification confidence.
