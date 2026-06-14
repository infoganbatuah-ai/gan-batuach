# Data Flow And Privacy Mapping

**DRAFT FOR LEGAL REVIEW**

## Parent / Manager / Staff App Flow

User app -> Next.js route -> Supabase Auth -> Supabase PostgreSQL -> Supabase Storage -> notifications / payments / audit logs.

Privacy controls:

- server-side authorization
- garden and child scoping
- private storage for sensitive documents
- signed URL readiness
- audit logging for sensitive access
- no service role exposure to client

## Camera Flow

Camera / DVR / NVR -> gateway provider -> secure playback token -> viewer session -> access audit log.

Observer processing path:

Camera gateway -> secure frame sample -> pose extraction -> skeleton/motion signal -> human review queue -> optional approved summary.

Restrictions:

- no direct RTSP to browser
- no camera credentials in browser
- no audio in Gan Batuach Israel Mode
- no face recognition in Gan Batuach Israel Mode
- no raw AI event visibility for parents

## AI / Skeleton Flow

Frame sample -> pose adapter -> anonymized keypoints -> motion engine -> observer signal -> review.

Data minimization:

- no child name in AI telemetry
- no parent name in AI telemetry
- no ID number in AI telemetry
- no raw video export without legal approval

## Payment Flow

Gan Batuach subscription:

Kindergarten -> payment provider -> Gan Batuach company account.

Parent tuition:

Parent -> payment provider -> kindergarten account.

The two revenue streams must remain separated.

## Audit Flow

Sensitive action -> immutable audit service / audit table -> admin review and evidence pack.

Audit events should avoid secrets, payment card data, private URLs, decrypted medical values and raw camera credentials.
