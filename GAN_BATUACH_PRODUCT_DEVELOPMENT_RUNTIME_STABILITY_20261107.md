# Canonical Development runtime stability — scoped Webpack default

Task: `GB-PRODUCT-DEVELOPMENT-RUNTIME-STABILITY-20261107`
Source: `origin/integration/development@5fa453954a52c3fe6a93a3940c75f234d1a1824c`
Branch: `codex/development-runtime-stability-20261107`

## Evidence and change

The canonical launcher previously inherited the installed Next 16.4.3 Turbopack default. Separate Inspector and Staff Development attempts observed an intermittent repeated full-document navigation/Suspense fallback. The Staff attempt failed before any GPS action or data write; its protected receipt SHA256 is `03a0b8d0964eeeec3c9396b6e365c5bb86d0220840c0d85abdd2e12a91db912c`. The first triggering operation is **not proven**. Earlier bounded Webpack checks succeeded, but those do not prove all journeys stable or establish a Turbopack root cause.

The installed local Next guide (`node_modules/next/dist/docs/01-app/02-guides/local-development.md`) documents explicit `--webpack`; the installed Next CLI exposes both `--webpack` and `--turbopack`. The parser now supplies `--webpack` for the no-argument canonical `npm run dev:integration` launch and for `--ui-only`. Explicit `--webpack` has the same behavior. An explicit `--turbopack` remains available only as a labeled `TURBOPACK_DIAGNOSTIC_KNOWN_INTERMITTENT_FAILURE` mode. Unknown, duplicate and conflicting flags fail closed. The launcher still performs its branch, snapshot, environment, migration-drift, local backend health and loopback guards before starting Next. The `WEBPACK_STABLE_DEVELOPMENT` string identifies the selected Development bundler; it is not a declaration that the complete Product or Staff journey has passed.

This is a local Development mitigation, not a Product change or a root-cause fix. It adds no dependency, paid supplier or fixed monthly commitment. Digital Observer core, Auth, schema/RLS, provider integrations, main and Production are unchanged. The six exact-head CI gates and a real merged-head Product run remain necessary.

## Validation and next gate

Focused `node --test scripts/qa/check-integration-workflow.mjs` passed **10/10** on the isolated branch. The first run showed 9/10 because the sparse worktree omitted tracked `AGENTS.md`; after materializing that one tracked file, the same suite passed 10/10. This is a sparse-checkout test fixture issue, not a Product failure. A focused diff check passed. No Development server or browser was launched for this source validation.

PR #336 is already ancestry-merged into Development `5fa453954a52c3fe6a93a3940c75f234d1a1824c`; it does not need a duplicate closure PR. Its Staff-time journey remains blocked pending a new one-shot run from the merged Webpack-default canonical head. After this mitigation passes exact-head CI and merges, perform fresh host/resource admission, verify isolated `LOCAL_SUPABASE`, and use the existing bounded Staff runner once. If it fails, preserve the receipt and stop without switching bundlers or claiming PASS. If it succeeds, verify actual UI/API/database result, same-Garden Manager read and foreign-role denial. Full Product/security, external owner visual acceptance and invoice-backed cost gates remain open.
