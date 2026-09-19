# PUSH 38 continuation — R2 publication preflight

Observed 2026-09-19. Current status: **THREE ARTIFACT ROUND-TRIPS PASS; LIVE TRANSITION NOT READY**.

## Current continuation result — 16:46 UTC

This section supersedes the historical preflight below. No artifact was rebuilt, recompressed, re-signed or modified. All three archives in the table below were uploaded privately and fully downloaded directly from R2. For every archive, LOCAL SHA = DOWNLOADED SHA = HISTORICAL SIGNED MANIFEST SHA; exact byte sizes also match. These historical signatures authenticate preserved bytes; they are not the new AWS-signed exact-device rollout metadata.

- Access: PASS using the existing owner-approved single-bucket credential in macOS Keychain. The `security` tool returned hex-rendered password bytes containing a trailing control character. Strict decoding fixed the probe. The new helper accepts only the expected decoded format, suppresses captured errors, and never writes or logs credentials. Thirteen synthetic regression cases pass.
- Upload: three successful create-only conditional PUTs; existing objects are never overwritten. Release-specific object keys follow the preserved HOME_QA draft contract. Total archive storage: **429,898,360 bytes**.
- Round-trip verification completed at **2026-09-19T16:42:01.531Z**. Three final round-trips PASS. One additional full download during the first probe means measured total downloaded bytes **576,676,662**, four successful full downloads. The first probe incorrectly expected HTTP401/403 for anonymous access; R2 returns HTTP400 `InvalidArgument / Authorization` for absent authorization. The original failed harness evidence is preserved; classification was corrected, not bucket permissions.
- Private access: provider API confirms Standard, r2.dev disabled, no custom domains. Anonymous object/list requests are denied with the classified missing-authorization response. Three deliberately expired presigned GETs returned HTTP403. No permanent public URL or signed access URL was logged. The publisher's 120-second private download proof is NOT managed-device authentication proof.
- Post-upload bounded inventory: five objects, three archives, total 429,898,360 bytes, not truncated. The other two entries were not inspected or changed.
- AWS signing custody remains CLOSED/PASS. **New exact-device AWS manifests and root-authorized live registry have not been issued/installed in this continuation.** Historical broad metadata is retained as evidence and was not uploaded or activated. Historical remediation cohort100 remains unreplaced; do not report REMOVED.
- Live control-plane blocker: POST without credentials to the release-download authorization route on the Connector's configured cloud origin returned HTTP404, also reproduced on the project's Vercel hostname. The separately preserved R2 route/migration is still a draft, not a live service. No existing device-authenticated URL issuance, live negative authorization suite or device staging can be claimed from publisher access. Production deployment is expressly prohibited for this task; no alternative local delivery/auth bypass was introduced.
- Baselines: the existing read-only transition planner passed both exact runtime comparisons, transition strict signature, per-device derivation and external state-path checks. No runtime writes. Gateway reconciled baseline and Connector exact legacy baseline MATCH.
- Home observation at 16:46:16Z: Gateway HTTP200, healthy, 10 progressing, zero stalled/failed. Connector HTTP200, reports healthy but **zero progressing / one failed source**, zero stalled. A preceding bounded probe timed out for both; another earlier Connector sample also had zero progressing. Do not claim 11/11 or resolved legacy Tapo failure. Playback/AI were not checked. Six empty slots are the preserved baseline inventory, not a fresh hardware scan.
- Cost: restricted evidence has six valid PUSH33 cost-usage records and a cost report built from actual client measurements. Monetary amounts are unknown, not provider-reconciled zero; production cost ingestion has NOT occurred. Bounded incremental R2 projection remains $0 inside available Standard allowance; total infrastructure/registered-user cost and the stricter paying-user ratio remain NOT YET MEASURABLE. The one restricted supplier ledger was updated; no new ledger or production rows were created.

### Remaining gates / exact next action

Two HIGH delivery/trust gates remain open: (1) reviewed device-authenticated control plane/schema/configuration is not deployed; (2) AWS-signed exact-device rollout plus installed root-authorized public trust is incomplete. The current legacy Connector source failure is a separate live-health gate. No new signing-architecture failure was found.

The owner/release coordinator must authorize a specifically reviewed cloud control-plane delivery release/environment consistent with the no-Production boundary before live device-download qualification can proceed. Do not silently deploy the entire PUSH38 branch, merge main, apply the blocked migration, or substitute publisher credentials for device identity. Then issue the exact-device AWS metadata, run the full live authorization negatives, install verified public trust with native owner approval and stage only. No credential rotation/recreation is needed for the now-working access (subject to its existing expiry).

Private evidence: owner-restricted `exports/restricted` evidence class, round-trip runs 1/2 and PUSH33 cost-event report; contains no credentials or bearer URLs. Preserve historical reports and artifacts. Required full CI/release gates remain unclaimed; this continuation ran syntax/diff checks, Keychain13, remote-signer14, HOME_QA9, trust-rotation/root-pin regression, preserved R2 object-scope regression and real provider round-trips. PR28 remains OPEN DRAFT / UNMERGED. No runtime activation, pre-soak, V8, PUSH39, main change or Production deployment.

Development preservation: this branch now carries the canonical `git.deploymentEnabled` no-preview guard (`**: false`, `main: true`) before its scoped push. The integration owner confirmed earlier global Preview tracking was disabled and reported no later settings change; fresh provider-dashboard verification is unavailable. No full CI or provider billing-count claim follows from this configuration. Record the resulting exact commit in the integration ledger as PRESERVED_PENDING_INTEGRATION; do not merge PUSH38 automatically.

## Historical preflight (retained, superseded)

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
