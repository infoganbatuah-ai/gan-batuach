# Medical, Sensitive Data & Field-Level Encryption Platform

Phase 153 adds server-side, authenticated field encryption for medical, identity and high-risk personal data in Gan Batuach.

## Encryption Architecture

- Server-only utility: `lib/security/field-encryption.ts`
- Algorithm: AES-256-GCM with random 96-bit IV and authentication tag
- Output format: `gcm.v1:keyVersion:iv:authTag:cipherText`
- Key source: server-only environment variables
- Lookup strategy: irreversible HMAC-SHA256 hash for exact identity matching only

No encryption key is exposed to the browser. No decrypted value should be returned to a client unless a server route has verified role, kindergarten scope and operational need.

## Environment Key Model

Required server-only variables:

- `FIELD_ENCRYPTION_KEY_CURRENT`
- `FIELD_ENCRYPTION_KEY_VERSION`
- `FIELD_ENCRYPTION_KEY_PREVIOUS`
- `FIELD_HASH_PEPPER`

`FIELD_ENCRYPTION_KEY` remains a legacy fallback for existing camera/device secret usage. Do not use `NEXT_PUBLIC_` for any encryption or hash secret.

## Protected Write Paths

Phase 153 hardens new writes in these paths:

- `lib/crud-route.ts`
  - `children`
  - `child_health_records`
  - `medicine_given_logs`
  - camera secrets continue to use server-side encryption
- `app/api/child-health-records/route.ts`
  - encrypts medical mirror fields
  - logs view/update actions in `medical_data_access_logs`
- `app/api/medicine-given-logs/route.ts`
  - encrypts medication mirror fields
  - logs view/update actions in `medical_data_access_logs`
- `app/api/parent/child-registration/route.ts`
  - encrypts child identity, parent identity, medical fields and pickup authorization metadata
- `app/api/parent/attendance/route.ts`
  - uses AES-GCM fallback protection for signatures and encrypted signature metadata
- `app/api/garden/create-parent/route.ts`
  - encrypts parent identity/address mirrors and lookup hash
- `app/api/garden/create-staff/route.ts`
  - encrypts staff identity/address mirrors and lookup hash
- `app/api/admin/create-garden-manager/route.ts`
  - encrypts manager/owner identity mirrors and lookup hash

## Database Model

Migration:

- `supabase/migrations/20260612015300_medical_sensitive_data_field_encryption.sql`

Adds transitional fields such as:

- `identity_number_encrypted`
- `identity_number_hash`
- `medical_notes_encrypted`
- `allergies_encrypted`
- `regular_medications_encrypted`
- `signature_metadata_encrypted`
- `encryption_version`

Adds governance and audit tables:

- `medical_data_access_logs`
- `sensitive_data_backfill_runs`

Updates:

- `security_data_classifications`
- `encrypted_field_registry`

## Access Rules

Parent:

- Own child only
- Medical access only where product policy allows
- No client-side decryption

Staff:

- Assigned kindergarten only
- Operational need only
- Medical access must be logged

Manager:

- Own kindergarten only
- Medical access must be logged

Inspector:

- Assigned inspection or legal scope only
- Sensitive access must be justified and logged

Admin:

- Full platform access
- Must be fully audited

## Medical Access Audit Logging

`medical_data_access_logs` tracks:

- user
- role
- child
- kindergarten
- field accessed
- action
- timestamp
- IP
- user agent
- optional reason

Actions:

- `decrypt`
- `view`
- `update`
- `export`
- `delete_request`

## Backfill Strategy

Backfill is intentionally not automatic in this phase.

Safe process:

1. Server-side worker reads existing plaintext.
2. Worker encrypts with `encryptField`.
3. Worker writes encrypted mirror fields and `encryption_version`.
4. Worker samples and verifies decryptability server-side.
5. Product screens migrate to authorized server-side decryptors.
6. Only after legal and operational approval, plaintext fields can be cleared or dropped.

Readiness is tracked in `sensitive_data_backfill_runs`.

## Key Rotation Readiness

Every encrypted record can store `encryption_version`. The utility supports current and previous key material. Future rotation flow:

1. Load records encrypted with previous version.
2. Decrypt server-side using previous key.
3. Re-encrypt using current key.
4. Update `encryption_version`.
5. Verify samples and update `encrypted_field_registry`.

## Search Strategy

Encrypted fields cannot be fuzzy-searched directly.

Allowed:

- Exact identity lookup through `identity_number_hash`
- Non-sensitive metadata search
- Server-side controlled search with audit logging

Not allowed:

- Client-side decrypted search
- Public identity hashes
- Using hashes as user-facing identifiers

## Documents And Signatures

Sensitive files must remain in private storage buckets:

- ID uploads
- police clearance
- sexual offense clearance
- medical documents
- inspection evidence
- incident evidence
- signatures

Access must use signed URLs or server routes with role checks and audit logs. Public URLs are not acceptable for these categories.

## AI And Observer Separation

Observer and AI telemetry must not contain:

- child name
- parent name
- phone number
- ID number
- medical text
- raw parent-visible AI claims

Use UUID references only. Parent-visible summaries require human review and approval.

## Remaining Compliance Gaps

- Existing plaintext rows still require verified server-side backfill.
- Several dashboards still read plaintext medical fields directly for display until server-side decryptors are introduced.
- Sensitive document download routes need full access audit coverage.
- Private bucket policy verification is still required in Supabase.
- Inspection signature upload still needs encrypted metadata and private-only signed access parity.
- Full data export/deletion procedures need legal-hold aware implementation.
