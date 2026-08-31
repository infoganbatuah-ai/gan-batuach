# Gateway Capability Preflight

This is a read-only driver, not a physical-action executor. It cannot send PTZ,
talkback, lighting, siren, or recorder configuration commands. Every response
reports `executor_installed: false`; preflight additionally reports
`ack_kind: preflight_only`, `executed: false`, and a requirement for immediate
confirmation before any future physical execution path.

## Trust Boundary

The existing authenticated outbound `/api/video-gateway/camera-actions` queue is
the sole transport. The cloud must verify the enrolled device, site membership,
source UUID, gateway ID, and gateway stream mapping before delivering a task.
`camera_id` means `digital_observer_camera_sources.id`, not a legacy stream ID.
The Gateway additionally checks its Keychain site identity and its in-memory
stream/channel/driver mapping. No dashboard-to-localhost command endpoint exists.

Requests contain only the agreed fields: `id`, `task_kind`, `camera_id`,
`site_id`, `stream_id`, `channel`, `requested_at`, and `expires_at`.
`command_preflight` also requires `action` and a SHA-256 `payload_digest`.
The request lifetime is at most two minutes. Unknown fields, physical task kinds,
scope mismatches, stale requests, and changed replays are rejected before probes.

## Evidence And Delivery

The private NVR adapter uses its existing allowlisted Get/Range capability
requests only. These queries provide read-only evidence, not proof that a future
physical command was successfully executed. Evidence is per channel and action;
an untested action stays unavailable even when another action was verified.
Raw device responses, credentials, endpoints, and internal session keys are not
copied into snapshots or errors.

Concurrent duplicate request IDs share one probe. Results are bounded in memory
until request expiry. A transient result-delivery failure retries the same ACK
without repeating the device probe. The cloud result endpoint must accept typed
snapshot/preflight outcomes idempotently; they must never count as a succeeded
physical action or enable physical controls while the executor flag is false.

## Rollout Gate

The local module and poll integration are fixture-tested. They are not installed
in the persistent runtime by this commit. Deploy the compatible cloud queue and
validate source-scope/result idempotency first, then perform a guarded local code
update preserving the installed journal modules. A live read-only snapshot test
must follow before presenting any capability as verified. This work does not
authorize a physical command, enroll another device, or change camera ownership.
