# Mandatory MFA, Identity Hardening & Trusted Device Platform

Phase 155 creates a gradual MFA and identity-hardening layer for Gan Batuach without locking existing users out.

## MFA Model

Core tables:

- `mfa_enrollment_status`
- `mfa_enforcement_policies`
- `sensitive_action_mfa_rules`
- `mfa_backup_codes`

Supported readiness:

- Authenticator App / TOTP: Supabase MFA integration path
- SMS OTP: provider readiness, not faked
- Backup codes: hashed one-time code table, not raw code storage

No raw MFA secrets are stored in application tables.

## Role Enforcement Rules

Admin:

- MFA required immediately
- Required before role changes, audit export, billing configuration, regulatory settings and permission overrides

Manager / Owner:

- MFA required with grace period
- Required before activation, bank/payment changes, staff role management, camera visibility changes, sensitive child data and exports

Inspector:

- MFA required
- Required before inspection submission, signatures, complaint/evidence access, camera evidence and report export

Staff:

- MFA required for sensitive actions
- Normal GPS attendance should not prompt every time
- MFA required for new device, suspicious location, manual correction, override and identity-sensitive actions

Parent:

- MFA required before camera access, medical data, pickup actions and sensitive document downloads
- Gradual grace period avoids immediate lockout

Observer Site Owner:

- Future Digital Observer role
- MFA required before camera, observer settings and site user management

## Sensitive Action Rules

Fresh MFA challenge readiness exists for:

- camera viewing
- medical data viewing
- sensitive document download
- payment and bank detail changes
- role changes
- kindergarten activation
- camera permission changes
- data export
- data deletion or anonymization
- security settings
- inspection submission and signature
- attendance override

Helper:

- `getMfaGateStatus`

Camera parent viewing now uses this gate and displays:

> נדרש אימות נוסף לפני צפייה במצלמות.

## Trusted Device Model

Core table:

- `trusted_devices`

Captured metadata:

- hashed device fingerprint
- user agent
- IP
- browser/platform fields
- first seen
- last seen
- trusted/revoked/suspicious status

The fingerprint is used only for security. It must not be used for advertising or user tracking outside security.

Endpoint:

- `POST /api/security/trusted-device`

## Session Security Model

Core table:

- `security_sessions`

Readiness fields:

- expiration
- forced logout
- revoke all sessions
- revoke device
- `mfa_verified_at`
- `sensitive_action_reauth_required`
- suspicious session risk level

Full Supabase session lifecycle wiring remains required.

## Account Lockout Model

Core table:

- `account_security_locks`

Supports:

- temporary lock
- admin unlock
- automatic unlock after cooldown
- security notification readiness

Permanent lockout without admin recovery is not allowed.

## Admin Recovery Model

Core table:

- `identity_recovery_requests`

Tracks:

- recovery request
- identity verification status
- recovery action
- admin actor
- completion status

Sensitive recovery actions require admin MFA.

## Audit Model

Events must use the Phase 154 immutable audit trail:

- MFA enrolled
- MFA disabled
- MFA challenge success
- MFA challenge failure
- backup code used
- trusted device added
- trusted device revoked
- new device login
- account locked
- account recovered

`recordTrustedDevice` writes a security event for new devices.

## User Experience

Use simple Hebrew:

- "אימות נוסף נדרש כדי להגן על המידע."
- "נדרש אימות נוסף לפני צפייה במצלמות."

Avoid technical language such as:

- "TOTP challenge required"
- "MFA factor assertion failed"

## Supabase Auth Alignment

Use existing Supabase Auth and session patterns.

Provider requirements still needed:

- confirm Supabase MFA factor enrollment flow
- update `mfa_last_verified_at` after successful challenge
- define SMS OTP provider if SMS is enabled
- generate backup codes server-side and store hashes only
- wire failed login telemetry to `account_security_locks`

## Remaining Identity Hardening Gaps

- Login success/failure and logout routes still need full security event wiring.
- Supabase MFA challenge verification must update `mfa_last_verified_at`.
- Backup code generation/redeem UI is not implemented yet.
- Admin recovery action UI is readiness only.
- Sensitive document, payment, role-change and inspection-signing routes still need `getMfaGateStatus`.
- Session revocation must be connected to Supabase Auth session controls.
