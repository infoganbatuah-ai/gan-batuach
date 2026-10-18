# PUSH 38U scope extension — development only

Owner authorization: build a safe legacy-device identity proof and remote playback path; do not install on Home or deploy Production yet.

Base candidate: `d39cace17df05b9bb4dfee2a0a026e3f7723238e` on `codex/push-38t-qualification`. The 38U blocker report at `8ebf6383` remains authoritative for unclosed live gates.

## Remote playback

The Product's previous claim handoff returned `127.0.0.1` to every browser. A phone interprets that as itself. The new development contract chooses a server-controlled, exact-Gateway HTTPS origin from `OBSERVER_PLAYBACK_EDGE_ORIGINS_JSON`; it verifies the enrollment is active and bound to the requested Site and component profile. A remote request without a configured origin fails closed. Loopback fallback is permitted only for a loopback-hosted development Product. The browser rejects a claim/playlist origin change and redirects. A separate loopback-bound playback ingress permits only claim and tokenized HLS paths, and streams bytes without proxying through Vercel or Supabase.

This is source-level and isolated-loopback proof, **not remote playback PASS**. Before activation the release owner must: provide an approved scoped HTTPS site-edge ingress; pin the exact Gateway/Connector origins; configure `VIDEO_GATEWAY_EXTERNAL_BASE_URL` to the corresponding public HTTPS origin; review CSP, CORS, bearer-token-in-URL logging/cache/cost controls; verify external exposure is claim/HLS only; validate DVR and Tapo moving video on a separate authorized device. No tunnel or public route was created here. Media egress pricing and peak-demand cost must be reconciled in the single restricted supplier ledger before a cost-incurring activation.

## Legacy identity

The installed legacy devices have refresh-token material but did not prove the newer Ed25519 credential. A development-only verification primitive now requires a trusted existing enrollment record, exact device/Gateway/Site/tenant/profile binding, the existing refresh-token hash, a freshly generated public key, an Ed25519 signature over the upgrade challenge, a short expiry, and **atomic trusted nonce consumption**. It neither rotates the live refresh token nor exports a private key. Synthetic tests include replay, revocation, wrong Site/tenant, wrong token, and bad signature.

This primitive is **not a live enrollment bridge**. To complete it, a separately reviewed Product-side owner-authorized attestation flow must issue and persist the challenge/nonce against the existing enrollment, verify the legacy token from its protected store, atomically consume the nonce, register only the new public key to the same enrollment, and demonstrate possession from each real installed device. The dedicated QA environment must accept a signed attestation without receiving Production service credentials or private keys. No live identity metadata was read or changed here.

## Preservation and remaining gates

Changes are scoped to Product playback handoff, local media ingress, identity-verification primitive, and isolated QA. PUSH 38 remains NOT DONE. Migration drift, exact real-device binding, scoped live HTTPS ingress, AWS exact-device manifests, protected trust installation, live staging, baselines, remote playback, AI, and full candidate CI remain unproven. `integration/development`, `main`, Production, live Home runtime, pre-soak, V8 and PUSH 39 are unchanged. Integration after completed PUSH 38 qualification remains pending.
