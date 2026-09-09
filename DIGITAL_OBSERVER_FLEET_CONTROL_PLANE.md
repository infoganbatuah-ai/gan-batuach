# DIGITAL OBSERVER — EDGE FLEET CONTROL PLANE

## Scope

`observer-edge-fleet-v1` manages only Digital Observer-managed Software Connectors, Physical Gateways and future Enterprise Edge nodes. Genuine zero-install camera connections do not become fleet devices.

## Canonical hierarchy and inventory

`PLATFORM → TENANT → SITE → MANAGED COMPONENT → PHYSICAL CAMERA SOURCE`

The PUSH 18 enrollment principal remains the sole component identity. Fleet inventory joins its safe runtime metadata to PUSH 19 update state, PUSH 20 supervision state, PUSH 21 backlog state, Site and dependent physical sources. It exposes no key, credential, stream URL or queue payload. Multiple components per Site and many Sites per Tenant are supported.

## Health and common cause

Component health is `HEALTHY`, `RECOVERING`, `OFFLINE`, `AUTH_DEGRADED` or `NEEDS_ATTENTION`. Camera health remains separate. A failed Gateway produces one deduplicated infrastructure alert with affected-camera count; it is not expanded into repeated independent infrastructure alerts. `CHANNEL_EMPTY / UNASSIGNED` capacity is excluded from physical-camera availability and recovery.

## Control and blast radius

Fleet actions reuse the managed-device heartbeat and allow-list. Operators preview exact targets, explicitly scope Tenant/Site/profile/device/health, confirm risky or multi-target work, and are limited to 100 devices per request. Commands are idempotent, expire within 30 minutes, and follow `REQUESTED → TARGETED → DELIVERED → ACKNOWLEDGED → COMPLETED/FAILED/EXPIRED`. No arbitrary shell exists.

Platform fleet access requires the explicit Digital Observer platform-admin claim and is audited. Temporary support access is scoped, reasoned, auditable and limited to four hours. Ordinary customers do not receive the fleet console.

## Scale boundary

List contracts are cursor-paginated and batched. Deterministic QA covers 10 tenants, 1,000 Sites and 10,000 managed components. This is synthetic control-plane proof, not city-scale production proof.
