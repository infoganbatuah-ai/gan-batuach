# DIGITAL OBSERVER HEALTH REASON CATALOG

| Code | Meaning | Customer treatment |
|---|---|---|
| `CHANNEL_EMPTY` | DVR/NVR slot has no assigned physical camera | Show as unused capacity; exclude from alerts and availability |
| `SOURCE_UNREACHABLE` | Expected source cannot be reached | Explain camera/network check; recover automatically where safe |
| `FRAME_STALE` | Frames stopped progressing | Show recovering/degraded; Watchdog owns recovery |
| `RELAY_FAILED` | Relay path failed | Show connection recovery, not a camera deletion |
| `PLAYBACK_FAILED` | Product playback is unavailable | Live View degraded even if processing works |
| `AI_STALLED` | Required inference is not progressing | Observer monitoring degraded even if Live View works |
| `COMPONENT_OFFLINE` | Connector/Gateway is not fresh | One common root cause with affected cameras |
| `AUTH_DEGRADED` | Managed-device authorization is invalid/revoked | Action required; never weaken authentication |
| `CLOUD_UNAVAILABLE` | Local component cannot currently reach cloud | Preserve local-vs-cloud truth |
| `RESYNC_PENDING` | Durable backlog is pending/resynchronizing | Degraded synchronization, not necessarily camera outage |
| `RECOVERING` | Bounded recovery is active | Suppress premature persistent-failure alert |
| `FLAPPING` | Repeated state changes exceed bounded policy | Reliability degradation and deduplicated attention |
| `EVIDENCE_PENDING` | Evidence upload has not completed | Do not claim playable evidence |
| `RECORDING_UNAVAILABLE` | Recording/archive is unavailable | Do not conflate with Live View/source failure |

Raw FFmpeg, socket, credential and private URL details are support-only and sanitized.
