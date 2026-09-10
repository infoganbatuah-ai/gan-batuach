# DIGITAL OBSERVER — PORTABLE DEPLOYMENT ARCHITECTURE

Contract: `observer-portable-deployment-v1`

## Boundary

Digital Observer server-side Product operation uses managed Vercel and Supabase services. Managed customer-site components remain optional and follow the established hierarchy: zero-install first, Software Connector only when required, Physical Gateway last. Customer-site networking is not an office dependency.

No Production runtime requires a developer checkout, developer home path, office host, office storage or hidden `node_modules`. Runtime inputs are a tracked release, explicit environment configuration, externally injected secrets, ordered migrations and checksummed artifacts.

## Deployment units

| Unit | Reproducible source | Persistent state | Health / lifecycle |
|---|---|---|---|
| Web/Product | Git SHA, lockfile, pinned Node 22.22.0 container/Vercel build | Supabase and approved storage backends | `/api/health`, PUSH 27 telemetry, provider deployment rollback |
| Software Connector | DMG/MSI/container package from one shared Edge runtime | protected standard OS data directory | PUSH 18 identity, PUSH 19 OTA, PUSH 20 supervision, PUSH 22 Fleet |
| Physical Gateway | shared managed Edge package/container | protected customer-Site state and credentials | same identity/OTA/supervision/Fleet contracts with Gateway profile |
| AI worker | `observer-ai-job-v1` portable worker plus checksummed model input | durable AI queue, no Product truth store | capability registration, worker health and PUSH 31 provenance |
| Future Enterprise Edge | profile extension of the same contracts | customer-approved managed storage | no separate identity/update/control plane |

## Configuration and secrets

`.env.example` and `config/digital-observer-portable-deployment.json` are the public configuration inventory. Values are injected by Vercel, Supabase, the installer or the approved secret store. Private keys, provider tokens, camera credentials and Production database credentials are never release artifacts.

Edge state paths are resolved by `runtime-paths.mjs`: standard OS locations by default, absolute explicit overrides when required, and `/var/lib/observer-connector` in the container profile. Secret/state directories are `0700`; secret files are `0600`. Relative Edge state overrides fail closed.

## Database and storage

The authoritative schema is the timestamp-ordered `supabase/migrations` chain. A clean Supabase environment uses `supabase db reset` or an equivalent provider migration job; no manual SQL is canonical. PUSH 35 validates the complete 202-file ordered chain and performs a representative isolated PostgreSQL restore. Provider-native full Auth/PITR restoration remains an operator/provider operation and must be tested before claiming full disaster recovery.

PUSH 34 storage abstraction survives deployment and restore. Backup references media through `observer-storage-v1`; no restore assumes Supabase is the only backend.

## Release and rollback

Every release identifies version, Git SHA, platform/profile and runtime compatibility. Edge artifacts retain PUSH 19 signed-manifest and rollback contracts. Web rollback uses the protected deployment provider. Cloud schema changes remain forward-compatible and separate from Edge OTA.

## No-office proof boundary

The clean proof creates a new Git archive checkout in an isolated temporary directory, installs dependencies with `npm ci`, runs under Node 22.22.0, validates portability/restore, typechecks, builds, downloads and verifies the model artifact, starts the built Web Product, and receives `/api/health`. It neither reads nor copies the development checkout's `node_modules` or hidden environment files.

Horizontal scaling, HA and multi-region failover remain PUSH 36–38.
