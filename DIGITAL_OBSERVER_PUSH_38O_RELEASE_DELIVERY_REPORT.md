# PUSH 38O — controlled Home QA release delivery

Status: **NOT READY FOR LIVE TRANSITION**. PUSH 38 remains not done. PR #28 stays draft and unmerged; no live runtime, trust root, or camera configuration was changed. No pre-soak or v8 run was started.

## Verified preflight

- The three required signed QA manifests still refer to non-deployable `qa.invalid` URLs. The two remediation manifests also specify a 100% rollout cohort, not an exact Home-device allowlist. Their artifact bytes must be retained, but new delivery URLs and exact targeting require newly signed manifests.
- Current OTA download accepts HTTPS and validates the signed manifest's artifact size and SHA-256, but provides no authenticated artifact-request header. A private bucket URL with a bearer query parameter would violate the no-secret-in-URL rule; an unrestricted public object would violate restricted QA delivery.
- The existing Vercel function response limit is 4.5 MB, whereas each required archive is over 130 MB. A normal Vercel artifact-proxy response cannot deliver one archive. Any cloud proxy needs a separately qualified bounded chunk/stream design, or an approved artifact host that authenticates the device without URL credentials.
- The protected live root pin and root-signed release-key registry are absent. The retained QA key map is not a root-signed registry and cannot be installed as one. An authorized, fingerprint-confirmed public root and signed registry must exist before an administrator is prompted to install them.
- Home-QA publication preflight now rejects invalid endpoints, query-bearing URLs, broad cohorts, wrong devices/profiles/channels, and tampered manifests. Its nine synthetic cases pass. This is a **publication safety check**, not a live delivery or TLS proof.
- At inspection, the existing provider dashboards showed Vercel included credit nearly exhausted, with spend safeguards enabled, and Supabase within its Pro storage/egress quota. No plan, cap, paid add-on, or usage setting was changed.

## Required sequence before any live bootstrap

1. Select and authorize a private, stable HTTPS artifact-delivery mechanism compatible with the installed OTA downloader, without URL credentials or public bucket exposure. For the current Vercel/Supabase stack, this requires a device-authenticated bounded download implementation and a separately controlled cloud deployment while PR #28 remains draft.
2. Publish only the three required unchanged artifact byte streams. Re-sign new QA manifests with exact Home-device IDs, zero cohort percentage, approved HTTPS URLs, and the original artifact sizes/digests. Keep the channel INTERNAL/INTERNAL_QA.
3. From the live host, perform no-install discovery and download; verify valid TLS, redirect rejection, exact size, SHA-256, and signed manifest for each artifact. Exercise HTTP/TLS/size/hash/tamper rejection.
4. Prepare a root-signed QA trust registry and confirm its root fingerprint out of band. Only then invoke the protected installer and stop at the secure macOS administrator prompt for the owner. Verify pin/registry permissions, trusted/revoked/tampered-key behavior, and that no private key was installed.
5. Recheck both live baseline hashes and Home camera health before separately authorizing any Connector transition or Gateway bootstrap.

No administrator authentication was requested in this turn because the artifact-delivery and signed-registry prerequisites are not yet ready. Installation would create a partially prepared live trust state without a verifiable release path.
