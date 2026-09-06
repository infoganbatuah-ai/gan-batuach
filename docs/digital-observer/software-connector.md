# Digital Observer Software Connector

## Status

- Docker/Linux container: supported and validated by package/contract QA.
- Linux systemd: supported packaging; host-specific installation still requires real-host QA.
- macOS native: shares the proven Gateway runtime and macOS Keychain; Software Connector identity requires isolated enrollment QA.
- Windows: not yet supported or validated.
- ONVIF real device: not yet production verified.

## Architecture

The Software Connector and Physical Gateway run the same `services/video-gateway` core. `OBSERVER_EDGE_DEVICE_TYPE` changes deployment identity, not Event, Journal, Evidence, or Observer semantics. The runtime initiates outbound TLS requests and does not require inbound customer firewall exposure.

The Connector owns local discovery, secure source credentials, relay, health, local sampling, and bounded buffering. Tenant business logic, Incidents, Risk, Verification, Decisions, and UI remain in the cloud product.

## Docker installation

Build from the repository root:

```sh
docker build -f services/video-gateway/Dockerfile -t gan-batuach/observer-connector:local .
```

Create an enrollment request without printing any token:

```sh
docker compose -f services/video-gateway/docker-compose.software-connector.yml run --rm observer-connector node scripts/install-software-connector.mjs request
```

Open the returned HTTPS verification URL as an authorized site manager, approve the site binding, then complete enrollment:

```sh
docker compose -f services/video-gateway/docker-compose.software-connector.yml run --rm observer-connector node scripts/install-software-connector.mjs complete
docker compose -f services/video-gateway/docker-compose.software-connector.yml up -d
```

No host port is published. Camera access and cloud communication are outbound from the Connector.

## Source configuration

Camera/DVR credentials must be written to the protected Connector state volume by an authorized local setup flow. Required account names for the existing DVR adapter are `dvr_profile_json` and `dvr_password`; values must never be placed in Compose environment variables or committed files.

## Security model

- Device identity is enrolled to one tenant/site and refresh material rotates.
- Secrets use macOS Keychain or a mode-`0600` file in a mode-`0700` secure volume.
- Cloud calls use TLS, short-lived scoped device access tokens, nonces, timestamps, retry/idempotency controls, and revocation checks.
- Local runtime binds to loopback. Container publishes no inbound port and runs as non-root with all Linux capabilities removed.
- Remote commands are schema-bound to health probe, config refresh, or one stream reconnect. Arbitrary shell execution is not present.

## Configuration and offline behavior

Cloud configuration has a monotonically increasing version and a maximum 24-hour validity window. Rollback and expired snapshots are rejected. Existing event outbox and local bounded evidence workspace survive a short cloud outage; full offline synchronization is intentionally deferred.

Default guidance: up to eight discovered cameras, four parallel relays, two CPU cores, 1–1.5 GB RAM, and 1 GB bounded local buffer. These are conservative deployment bounds, not a large-site benchmark.

## Troubleshooting

- `approval_required`: open the returned verification URL and approve the correct site.
- `identity requires approval`: the device was revoked or its rotating identity no longer matches; re-enroll with authorization.
- `DVR profile is not available`: complete the local credential handoff into the secure store.
- `heartbeat unavailable`: local video may continue briefly, but cloud status must show degraded until authenticated communication returns.
- `channel_regression_pending_confirmation`: a transient recorder reconnect is being confirmed before replacing the last known-good mapping.

Logs are structured and redact keys matching password, token, authorization, credential, and source URL fields. Do not attach raw state volumes to support tickets.

## Uninstall and revoke

First revoke the Connector from the authorized product site. Then stop/remove the service or container and run:

```sh
node scripts/install-software-connector.mjs uninstall-local
```

This removes the listed local credentials but deliberately reports that cloud revocation is still required. Deleting a local installation without server revocation is not considered a secure uninstall.
