# DIGITAL OBSERVER — RELEASE SIGNING POLICY

Date: 2026-09-09

## Implemented trust model

Edge releases use detached Ed25519 signatures over deterministic canonical JSON (`observer-edge-update-v1`). The signed body binds release/version/build, channel, platform, architecture, deployment profile, HTTPS artifact reference, exact size, SHA-256 digest, compatibility constraints, release time and rollout metadata.

Customer components contain only approved Ed25519 public keys. The application control plane accepts only configured public-key IDs and verifies the signature before recording a release. The release-signing private key is deliberately absent from the repository, Product UI, database manifest and customer package.

## Publication and custody

- Signing occurs in a controlled release environment after canonical build, dependency/license checks and artifact digesting.
- Publication requires a server-authorized Digital Observer platform administrator and emits an immutable security audit event.
- A published manifest/artifact identity is immutable. Retirement or disablement changes release state, not signed fields.
- Production key custody is an operational secret-management responsibility. Hardware-backed/HSM custody is supported by key-ID indirection but is not claimed as implemented in PUSH 19.

## Rotation and compromise

Key rotation adds a new trusted public-key ID, dual-verifies a bounded transition cohort, then removes the retired key only after supported devices can trust the new key. On suspected compromise: disable releases signed after the trusted cut-off, pause affected rollouts, distribute a trusted-key-set update through an already trusted release path, revoke the compromised key and audit the incident.

## Replay and downgrade

Normal application accepts only a version newer than current. Rollback is a separate internal path restricted to a locally recorded authorized known-good version and an enforced minimum security version. Old metadata outside this policy is rejected. Revoked devices remain revoked at every version.

## Negative evidence

PUSH 19 QA rejects unsigned/untrusted and modified manifests, modified artifacts, wrong profile/platform, revoked-device eligibility, and unrestricted downgrade/replay.
