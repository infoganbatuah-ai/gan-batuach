# Connection Intelligence — PUSH 17

## PUSH 17D — COMMERCIAL COLLECTION WIRED

Authenticated real activation and normalized onboarding failures now feed the bounded observation service. Commercial measurements include Product, technical, installer and external-app actions; installer/Gateway/Connector/support requirement; discovery outcome; elapsed time; normalized failure; and later bounded stability. Missing values remain null, not zero.

Technical capability, current Digital Observer coverage and observed real success remain separate. Client-reported failure/friction is marked `CLIENT_REPORTED` and excluded from global promotion; server-verified activation may be `PRODUCTION`. One sample cannot promote registry knowledge. Version/firmware scope, last verified, 90-day staleness and human validation remain mandatory. Global learning rejects tenant/user IDs, names, LAN identifiers, URLs and credentials.

## PUSH 17C — OUTCOME LEARNING AND COVERAGE

Orchestrator v2 separates technical capability, current DO coverage, observed per-system success and requirement basis; v1 observations remain readable and grouped separately. A local capability is not proof that every zero-install option is impossible. New-source metadata persists those facts and runtime-confirmed activation emits sanitized commercial observations. Actual customer effort is nullable until measured.

Identification/assessment now captures bounded client-reported Product actions, zero technical actions within that limited UI stage, and elapsed time. It does not claim whole-journey zero effort, time-to-active, or trusted activation. Server audit is scoped after authorization; no raw query, friendly camera name, network endpoint or credential is included. Site selection resets local counters.

Integration backlog signal: documented Nest cloud capability lacks an executable adapter; Tapo partner Open API needs C211/video/persistence authorization evidence. These are vendor integration/revalidation items within the existing canonical process, not another roadmap. Product gaps must not teach technical impossibility. One sample stays insufficient; evidence requires validation, firmware/version scope and revalidation after staleness. Global aggregates exclude tenant/site/network identifiers. Full failure/abandonment/support funnel capture remains incomplete.

## PUSH 17B — COMMERCIAL LEARNING

Foundation extended, not rebuilt. Optional strict `commercial` schema separately records productActions, technicalActions, installerActions, discoverySucceeded, technicalCapability, digitalObserverCoverage, observedSuccess and requirementBasis. Null means unmeasured, not zero. Existing fields retain external-app effort, duration, support and bounded post-onboarding stability. No IP, hostname, camera name, password, URL or free-form note is accepted.

These concepts must not collapse: LOCAL_PATH_VERIFIED does not prove cloud impossibility; INTEGRATION_MISSING is Product coverage, not hardware necessity; REAL_DEPLOYMENT is observed success, not global vendor support. Existing aggregation remains version/firmware scoped, excludes fixtures/stale data, and requires human validation. One success never auto-promotes. Security rules remain outside learning.

Install-start audit exists; full customer-action/discovery/installer/activation funnel instrumentation and automatic capture of all commercial fields are NOT complete. No commercial success percentage is claimed. Current reference systems: zero-install 0, mobile-assisted 0, Connector 1, Gateway 1; these are two historical systems, not a measured commercial funnel. Support rate/time-to-active are INSUFFICIENT DATA. Existing ten DVR channels are not ten onboarding attempts.

## PURPOSE

Learn sanitized technical connection outcomes, separately from video behavior, Risk, identity and Baseline. This is a bounded foundation, not a trained model or a complete commercial analytics system.

## DATA MODEL

`connection-intelligence.ts` defines strict observation validation and aggregation. Site-scoped observations carry attempt ID, family/strategy, registry/compiler versions, bounded numeric firmware, outcome/failure, time, optional friction measurements and optional stability window. PRODUCTION and TEST are separate. Unknown measurements remain null.

`connection-outcome-service.ts` reuses append-only `immutable_audit_events` with event type `connectivity_outcome`. Source activation in the existing Software Connector API emits an observation only after server-side source/device/freshness checks. There is no public endpoint accepting client-supplied activation or zero-install proof. Diagnostic plan decisions are stored under `connectivity_assessment_completed` with a random support reference.

No new migration is required for these writes. Audit persistence is best-effort; sink failure does not break camera activation. No claim of exactly-once telemetry delivery: the aggregator deduplicates repeated site/attempt IDs.

## SANITIZED OBSERVATIONS

Unexpected fields are rejected. Passwords, tokens, URLs, addresses, hostnames, camera/site names, user identity and network topology cannot enter the observation schema. The site/attempt keys are for tenant-scoped deduplication; they do not survive global aggregate output. Audit actor identity remains in the authorized audit record, never the global pattern.

## SUCCESS / FAILURE LEARNING

Deterministic fixtures cover success, failure categories, duplicate delivery, TEST exclusion and insufficient samples. Only activation is currently hooked into the real Product path. Failure/abandonment/interaction capture is not yet a complete funnel. Therefore no complete Production success-rate denominator is claimed.

## STABILITY LEARNING

Bounded observation windows record progressing versus observed seconds, reconnects and auth failures. Aggregation exposes availability only with measured seconds. The live PUSH 27-to-observation stability adapter remains to be connected; a one-time healthy frame is not long-term reliability.

## CONFIDENCE / SAMPLE SIZE

Fewer than 20 samples: INSUFFICIENT_SAMPLES. At least 20: CANDIDATE_KNOWLEDGE. This is an internal maturity threshold, not a statistical confidence interval. Mean effort/time use only measured samples; absence is not zero. Commercial medians and rates remain INSUFFICIENT DATA until the entire eligible funnel is instrumented.

## VERSION / FIRMWARE AWARENESS

Groups separate family, strategy, firmware, registry version and orchestrator version. TEST, future-dated and older-than-90-day records are excluded from current patterns. Last verified is retained. v1 readers do not silently merge future incompatible schemas.

## CANDIDATE KNOWLEDGE

No observation, including a successful physical camera, changes any live adapter, rule, model, threshold or registry. Every aggregate includes `autoApply: false` and `HUMAN_VALIDATION_REQUIRED`.

## VALIDATION / PROMOTION

Required future path: authorized review → reproducible validation → versioned registry/ranking change → release gates. Reviewer UI/promotion persistence is not implemented in this change. Never call candidate data approved knowledge.

## SECURITY HARD GATES

Authorization, secure transport, no inbound exposure, privacy, persistence and recoverability are deterministic prerequisites. A high learned score cannot make an unsafe candidate eligible.

## PRIVACY

No raw media, credentials or private LAN inventory. Operational metrics, security audit records and Product analytics are distinct. Existing audit retention governs stored observations; global export needs explicit policy and authorization. No indefinite retention or legal period is invented.

## TELEMETRY INTEGRATION

Assessment and activation reuse existing audit storage. Unit tests inject a failing sink and prove the caller continues. An authorized admin aggregate API/UI and complete funnel reporting remain gaps; fixtures are never counted as real customers.

## FUTURE LEARNING LOOP

PUSH 23 adds stability evidence; PUSH 27 is already DONE EARLY and is revalidated; PUSH 38 adds reliability qualification; PUSH 46–48 add real customer cohorts. Vendor adapters add independently verified capability records. No new roadmap or future PUSH execution begins here.
