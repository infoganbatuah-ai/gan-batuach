# PUSH 38S isolated control-plane candidate

Status: **PRESERVED_PENDING_INTEGRATION**. This branch starts at
`integration/development` commit `2fe7bf3d` and retains the original PUSH 38O,
38P, remote-signer, 38Q and release-trust source commits through cherry-pick
ancestry. It is not the running canonical Development Product.

## Scoped result

- HOME_QA publication QA: PASS (9 cases).
- Private release-object contract: PASS.
- R2 authorization core: PASS (synthetic, not live).
- Remote Ed25519 signer contract: PASS (14 deterministic cases; live KMS not
  re-exercised in this candidate).
- Root-pin/rotation/revocation trust QA: PASS.
- Edge OTA static and synthetic rollback QA: PASS.
- Security gate: PASS (7/7) after materializing tracked source omitted by the
  candidate sparse checkout.
- Migration health: initially FAIL because the source private-delivery
  migration reused timestamp `20260913020000` already owned by a Management
  migration. A follow-on candidate commit renames it to unique
  `20260913020001_edge_private_release_delivery_audit.sql` and removes an
  unnecessary Supabase Storage bucket/policy; migration health then PASS.
  Neither version was applied to any database.
- Typecheck: **FAIL/UNVERIFIED**. The initial attempt hit the 4 GiB Node heap
  ceiling; a second bounded attempt hit the 6 GiB ceiling after roughly five
  minutes. Neither returned diagnostics. This is not a typecheck PASS and may
  reflect the sparse candidate/host rather than a source type error. Do not
  raise the heap repeatedly or integrate without an exact-commit CI result.

## Real-device boundary

The approved local Development launcher intentionally strips Production
credentials and accepts only the isolated Supabase configuration. The current
OTA authorization route verifies a cloud-issued HMAC session token, so the
existing real Home token cannot be validated by Development without copying
the Production HMAC secret. That copy is prohibited. The canonical PUSH 18
device identity also has a device-held Ed25519 private key and server-side
proof/replay verifier; a safe QA enrollment bridge should instead store only
the verified public key, exact device/tenant/Site/profile binding, and
credential version in Development, then issue a Development-only short-lived
session after a fresh proof. This bridge and a route-limited HTTPS ingress
remain unimplemented and unqualified. No real device was enrolled.

No AWS key operation, R2 upload/download, Home runtime, main branch,
Production deployment or Production migration was changed by this candidate.
