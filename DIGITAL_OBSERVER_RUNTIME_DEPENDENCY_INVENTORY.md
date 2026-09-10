# DIGITAL OBSERVER — RUNTIME DEPENDENCY INVENTORY

Versioned machine-readable owner: `config/digital-observer-portable-deployment.json`.

| Dependency | Class | Source/version contract | Portability status |
|---|---|---|---|
| Next.js Web/Product | CLOUD MANAGED | lockfile, Node 22.22.0, Vercel/Docker | reproducible build and health proof |
| Supabase Postgres/Auth | CLOUD MANAGED | 203 ordered tracked migrations, injected credentials | schema chain verified; provider PITR/Auth restore remains operator drill |
| Supabase Evidence storage | CLOUD MANAGED | PUSH 34 `observer-storage-v1` | portable contract verified |
| Local/NAS storage | OPTIONAL | scoped filesystem adapter | deterministic QA verified; network appliance proof pending |
| Software Connector | EDGE/LOCAL REQUIRED only for exception path | DMG/MSI/container, shared Edge runtime | package contracts exist; signing/platform evidence retained from PUSH 17 |
| Physical Gateway | EDGE/LOCAL REQUIRED only when selected | managed Edge runtime/service | independent customer-Site operation; no office dependency |
| AI worker | EDGE/local/isolated target | `observer-ai-job-v1` | clean portable worker startup verified |
| SSD MobileNet ONNX | OPTIONAL by enabled object-detection profile | 29,275,103 bytes; SHA-256 `1fbcf476…b5246f9a`; Apache-2.0 | atomic verified acquisition, no local hidden copy |
| ONNX Runtime | EDGE package dependency | reviewed `onnxruntime-node@1.29.0` | bundled by Connector package; not required by Web |
| FFmpeg/FFprobe | EDGE camera-bearing profile | bundled package/container or documented system dependency | not a Web prerequisite |
| PUSH 21/31 durable queues | EDGE/worker state | versioned queue contracts and standard state root | initialized by managed runtime, no copied temporary DB |
| PUSH 27 telemetry | CLOUD/EDGE | existing health/telemetry contracts | automatic after canonical startup |
| visual capture/reference tooling | DEVELOPER-ONLY | optional QA scripts | personal reference paths may exist only here and are excluded from runtime/release proof |
| historical release-staging helpers | LEGACY/DEVELOPER-ONLY | explicitly named QA scripts | not a Product runtime input |

## Secret and key dependencies

Production DB/service credentials, provider tokens, field-encryption keys, device private keys, release-signing private keys, storage credentials and camera credentials are externally injected. Backup usability depends on separately recoverable encryption/key custody; this inventory never records key values.

## License boundary

JavaScript dependencies remain locked and scanned in CI. Connector redistribution notices are bundled in `services/connector-desktop/THIRD_PARTY_NOTICES.txt`. The current object model is Apache-2.0 and checksum-pinned. Apple signing/notarization, Windows signing and any future model/provider license must remain separately approved; PUSH 35 does not broaden redistribution rights.

## Machine-specific audit

Production/runtime files are automatically rejected if they contain the known developer `/Volumes`, username, historical checkout or fixed temporary-session paths. Visual-reference and historical staging QA remain explicitly developer-only. Standard OS paths and environment-driven absolute overrides are permitted.
