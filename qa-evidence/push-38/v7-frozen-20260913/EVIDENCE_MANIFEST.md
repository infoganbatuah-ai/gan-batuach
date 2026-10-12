# PUSH 38 v7 frozen evidence — 2026-09-13

This is a separate write-protected local snapshot. It is **not** a WORM/remote immutable archive. Do not overwrite it with v8. The original run is `../real-home-24h-v7/`; the derived checkpoint timeline is `failure-timeline.json`. Gateway/Connector log copies were taken after the run; use per-checkpoint log byte offsets to identify the run interval. Log lines lack timestamps and are not individually attributable to a checkpoint. Never publish raw logs without a secret review.

| File | SHA-256 |
| --- | --- |
| `checkpoints.ndjson` | `ce958ac8afcb0b4043b60676d18afb2dc2676ed3920d6facdb0dae800b5df189` |
| `result.json` | `2a89b3ddc46e7eb45fee26bb707d8e6cd16af690e513ad486a6968d4920101ac` |
| `state.json` | `a1586bb8994058b0596aa5d6dcd565b86bf9d47c9279f0748e2190b34ab16b72` |
| `failure-timeline.json` | `1f65ed9f32261c2324c2d0dcf7ca5fd5fe5731dc547f2c8a806195cf23202c38` |
| `real-home-24h-v7-runner.out` | `16e4b209b30f354849d15be751b0478907775f19812a99718279ee6e20c337b7` |
| `real-home-24h-v7-runner.err` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `com.ganbatuach.video-gateway.err.log` | `cc3694e2678fb146411764f6a01d41115cc2db44ea8e60d6d6cdc0e82f93e9d2` |
| `com.ganbatuach.software-connector.tapo.err.log` | `f486553656412da58437931cd8aeda28bd1a41b109723b619a2e8df95a723699` |

The snapshot includes process/resource, journal and queue metadata in each checkpoint. It does not contain per-channel DVR progression booleans, timestamped relay logs, or detailed recovery action records; those cannot be reconstructed after the fact.
