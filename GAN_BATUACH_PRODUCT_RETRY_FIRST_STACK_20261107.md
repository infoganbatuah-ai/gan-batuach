# Inspector due-page first-error diagnosis — bounded follow-up

Task: `GB-PRODUCT-RETRY-FIRST-STACK-20261107`
Source Development: `1782c432d5633fe5d1a0446df04eea84abff958e`
Branch: `codex/retry-first-stack-20261107`
Owner: Gan Batuach Product executor; one Development integration owner.

## Existing evidence and purpose

The preceding one-shot diagnostic reproduced four full-document requests for the Inspector due page and a first `PAGE_ERROR` in 4,940 ms, with clean browser cleanup. Its protected receipt is `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/inspector-retry-loop-diagnosis-20261107/evidence/receipt-1794041526517.json`, SHA256 `627017e492bfe740cdb629da63b3cb13ec19417ba36977fba5a1900f79efcb6c`. That receipt stored only a hash of the first stack, so it could not identify the initiating module or error category. This follow-up records bounded **sanitized** frames and passive navigation initiators while preserving the previous pre-network six-request cap. It does not repeat the Inspector draft, Parent or Documents suites.

## Source/API review

The installed Next 16.4.3 development guide documents lazy route compilation and the default Turbopack path. Next's bundled `fetch-server-response.js` contains a browser-navigation fallback after a failed RSC fetch, but the earlier receipt showed full document requests and did not prove that mechanism. [Playwright's CDP session API](https://playwright.dev/docs/api/class-cdpsession) supports passive event subscriptions on a Chromium page. The [Chrome DevTools Protocol Network event](https://chromedevtools.github.io/devtools-protocol/tot/Network/#event-requestWillBeSent) exposes request initiator type and optional JavaScript stack; its stack requires the Debugger domain. This code enables Debugger and Network solely to observe one page. It does not intercept or modify navigation through CDP.

## Scoped implementation

`scripts/qa/inspector-retry-guard.mjs` now maps known browser error messages to static categories, discards arbitrary raw messages, stores only whitelisted error names, normalizes module paths to app/Next segments, strips query/hash and outside-project prefixes, rejects unsafe function names/path segments, and caps frames at 20 and 16 KiB. Raw error/stack text exists only transiently for hashing and parsing. The receipt remains capped at 1 MiB and mode 0600. `run-inspector-due-retry-diagnostic.mjs` records timestamps for the first error, categorized console hints, target responses, guarded requests and CDP request initiators. It records no request headers, cookies, tokens, complete URLs, HTML, console argument objects or user payload. The disposable browser temp directory is on the approved external Development volume. The existing route intercept still aborts the seventh target document/RSC request before network send; work deadline remains 35 seconds and cleanup is bounded. The receipt explicitly distinguishes the QA tool SHA from the exact canonical app SHA.

The focused fixture tests include secret-bearing synthetic stack/message/URL examples and show useful function/module/line frames survive while sensitive strings are omitted. They also retain the cap/deadline/receipt/cleanup checks. The tiny temporary test fixture is created and removed within the external project worktree.

## Runtime, cause and limits

One safe-admitted, read-only canonical default-Turbopack Inspector due-page attempt ran on 2026-11-07 at 09:29:45 UTC. The QA tool was committed at `89e3ae67f1b4b8586f1c09d18c3301e5a1156553`; the actual served Product and expected canonical Development SHA were both `1782c432d5633fe5d1a0446df04eea84abff958e`. Before startup, the canonical worktree was clean, pinned `LOCAL_SUPABASE` assertion passed, loopback port 3000 was free, host load averages were 4.67/4.83/5.31, memory reported 58% free, and the external Development volume had approximately 1.09 TiB free. The canonical launcher reported `DEVELOPMENT / INTEGRATION`, the exact SHA, `LOCAL_SUPABASE`, Next 16.4.3 and `TURBOPACK_DEFAULT`.

The single run exited **0** after 5,478 ms with status `NOT_REPRODUCED_UNRESOLVED`: one permitted target document request, one HTTP 200 target document response, one passive CDP target request with initiator type `other` and no stack frames, a visible inspection link, no page error, no categorized console hint, and no cap event. Cleanup was `COMPLETE`. Its protected redacted receipt is `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/inspector-first-stack-20261107/evidence/receipt-1794043785554.json`, SHA256 `4a959bdc0d4809b120c39072b800b1d7b4febc584a71e878a78ffc7e9dc2e3a5`. The server then exited zero, port 3000 became free, and canonical Development stayed clean. The temporary ignored `node_modules` link in the feature worktree was removed after the run.

**No first stack was captured because the symptom did not recur.** This successful render does not resolve or disprove the earlier intermittent failure. Per the one-attempt bound, the browser diagnosis was not repeated. There is no Product fix or verified causal module in this unit; a future independently scoped cold-start/root-cause investigation is required if the symptom remains a blocker. No draft save/submit, upload, seed, reset, camera, provider or Production operation occurred.

## Validation and delivery

Guard/runner syntax checks passed; focused tests passed 6/6 and the scoped diff check passed. Exact-head CI and Development integration remain pending until recorded with actual evidence. No Product, Auth, schema/RLS, provider, Digital Observer core, package/dependency, main or Production change. No new paid commitment. QA identities/data preserved. Full Product/security, external owner visual and invoice-backed ₪15 gates remain open.
