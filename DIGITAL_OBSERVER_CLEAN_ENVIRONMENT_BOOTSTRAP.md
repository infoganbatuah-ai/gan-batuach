# DIGITAL OBSERVER — CLEAN ENVIRONMENT BOOTSTRAP

## Prerequisites

- Git
- Node `22.22.0` (`.nvmrc`)
- npm `11.13.0` or compatible `>=10 <12`
- network access to the reviewed package and model registries
- Vercel/Supabase access only for authorized Production operators
- FFmpeg only for camera-bearing Connector/Gateway profiles
- Docker is optional for container execution, not required for Vercel deployment

## Web / Product

1. Clone the reviewed commit or unpack its release archive.
2. Run `npm ci`; never copy another checkout's `node_modules`.
3. Inject the `.env.example` contract through the deployment secret manager.
4. Run `npm run ci:quality`.
5. Apply the tracked Supabase migrations using the authorized provider migration workflow.
6. Deploy the reviewed Git SHA and verify `/api/health` plus PUSH 27 telemetry.

Local safe demonstration uses `APP_ENV=demo` and `NEXT_PUBLIC_APP_ENV=demo`; it must not enable live providers.

## Managed Edge profiles

- Run `node scripts/bootstrap-portable-environment.mjs --profile=SOFTWARE_CONNECTOR` or `--profile=PHYSICAL_GATEWAY` under Node 22 to create protected standard state directories.
- Normal customers use the graphical PUSH 17 package. The script is an engineering/deployment primitive, not a replacement for onboarding.
- Enrollment creates the PUSH 18 identity. Fleet registration, OTA and supervision then occur through canonical contracts.
- A custom data/model/log directory must be an explicit absolute path. Runtime working-directory state is forbidden.

## AI worker and model

The worker starts from `portable-inference-worker.mjs`. Obtain the approved model with:

`npm run model:fetch:object-detection -- --out=/absolute/managed/model/path/ssd_mobilenet_v1_10.onnx`

The downloader uses an atomic partial file and rejects size/SHA-256 mismatch. Model provenance, Apache-2.0 license, checksum and reviewed ONNX Runtime version are in `config/digital-observer-model-artifacts.json`. The model is not committed or assumed to exist on a developer laptop.

## Clean proof

After creating the scoped commit, run `npm run qa:digital-observer-clean-environment`. It exports only tracked `HEAD`, creates a fresh isolated checkout, installs dependencies, uses pinned Node 22.22.0, runs restore/portability QA, typechecks, builds, verifies the downloaded model and starts the built Product until `/api/health` responds.

The proof deletes its temporary checkout and model after completion. It does not read `.env.local`, `.vercel`, existing `node_modules`, developer caches or `/Volumes/...` runtime state.
