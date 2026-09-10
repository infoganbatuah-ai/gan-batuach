# DIGITAL OBSERVER — EDGE UPDATE STATE MACHINE

Date: 2026-09-09

| State | Meaning | Permitted next state |
|---|---|---|
| `IDLE` | No eligible update | `UPDATE_AVAILABLE` |
| `UPDATE_AVAILABLE` | Signed eligible release selected | `DOWNLOADING`, `UPDATE_FAILED` |
| `DOWNLOADING` | HTTPS artifact transfer to partial file | `VERIFYING`, `UPDATE_FAILED` |
| `VERIFYING` | Signature, digest, size and compatibility checks | `STAGED`, `UPDATE_FAILED` |
| `STAGED` | Complete artifact in isolated staging slot | `INSTALLING`, `UPDATE_FAILED` |
| `INSTALLING` | Platform adapter prepares immutable version slot | `RESTARTING`, `ROLLBACK_REQUIRED`, `UPDATE_FAILED` |
| `RESTARTING` | Service starts from target slot | `VERIFYING_HEALTH`, `ROLLBACK_REQUIRED` |
| `VERIFYING_HEALTH` | Auth/heartbeat/config/cloud/process/camera gate | `HEALTHY`, `ROLLBACK_REQUIRED` |
| `HEALTHY` | Target promoted as known-good | `IDLE`, future `UPDATE_AVAILABLE` |
| `ROLLBACK_REQUIRED` | Target failed after activation | `ROLLING_BACK` |
| `ROLLING_BACK` | Restore trusted prior pointer and restart | `ROLLED_BACK`, `UPDATE_FAILED` |
| `ROLLED_BACK` | Prior known-good recovered; target quarantined | `IDLE` |
| `UPDATE_FAILED` | Defined terminal failure requiring new eligibility/recovery | `IDLE` after authorized retry |

Every transition is timestamped with bounded category/version/release identifiers. Secrets, signing private material, camera credentials and stream URLs are forbidden. A transfer/staging interruption leaves the current pointer unchanged. Post-switch failure must roll back and pass the recovery health gate; installation completion alone never promotes known-good.

For camera-bearing profiles, the gate compares progressing physical cameras with expected physical cameras. `CHANNEL_EMPTY / UNASSIGNED` capacity is retained as an informational count and never reduces update health.
