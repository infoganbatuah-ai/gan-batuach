# DIGITAL OBSERVER — FLEET COMMAND MODEL

## Allow-list

`REFRESH_CONFIGURATION`, `HEALTH_PROBE`, `REDISCOVER_CAMERAS`, `RECONNECT_CAMERAS`, `RESTART_SERVICE`, `ASSIGN_UPDATE_CHANNEL`, `INITIATE_APPROVED_UPDATE`, and `PAUSE_ROLLOUT` are the only PUSH 22 fleet commands. OTA execution remains PUSH 19; recovery remains PUSH 20.

## Lifecycle

Commands move through `REQUESTED → TARGETED → DELIVERED → ACKNOWLEDGED → COMPLETED`, with terminal `FAILED` and `EXPIRED` states. Stable per-device idempotency keys prevent duplicate scheduling. Delivery uses bounded `FOR UPDATE SKIP LOCKED` claims through authenticated PUSH 18 heartbeat. An offline component never receives an expired command.

## Authorization and safety

Every command stores Tenant, Site, enrollment principal, actor, expiry and safe parameters. Target preview precedes scheduling. Multi-target and restart/update operations require explicit confirmation. Maximum request blast radius is 100 components; larger operations must use staged PUSH 19 cohorts. Results are normalized and audited without secret payloads.
