# PUSH 38 continuation — R2 publication preflight

Observed 2026-09-19. Status: **BLOCKED BEFORE PUBLICATION — refreshed credential handoff pending**.

AWS custody gate remains CLOSED/PASS, supported by protected run 35452386031 on source `921a9c6f370a1dd7f3540c6dd9fed54cc6340e74`. No signing redesign or private signing key export.

## Exact preserved artifacts

Original durable QA release archives were rehashed without modification. Their historical Ed25519 signatures and exact manifest byte sizes also verify. This is local historical-package proof, not AWS replacement-manifest or R2 round-trip proof.

| Package | Bytes | SHA-256 |
|---|---:|---|
| Connector legacy transition v2 | 146778302 | `6e7988808b05956d58416a6ce60638f52b19aa732918ac0e1cdafcc5fc9f130a` |
| Connector remediation 069c91593f8b | 147360407 | `244ccc5661bcde5e85fcfe6b6712fc7096ee099e63153783ed2bafac6a8aa882` |
| Gateway remediation 069c91593f8b | 135759651 | `c202aafe65ac7f3cf14e8bc51b9bdfcb84702fa1b1de2629fc03685af316e028` |

Total: 429898360 bytes. Original archives/manifests are unchanged. The transition manifest has zero targets; both remediation manifests still have a 100% historical QA cohort and zero explicit targets. They must NOT be published/activated as the new rollout. Exact-device AWS-signed replacement metadata remains required.

## Real provider observations

- Connected Cloudflare account remains the expected existing project account.
- `digital-observer-releases`: Standard; managed public domain disabled; no custom domains (three authenticated API reads succeeded).
- Dashboard: 2 objects / 86 bytes, 23 Class A and 7 Class B operations, $0.00 billable usage for the displayed September 13–October 13 period. These two small objects are not the three release archives; no inference about their content was made.
- Keychain-backed private S3 list returned HTTP403/AccessDenied. Dashboard identified the old single-bucket Object Read & Write token as inactive since September15.
- Attempted 24-hour renewal retained the same single-bucket permission, but Cloudflare returned `Token not found`; renewal was NOT successful.
- A replacement User API Token creation was submitted with Object Read & Write, only the release bucket, and TTL24hours. Credential-result contents were not read or logged. Owner must complete protected local handoff before activation/access can be independently verified. No broad account token or permanent public access was introduced.

## Live and release boundaries

Gateway/Connector health endpoints each returned HTTP200 in a bounded read-only probe. This is endpoint reachability only, NOT 10/10+1/1 frame progression, playback, AI, or baseline-byte proof. No live runtime, trust registry, camera configuration, current/known-good slot, pre-soak or V8 changed.

The device-authenticated R2 control-plane draft remains separately preserved on `codex/preserve-push38-r2-draft-20260919` at `05cd2a93`; it is not proven deployed. No Vercel deployment or main merge was requested. The remaining delivery sequence still requires scoped signed manifests, immutable upload/round-trip, live authorization negatives, protected trust, staging and all migration/qualification gates.

Old AWS cleanup remains unresolved: servers stopped and IPs released (earlier verified evidence); 70GiB disks retained because deletion without recovery was blocked. No backup or disk deletion was attempted during this preflight. Key storage is $2/month plus usage/tax; complete supplier cost and both per-user ratios remain unmeasured in the canonical restricted ledger.

## Resume handoff

Owner: current PUSH38 task. Branch: `codex/push-38-aws-signing`. Do not merge main. After the owner saves the replacement credential locally, rerun only the secret-safe private S3 preflight, then use the established AWS-backed signer for exact-device documents and root-authorized registry. Never publish the broad historical manifests or replace missing credentials with broader permissions. No live deployment is eligible until the required delivery/trust/rollback gates actually pass.
