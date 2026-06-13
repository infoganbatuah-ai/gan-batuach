# Sensitive Data Field Inventory

Phase 153 classifies sensitive Gan Batuach fields for server-side encryption, audit logging and future backfill. Labels: `public`, `internal`, `confidential`, `medical`, `regulated`, `encrypted_required`.

| Area | Table / Source | Field | Classification | Required Protection | Phase 153 Status |
|---|---|---|---|---|---|
| Child identity | `children` | `identity_number`, `mother_identity_number`, `father_identity_number` | regulated, encrypted_required | AES-256-GCM mirror fields and irreversible hash for exact lookup | New writes add encrypted/hash fields; plaintext awaits verified backfill |
| Child identity | `permanent_child_files` | `identity_number` | regulated, encrypted_required | AES-256-GCM mirror field and hash | New parent registration writes encrypted/hash fields |
| Child medical | `children` | `allergies`, `sensitivities`, `regular_medications`, `medical_notes` | medical, encrypted_required | AES-256-GCM mirror fields, server-side access only | New writes encrypt; plaintext remains transitional |
| Child medical | `child_health_records` | `allergies`, `sensitivities`, `medications`, `medical_notes`, `emergency_contacts`, `medication_approval_url` | medical, encrypted_required | AES-256-GCM mirror fields and medical access audit log | Direct API writes encrypted mirrors and logs view/update actions |
| Medication administration | `medicine_given_logs` | `medicine_name`, `dosage`, `notes` | medical, encrypted_required | AES-256-GCM mirror fields and medical access audit log | Direct API writes encrypted mirrors and logs view/update actions |
| Parent identity | `parents`, `profiles` | `identity_number`, `address`, `phone` | regulated, confidential, encrypted_required | Identity/address encryption and phone/identity hash where lookup is needed | New parent creation and child registration write protected mirrors |
| Staff identity | `staff`, `staff_permanent_files`, `profiles` | `identity_number`, `address`, emergency contact data | regulated, confidential, encrypted_required | Identity encryption/hash and emergency contact encryption | New staff creation writes protected mirrors |
| Manager/owner identity | `profiles` | `identity_number` | regulated, encrypted_required | Identity encryption/hash | Admin garden-manager creation writes protected mirrors |
| Pickup authorization | `children`, `authorized_adults`, `authorized_pickup_contacts` | authorized adult identity, phone, relationship metadata | regulated, confidential, encrypted_required | Identity encryption/hash; authorization metadata must remain server-scoped | Schema adds protected fields; full route coverage remains partial |
| Digital signatures | `attendance_digital_signatures`, `inspection_signatures` | signature image/path, device/IP/GPS metadata | regulated, encrypted_required | Private storage, encrypted metadata, signed URL or server route only | Parent attendance fallback and metadata use AES-GCM; bucket policy verification remains required |
| Sensitive documents | `documents` | ID uploads, police clearance, medical documents, incident evidence metadata | confidential, regulated, encrypted_required | Private buckets, role-scoped access, audited downloads, encrypted metadata | Schema adds metadata fields; file-access route audit remains a gap |
| Incident / inspection evidence | `incident_case_evidence`, inspection evidence tables | photos, video refs, reports, witness notes | confidential, regulated, encrypted_required | Private storage, role-scoped access, audit logging | Schema adds encrypted metadata readiness |
| AI / observer telemetry | `observer_*`, `skeleton_observer_events`, `ai_*` | telemetry, skeleton coordinates, event metadata | internal, regulated where linked to child | UUID references only; no child name, parent name, phone, ID or medical text | Must keep PII out of telemetry; reviewed summaries only |
| Public website leads | `growth_leads`, `leads` | contact name, phone, email, kindergarten details | confidential | Server-only lead access and audit trail | Not encrypted in this phase; classified for future retention policy |

## Transitional Rule

Plaintext columns are not dropped in Phase 153. They remain for backward compatibility until a server-side backfill encrypts existing rows, sampling verifies correctness, and product screens are migrated to authorized server-side decryptors.

## Developer Safety Rules

Never log medical data, identity numbers, encryption keys, decrypted values, signatures, private storage URLs, signed URLs, or raw AI events. Use UUID references and classification metadata in logs instead.
