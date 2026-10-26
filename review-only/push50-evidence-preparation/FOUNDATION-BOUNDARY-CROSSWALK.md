# PUSH 50 preparation — foundation boundary crosswalk

Source tree: `653bf3cf77466c489525d958947a3af1b0d7468c` on
`codex/event-ingest-replay-identity-20261025`. Each SHA below is a **Git blob
SHA-1**, not a deployment or test-run ID. A tracked file proves only the
described source or historical receipt. This is a navigation aid for critical
PUSH 1–38 foundations and their current boundary contracts, not a complete
diligence room, fresh hardware qualification, or activation decision. Later
contracts are included where they constrain an earlier foundation.

Evidence classes: `SOURCE_CONTRACT` = code present but not run here;
`MIGRATION_TEXT` = committed SQL text, not application/RLS proof;
`HISTORICAL_RECEIPT` = prior recorded result, not rerun here;
`CI_CONTRACT` = workflow definition, not exact-head CI result;
`LOCAL_RECEIPT` = a recorded prior local command, not rerun for this map;
`EXTERNAL_GAP` = register of explicitly absent supplier/device proof.

| ID | Boundary | Tracked path | Blob SHA-1 | Class | Still open / cannot infer |
| --- | --- | --- | --- | --- | --- |
| A01 | 52 PUSH / 197 capability ownership | `DIGITAL_OBSERVER_CAPABILITY_PUSH_OWNERSHIP_MAP.json` | `40a3173e3136730c961cc63b270b735e0384c93b` | HISTORICAL_RECEIPT | Mapping/accountability is not live Product proof. |
| A02 | Capability status discipline | `DIGITAL_OBSERVER_NORTH_STAR_COMPLETION_MATRIX.md` | `d7d32c7e7d7329f9a19c3a7971728614d3e5e36a` | HISTORICAL_RECEIPT | Historical real-proof labels do not replace fresh external qualification. |
| A03 | Model A Tenant → Site → Source → Event → Incident → Risk | `lib/domain/digital-observer/model-a-ownership.ts` | `34ca808e5ee4f87d3967f0c5909933a162600e5b` | SOURCE_CONTRACT | Authoritative historical Home Tenant/Site binding and canonical DB enforcement remain unverified. |
| A04 | Site foundation / proposed RLS text | `supabase/migrations/20260603003000_digital_observer_multisite_foundation.sql` | `628aa9df646dccdfd53b7f95252bb6f16334c9ea` | MIGRATION_TEXT | File presence does not prove applied migration, effective grants/RLS or authoritative Model A Tenant ownership. |
| A05 | Recipient membership, Site and channel authorization | `lib/domain/digital-observer/notification-delivery-service.ts` | `85b680a029ede5a134db082902a4ca6716dc24b8` | SOURCE_CONTRACT | Real recipient consent, cross-role Data API probes and provider delivery remain open. |
| A06 | Gateway event identity and enrollment binding | `lib/domain/event-engine/gateway-auth.ts` | `aefcb17a24d02357cbbe061a237324869575b233` | SOURCE_CONTRACT | Current installed-host identity and revocation need bounded live evidence. |
| A07 | Narrow playback ingress path/rate contract | `services/video-gateway/playback-ingress.mjs` | `51384d13114d1347dcb1a4dfc833b2fb525916dd` | SOURCE_CONTRACT | Code is not proof of private external HTTPS/iPhone media or actual edge rate control. |
| A08 | PUSH 38 acceptance exception and reliability ledger | `DIGITAL_OBSERVER_PUSH_38_RELIABILITY_QUALIFICATION_REPORT.md` | `0c461c0eca3721f9233445cb402bd88eda567f88` | HISTORICAL_RECEIPT | Development closure used an owner exception; no uninterrupted strict 24h PASS. |
| A09 | PUSH 38 final canary / three-hour strict result | `DIGITAL_OBSERVER_PUSH_38_FINITE_EPOCH_DRAIN_CLOSURE_EVIDENCE.json` | `aac4d1255363a90e7b2d7263d99d1a69768d0ec9` | HISTORICAL_RECEIPT | 0.2.102 canary PASS; three-hour strict status NOT_DONE; continuous 24h PASS not claimed. |
| A10 | Canonical authenticated Event ingestion | `app/api/video-gateway/cloud-events/route.ts` | `c4ae8ddf79d37453f0ba227a6a4f398aa52dbd9b` | SOURCE_CONTRACT | Durable ownership/fencing and canonical DB replay behavior are not proven by this source alone. |
| A11 | Risk decision and Watch Rule persistence | `lib/domain/digital-observer/risk-decision-service.ts` | `b0a876c61310f85e0424422f51fad94dab805c16` | SOURCE_CONTRACT | Atomic claim/effect completion RPCs remain guarded review-only work, not active DB proof. |
| A12 | Incident correlation and REAL_CAMERA_AI provenance | `lib/domain/digital-observer/incident-correlation.ts` | `7faffcf04f593188efa487f4d2da521779bbd432` | SOURCE_CONTRACT | Cross-camera/tenant, generation-CAS and representative real-load proof remain open. |
| A13 | Guard capability and human confirmation boundary | `lib/domain/digital-observer/guard-engine.ts` | `164d169019813db9f196211ae15dafc5451eae5c` | SOURCE_CONTRACT | Guard remains OFF; no physical action or external acknowledgment proof. |
| A14 | Sanitized server audit contract | `lib/security/audit-log-service.ts` | `4b3b6379721e6b792af2572aa54aa7217b48fe42` | SOURCE_CONTRACT | Immutable write, retention and restore/evidence chain need independent DB/legal proof. |
| A15 | Retention engineering baseline only | `lib/domain/digital-observer/retention-engineering-baseline.ts` | `b2882ad20d0d702d87964148cd1c1cd58969a989` | SOURCE_CONTRACT | Legal approval and real-data activation absent; no deletion authority. |
| A16 | Six mandatory CI gate definitions | `.github/workflows/production-checks.yml` | `9dfb402ee10878b26b182d706c1f5345c58b323f` | CI_CONTRACT | Workflow text is not a green exact-head run or release authorization. |
| A17 | Isolated local web-build qualification | `review-only/push50-evidence-preparation/LOCAL-WEB-BUILD-RECEIPT.md` | `79e8ee7ee36dec49a030bb0895a7bfded7876297` | LOCAL_RECEIPT | Earlier Webpack local PASS only; canonical Turbopack build, clean-install CI and native build remain unproven. |
| A18 | External activation proof gaps | `DIGITAL_OBSERVER_EXTERNAL_ACTIVATION_PROOF_REGISTER.json` | `0e7dd40ddca8174699a47a5b79a53fcd0cd541b2` | EXTERNAL_GAP | Real CH1 cellular media, APNs, physical device-proof enrollment and supplier activation are not proved by this register. |

Binding boundaries: **Model A** is one customer Tenant with Sites underneath;
missing authoritative ownership fails closed. Gan Batuach Management roles are
not Observer Tenant authority. **Guard OFF; Native Access BLOCKED; PUSH 44
PARTIAL; retention v1 ENGINEERING_BASELINE; PUSH 46 NOT STARTED.** PUSH 38's
owner-approved Development acceptance exception preserves its canary and
three-hour results but does **not** promote either failed V8 or the strict
three-hour run to uninterrupted 24h PASS. PUSH 50 remains PREPARATION ONLY.

No SQL, migration, database connection, supplier query, camera action, media
activation, remote CI or Production action was performed to assemble this map.
