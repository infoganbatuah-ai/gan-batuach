# Digital Observer Acceptance Status

Updated: 2026-08-31. This is the project acceptance source of truth, NOT a
completed-product declaration. Every item requires deployed, current evidence.
Recorder recording schedules/storage administration are outside this task.

## Required End-to-End Workflow

Digital Observer is not accepted as a live dashboard alone. The required flow is:

1. Detect an event locally using a tested, consent-gated Edge capability.
2. Collect bounded local event evidence, without continuous archive recording.
3. Classify the event and record the reason, uncertainty and supporting evidence.
4. Check site policy, monitoring consent and eligible person profiles.
5. Match identity ONLY for explicitly enrolled and consented people, with a
   licensed, loaded, tested model. Do not capture new faces from live/event media
   or silently enroll an unknown person. Non-identifying detection is not identity.
6. Report resident / authorized visitor / unrecognized (not on the authorized
   list). The last state does NOT prove a trespass, denial, crime or a physical
   access-control decision. Do not claim door access control without hardware.
7. Store an explainable, source-linked, timestamped and audited decision.
8. Notify and escalate under verified delivery policy; uncertainty goes to human
   review. Missing source/evidence is a technical failure, not a reviewable event.
9. Offer only evidence-backed controls, with Observer permission, policy and
   immediate action-specific human approval before any physical command.
10. Keep event media for at most 48 hours with authorized download before expiry;
    retain only policy-permitted text insights/audit afterward, not hidden video.

No general monitoring consent grants biometric enrollment, shared-model training,
emergency-call authority or unrestricted physical control.

## Overall Closure Rule

The overall Observer task stays open until every required item has current,
deployed end-to-end evidence. A partial, blocked or untested item must remain in
this ledger with its owner, status, evidence and next gate, and continue as a
follow-on workstream. Completing a scoped release or handing over an external
blocker is not completion of the product or of the household pilot. No unresolved
item may disappear from the checklist because another release was completed.

## Ownership and Acceptance Gates

Owner names below describe accountable workstreams, not external approvals.

| Requirement | Owner | Status | Current evidence | Next gate / blocker |
| --- | --- | --- | --- | --- |
| Local live, thumbnails, fullscreen and offline isolation | Gateway + Web | Partial | Prior nine-stream samples advanced but four reconnected during a longer sample; seven disconnected sources stayed isolated | Fresh sustained media-time/fullscreen E2E after the live fix; Chat/media-check acceptance does not close this gap |
| HTTPS cross-device relay | Gateway + Infrastructure | Blocked / implementation partial | Scoped relay fixture and fail-closed Realtime bootstrap QA pass; owned DNS zone verified | Cloudflare Worker creation denied Authentication error 10000; no Worker/SFU created; grant flow, publisher/subscriber, quota and cross-device media test still required |
| Event-only media, no new face capture | Edge + Privacy | Not accepted | Local startup diagnostic capture removed; request cancellation/temp-media cleanup and event-media QA pass; no live identity work done | Approved Gateway rollout and live evidence, 48-hour deletion/download enforcement, no continuous archive and no new live/event face capture in production audit |
| Per-person biometric enrollment, consent, revocation and deletion | Identity + Privacy | Disabled pending proof | Consent/audit scaffolding; local health reports recognition false | Confirm migration/RLS; user-driven profile enrollment only, approved matching model and consent/revocation E2E |
| Resident / authorized visitor / unrecognized classification | Identity + Events | Not accepted | Required states defined above; no matching evidence | Tenant-safe profile lookup and uncertain/unknown fallback; never assert physical access denial |
| Entry/exit events and review notifications | Edge + Events | Not accepted | General event route exists, no current full workflow proof | Tested entry/exit model/rule with evidence, consented lookup, delivery and user review E2E |
| Reasoned journal, event thumbnail/clip, summaries and audit | Events + Web | Deployed / media-check E2E passed, broader workflow partial | 9fa7b769 READY; Chat evidence link opens 640px thumbnail and clip progressing 0 to 8 seconds/ended; three saved reviews displayed | Actual AI event/entry/identity workflow, 48-hour deletion worker and notification delivery remain unverified |
| Edge / AI Shadow readiness and processing | Edge | Partial | Local runtime object/person/non-identifying face self-tests previously true | Fresh consent + runtime/model/hardware + sustained per-channel inference proof; audio/fire/distress/general learning unproven |
| Per-camera capability map and gated controls | Gateway + Web | Partial, physical execution off | Capability/action gate QA passes | Read-only per-channel evidence with freshness; adapter, immediate confirmation and audit before action test |
| Observer decisions, permissions and human fallback | Policy + Assistant | Partial | Approval/audit route exists | Full detect-to-decision-to-review workflow, uncertainty fallback and no chat-to-action bypass |
| Professional evidence-grounded event narrative | Events + Policy | Deployed / media-check report and audit read verified | 9fa7b769 signed-in linked report, thumbnail, played clip and persisted review history verified | Real AI anomaly/identity evidence and the complete event decision workflow remain required |
| Chat action interface | Assistant + Policy | Scoped hotfix accepted; broader action workflow partial | 9fa7b769 production READY; signed-in stored-status query, neutral saved-instruction label and nine same-site links passed; portrait/tablet/desktop visual QA passed | Real rule execution, duplicate-request handling, richer consented context and direct restrictive-policy audit proof remain separate gates |
| Fair coverage of every source | Edge + Events + Web | Web 16ef30fa READY; source telemetry tested locally, not activated | Synthetic 5/20/64-source fairness, scoped authorization, round receipts, in-memory PostgreSQL/RLS and truthful stale/error rendering pass | Approved telemetry migration/web release, restore Chrome UI verification, staged Gateway update; exact full-window aggregation remains required |
| Privacy-safe continuous learning and semantic zones | Edge + Privacy + Assistant | Descriptive metric correction deployed; semantic learning not accepted | 16ef30fa READY; per-source metric ingestion, no sample-count calibration, no metric-only events and concurrent-write QA pass | Signed-in UI and live per-source evidence; historical metric-profile/signal audit, genuine per-zone calibration, consented adaptation/corrections/reset/forget/export still required |
| Push/email/WhatsApp/emergency delivery | Notifications + Operations | Blocked pending provisioning/authority | No provider delivery acceptance; no emergency calls placed | Verified accounts/consents/address/escalation, sandbox tests, explicit operational authority, budget enforcement |
| Site-preserving onboarding and source mapping | Web + Gateway | Partial | Source-scoped playback validation tested | Same-site edits/resume, multi-channel recorder vs single IP camera, cross-device enrollment E2E |
| Mobile portrait/PWA/install identity | Web + Mobile | Partial | Chat 9fa7b769 passed 360/390/768/1280px without overflow, with 44px chat controls/links; prior event layout QA passed | Remaining screens and signed-in installed-app/PWA identity QA without hidden features |
| Production release, scale/security/cost | Release + Infrastructure | Web 16ef30fa READY; product acceptance open | Exact production target and health verified; prior 9fa7b769 Chat/media-link E2E passed, 16ef30fa UI proof remains blocked | Remaining scoped work + audit evidence; 10,000-user load test and <= NIS 15/customer total provider budget |

## Prior Accepted Chat Release

- User directly approved production release `9fa7b769`. Deployment
  `dpl_Dzpu7eNUf5EN9L95Gaxj11uLebb3` is READY and the authenticated project
  production target matches `9fa7b7699e3b317e8e7e03474dfb4aa30a94cc0e`.
  Only the three approved hotfix files were released, not follow-on coverage,
  scheduler, Relay or Gateway work. No migration or consent was changed.
- Cloud build completed compilation, TypeScript and all 481 pages. Release QA
  was rerun: Chat intent/audit gates, truthful status rendering, consent/readiness,
  event evidence and site selection pass. Health returns 200 with app/Supabase
  OK; an anonymous conversation POST returns 401.
- Signed-in Chrome after production reload: the stored instruction is labeled
  as saved, not active; the former active-AI/learning labels are absent. The
  current capability is labeled as recently reported, not continuous inference.
  A read-only status question returns a stored 9/16 source count with explicit
  coverage limitations, no error or stuck loading, and nine same-origin links
  retaining the authenticated site's context. No watch rule or consent changed.
- Chat UI passes at 360, 390, 768 and 1280px with no horizontal overflow; visible
  chat controls and response links are at least 44px high. The 390px screenshot
  was visually inspected. The temporary viewport override was reset.
- The first evidence link opens the same-site media-readiness-check event. Its
  thumbnail loads at 640px, its real clip advances from 0 to 8 seconds/ended
  without error, and three existing review records are displayed. No new review
  was written in this release verification. This does not establish AI detection,
  biometric identity, long-running live stability or retention deletion.
- This deployment-and-Chat-E2E task is complete. The overall Observer product
  and household pilot remain open under every gate in the table above.

## Scoped Policy And Metrics Release: UI Verification Open

- Release commit `16ef30fa` on `codex/observer-event-evidence-release`
  contains the web parts of `58744e95` and `cbd9a67a`, including required
  source-coverage UI dependencies. All 14 release files were verified against
  the tested source revision. No local Gateway runtime, installer, scheduler,
  environment files, package changes or Vercel configuration changes are included.
- Ten focused web checks pass: analysis policy, source metrics, truthful status,
  coverage, conversation actions, event evidence, biometric consent gates,
  site selection, site-edit preservation and privacy boundaries. The exact
  release passed compilation, TypeScript and the complete 481-page build.
  The release branch is clean and matches its pushed remote revision.
- Four additional local synthetic/static preparation checks pass: persistent
  Keychain-only configuration, health-before-discovery ordering, fair source
  scheduling and consent-gated learning cycles. These tests do NOT prove live
  readiness and did not read Keychain values, contact the DVR or restart services.
- Push was initially rejected by the safety reviewer because ownership/trust of
  the GitHub destination was not established. After the user's explicit ownership
  and private-code upload approval, the same branch-scoped push was allowed and
  succeeded. No force push, alternate upload or approval bypass was used.
- Production deployment `dpl_55p3KKCMbnbupmNVuVBVEgBqgt4z` is READY with exact
  release SHA `16ef30faee651c62dbaeead62499cf13b031e785`. Project/repository and
  unchanged prior production target were checked before creation, and the
  authenticated project production target was verified afterward. Both public
  domains return health HTTP 200 with app/Supabase OK; anonymous analysis-policy
  requests return 401. No migration, consent or local service was changed.
- The new policy/coverage UI has NOT been browser-accepted. Chrome navigation
  timed out after 60 seconds; a restored session's existing-tab claim also timed
  out. Official diagnostics confirm Chrome is running, the extension is installed
  and enabled, and native-host checks pass. The user has been asked to approve a
  new window in the signed-in profile. Do not substitute API health for UI proof.
- Verify the signed-in policy/coverage/learning UI, then stage the local Gateway update.
  Per-source analysis telemetry and actual calibration remain open; do not infer
  continuous analysis or learned routines from saved event/activity counts.
- Read-only local `/health` preparation returned HTTP 200 and read-only true.
  Runtime/model/hardware/self-test and object detection report available;
  identity recognition and biometric matching remain false. This health surface
  does not establish site consent or sustained inference. Its cached discovery
  reports 6 connected of 16, while the registered stream map contains 10 and the
  failed counter is 10. Six active relays report progress, none report stalled.
  Source inspection explains the distinction: `discoverPrivateNvr` deliberately
  retains previously registered sources after transient probe failures, while
  `lastDiscoverySummary` records the latest probe/relay evidence. These are not
  disjoint sets. Do not add the counters or present 10 as proven live; clarify
  registered/discovered/media-progress semantics in the next Gateway stage.
  No discovery, Keychain access, service restart or physical command was used.

## Source Analysis Telemetry: Local Verification Only

- Added an allowlisted local round report and authenticated `record_round_report`
  operation. Reports contain source IDs, fixed outcome states, attempt/analysis
  timestamps and detection counts only. Detection counts are not journal-event
  counts. No frames, clips, private endpoints, person names or identity data are
  included; the runner still uses the existing Keychain-owned cloud transport.
- Authorization now issues an opaque audit receipt scoped to the authenticated
  site/Gateway and requested/authorized sources. The telemetry RPC locks and
  consumes it once, verifies source ownership and authorization time windows,
  and writes the complete batch atomically. Older reports cannot overwrite newer
  ones. Malformed, stale, foreign-scope or replayed reports do not become empty
  successful rounds. Telemetry failure does not suppress valid event delivery.
- Prepared migration `20260831020000_observer_source_analysis_telemetry.sql`.
  It adds one latest-state row per source, authenticated site-scoped SELECT only,
  service-role-only writes/RPC, current-Gateway read checks and source-deletion
  cascade. It does not modify consent, camera mapping, events or model readiness.
  Existing webhook audit receipts are still produced per round: retention and
  high-volume storage cost for that audit stream require a separate reviewed
  policy; the bounded latest-state table does not establish an overall cost bound.
- Dashboard/My Observer read through the existing session/RLS client. Missing
  migration or failed reads remain unavailable, not zero activity. Old reports
  become stale after ten minutes on page evaluation; timestamps describe the
  reported round, never continuous coverage, identity or calibrated learning.
  This is a server-rendered snapshot, not a claim of live push updates.
- Fixed a scheduler edge case found under resource contention: a denied source
  is classified as consent-unavailable even when the round budget expires before
  the worker starts, instead of being incorrectly labeled deferred for load.
- Fifteen focused JS/route/render/privacy/scheduling checks pass. PostgreSQL
  migration/RPC tests pass using an in-memory PGlite database: transaction rollback
  on partial batch failure, receipt replay, foreign site/Gateway rejection, stale
  ordering, denied rounds, authenticated/anonymous privileges, current-Gateway
  visibility and deletion cascade. These tests do not simulate multi-connection
  database contention or establish production schema state.
- The test engine was installed only in a temporary QA directory from npm:
  `@electric-sql/pglite@0.5.8`, Apache-2.0. The cached artifact SHA-512 was verified
  against `n9tsbUOhwx2epK1V0ZG9Ar4SHWUju04dhmzZXiSBXwBoleOvIfals33NAaWgagQVAL4Rbvx/Ptsu3P+pA09f6Q==`.
  Lifecycle scripts were disabled; application dependency files did not change.
- Focused TypeScript verification of changed web files and their dependency graph
  passes. The older full-project typecheck for this task was stopped after changes
  superseded it and concurrent checks in other worktrees caused resource pressure;
  those other processes were not touched. No full Next build or browser E2E is
  claimed for this telemetry candidate. Run the exact scoped release build before
  any new deployment.
- NEXT GATE: approve/apply the migration and scoped web release, verify READY and
  signed-in coverage UI, then approve the staged local Gateway rollout and real
  telemetry evidence. No migration, deployment, Keychain read, service restart,
  DVR request, live biometric processing or physical action occurred in this step.

## Historical Release Evidence

- Current narrative/audit production: `edb589218d99e7246eb1f51d4b12cfb10f7f6cad`,
  deployment `dpl_GVSgKEAMZZCsX6sf38Y26bqtYJ8c`, READY; authenticated project
  production target verified at that SHA. Builds/typecheck and narrative/tenant
  fixtures passed. Public health is OK; anonymous event-media access returns 401.
- After production reload, the same signed-in media-check event displayed two
  persisted review records, including the previously approved single review from
  this stage. No additional review was written. Narrative fields include reported
  facts, anomaly assessment, uncertainty, baseline context, risk and human action.
  Thumbnail loaded at 640px; clip loaded readyState 4, duration 8 seconds, no
  error. A subsequent keyboard playback/390px test timed out and reset browser
  automation; renewed post-release time advancement is not yet verified.
- Previous scoped production release: `789dc86e2ac9ebeafe4e271fea10200cc5960690`,
  deployment `dpl_5urZrAEj29iKZYNHMTqKxZsYbD1V`, READY on 2026-08-31 for
  `gan-batuach.vercel.app` and `ganbatuach.com`. Applies event fix `f883e848` and
  form fix `0d72eaa5` onto the previously deployed `b150f891`; experimental Relay
  scaffolding was excluded. The release branch is clean and pushed.
- Public production health: HTTP 200, app and Supabase both OK. An unauthenticated
  event-media request returns 401. These checks do not prove private event media
  playback, review persistence or consent changes in a signed-in browser.
- Chrome initially timed out despite passing extension/native-host checks. After
  the user's subsequent recovery, control of the signed-in production tab worked.
  No account/settings changes or browser-cookie extraction were attempted.
- Signed-in `/digital-observer/alerts`: eight journal rows, four loaded 640px
  event thumbnails and four separate technical faults. A real **camera media
  readiness-check event**, not an AI entry/identity event, loaded its thumbnail
  and 8-second clip. Native playback advanced from 0.011 to 8 seconds/ended with
  no media error. Reason, conclusion, confidence and unverified-identity fields
  were visible. Exactly one explicitly approved review of this media-check event
  returned the UI success message. No consent changed. Persistent review history
  was missing from the UI; its scoped read-only display is being added for E2E
  after refresh, without making another review write.
- Event detail layout checks passed at 360, 390, 768 and 1280px: no horizontal
  overflow; assessment/button text fit. The 360px screenshot was inspected;
  review touch targets were 44px high. Viewport override was reset afterward.
- Signed-in people page correctly withheld enrollment because site biometric
  setup consent is off. No person profile was created and no consent enabled.
- Sustained live is NOT accepted: all nine players advanced in a 24.6-second
  sample, but in the next 129.3 seconds only five remained continuous; four reset
  their media clocks and reconnected. Seven offline sources stayed in the
  disconnected group. No player media error at the sample instant proves neither
  uninterrupted playback nor cross-device operation.
- `b150f8916179fa1b716be3b3e388c5b525e1aa53` committed and pushed to
  `codex/observer-capabilities-completion`; deployed production READY on
  2026-08-31. Both production aliases resolve to that deployment.
- Existing production revision was an ancestor; no newer deployment was replaced.
- Cloudflare read access works. Worker write returned `Authentication error
  (10000)`; subsequent read confirms no Worker was created. No SFU credential or
  media was sent. Reauthorize Workers write/Realtime access before provisioning.
- Post-release Chrome automation timed out. Do not replace media-time evidence
  with a LIVE badge, a configured route, a self-test or a successful deployment.
- Current local health-only read: 16 discovered, 9 connected, 7 offline;
  8 progressing relays, 0 stalled. Object detection reports available; identity
  recognition/audio detection remain false. This is not browser playback proof.
- Current regression checks pass: secure Relay fixture, fail-closed Realtime
  provisioning, known-person consent lifecycle, biometric setup gates, camera
  capability/action approval, relay fairness and event media. No physical command
  or live biometric matching was used for these checks.

## Detailed Workstream Notes

1. **Live cameras and cross-device viewing: incomplete.** The authenticated
   production camera page shows nine player tiles and seven disconnected sources.
   Two Chrome samples showed time advancing in all nine, but several advanced
   slowly/restarted; a stable sustained playback acceptance test has not passed.
   The production grant route still points to viewer loopback. The local media
   Relay fixture passes, but an owned HTTPS host, gated integration, renewal,
   deployment and cross-device E2E remain required.
2. **Per-camera capabilities and buttons: partially implemented, not activated.**
   Read-only vendor/ONVIF discovery and capability gates exist. A successful
   metadata probe does not prove a physical action. The Gateway action executor
   remains unavailable. No PTZ, talkback, siren, light or recorder mutation was
   performed during this stage.
3. **Observer actions and permissions: gated, incomplete.** The approval/audit
   route exists. Physical execution needs a supported adapter, tested capability
   and immediate action-specific approval. A chat instruction is not execution
   evidence. No emergency service was called.
4. **Edge and AI Shadow: partial.** Previous local health confirmed object/person
   and non-identifying face detection self-tests. It did not prove identity
   matching, audio, fire, distress or general model learning. Readiness must remain
   tied to runtime/model/hardware tests and monitoring consent, not configuration.
5. **Biometric entry/residents workflow: gated, incomplete.** Per-person consent,
   enrollment/revocation/audit scaffolding exists. Matching is not accepted until
   a suitable licensed model, person-specific consent and real matching QA pass.
   No live biometric identification was performed during this stage.
6. **Events, thumbnails, clips, daily summaries: needs renewed E2E.** Existing
   event-media QA passes; previous UI evidence is not a current end-to-end check.
   Verify real source/time/description, thumbnail, clip, download permission,
   expiry/deletion after 48 hours and offline-source isolation after live is fixed.
7. **Context-aware home summaries and learning: not fully accepted.** Counts must
   derive from real connected sources/events, not demo/default categories.
   Parking/pool/storage classifications, verified insights and daily text need
   user-facing QA. No shared-model training approval is implied by monitoring.
8. **Push/email/WhatsApp/emergency: not accepted as operational.** Provider
   delivery, authority, consent, escalation and cost limits require separate
   verification. Automatic emergency calling remains off. Israeli numbers must
   not be swapped: police 100, ambulance 101, fire 102.
9. **Onboarding, identity, site editing and mobile/PWA: partial.** Preserve the
   existing site/source memberships. Multi-source onboarding code exists; confirm
   resume/retry, recorder discovery vs single camera, no credentials in cloud UI,
   and portrait layouts on 360/390px with the correct installation identity.
10. **Scale, security, cost and release: incomplete.** Typecheck and the prior
    stability build passed. Focused Relay QA uses synthetic media, not a load
    test. Hosting/TLS, per-tenant egress budgets within the requested NIS 15 total,
    10,000-user load tests, native signing/store accounts, production deployment
    and acceptance evidence are still required. Do not mark the overall task done.

## Verified Local Checks In This Stage

- Playback request timeout/retry and React player lifecycle regression tests.
- Site/source authorization rejects the global channel-only fallback.
- Relay transport tokens cannot authorize cloud discovery or refresh.
- Cloud revocation/site/source mapping, replay, TTL and media-path restrictions.
- Relay client disabled by default; unapproved destination receives no request.
- Failed synthetic channel leaves a working synthetic channel available.

## Independent Event And Consent Work

The event/form changes below are deployed in `789dc86e`. Media-check event
playback is verified above; consent/audit writes and AI event acceptance are not:

- Event access is bounded by capture time, configured retention and a maximum of
  48 hours. Expired media cannot receive a new viewing/download grant; the journal
  retains its textual description. This does not prove storage cleanup ran.
- Event, source and clip must belong to the same site. Terminal review decisions
  require a source, thumbnail and valid clip. Incomplete evidence can still be
  escalated for human/technical review, without changing identity permissions.
- Gateway event uploads recheck current site monitoring consent and source/Gateway
  ownership. Object presence requires the existing verified capability gate.
  Identity, entry/exit and other unverified classifications are rejected rather
  than inferred from object presence. Capability freshness remains a separate gate.
- The journal uses actual event thumbnails, capture timestamps and explanations;
  it no longer substitutes the camera's current live image. Expired media remains
  visible as text, and unavailable media has an explicit reason. Site selection
  is preserved in journal navigation; download controls follow clip policy.
- Untrusted event metadata cannot assert that a named person is a resident or an
  authorized visitor. No biometric matching, new face capture or physical action
  was enabled. Conclusions are deterministic evidence explanations, not proof of
  a new trained reasoning model.
- Known-person and Observer-request forms retain their form reference across an
  asynchronous save. Regression tests clear the event target before response:
  success resets once; failure retains input and reports an error.
- Passed local checks: `check-observer-event-evidence.mjs` (real handlers and page
  with synthetic fixtures), `check-observer-form-submit.mjs`, existing event media,
  consent lifecycle, biometric gates and site-edit preservation checks.
- The production build passed (481 pages). The live Supabase product QA could not
  start: this isolated worktree has no Supabase URL/publishable-key configuration.
  No credential was copied in to bypass that prerequisite.
- Next gates: connected-browser event/consent E2E,
  storage-deletion audit, and capability freshness/per-channel processing proof.

No DVR recording/storage diagnostic was performed in this stage. Recorder
administration remains out of scope; the pre-existing diagnostic-file edit is
excluded from these changes.

## Per-Channel Capability Hardening

The local adapter now requires a typed capability response for the requested
channel. Device-wide feature advertising alone, an empty successful response or
data for a different channel cannot enable a control. False advertising values
are not parsed as positive capabilities. Synthetic regression checks cover empty
and wrong-channel responses plus isolation when another channel times out.
These code checks passed; no DVR probe, physical command, Gateway restart or
deployment of this adapter change has been performed. The next gate is a scoped
Gateway update and authorized read-only evidence collection, not an action test.

## Narrative And Action-Interface Acceptance

- Every journal/detail report must distinguish reported observations from an
  anomaly finding. Presence alone is not entry/exit, intent, damage or danger.
  Media-readiness checks are technical tests, not security incidents.
- Required report fields: executive summary, observed/reported facts, anomaly
  and baseline context, reported severity/urgency, confidence and uncertainty,
  source/capture time and media timeline, identity state, impact/risk, suggested
  human action/escalation and review history. Unknown context is stated explicitly.
- The strict `evidence-narrative-v1` schema rejects invalid confidence, claimed
  identity matches and physical execution. It is a structured evidence report,
  not a new inference/training model. No face capture or inference capability is
  enabled by generating a report. Baseline context remains unverified until a
  consented, tenant-bound baseline result is joined server-side.
- Review-history reads must join the selected event and site under existing RLS;
  empty history and failed reads have different states. QA covers query scope,
  persisted/empty/error rendering and compatibility with long existing summaries.
- Chat must parse an explicit action catalog, validate role/site/consent/profile
  and fresh device capability, execute only authorized non-physical actions, or
  offer immediate confirmation for a supported physical action. Each response
  must distinguish requested/saved/executed/failed and cite stored evidence.
- Missing capabilities must return a truthful available path or exact next
  condition, not a generic refusal or fabricated success. No requested action is
  evidence that an action actually ran. This workflow remains unaccepted pending
  catalog implementation, security tests and deployed user-facing E2E.

No Relay media was transmitted to an unverified host. No DVR credentials, browser
cookies, cloud service-role keys or private stream URLs are included in this ledger.

## All-Source Learning Acceptance

- Cover every connected source, not just the source attached to a site-wide
  learning milestone. Use bounded concurrency, fair rotation, explicit budgets,
  timeouts and single-flight execution; one unavailable source must not starve
  the others. Prove fairness with 5, 20 and larger synthetic source sets.
- Each source needs health, last successful analysis, event counts and explicit
  coverage gaps. No event is not equivalent to no media, offline, failed
  processing or an unexamined time interval. A 48-hour query covers existing
  stored events only, never unrequested DVR recordings or unseen footage.
- Keep names and user-confirmed semantic zones (parking, motorcycle, roof,
  floor, elevator, entrances/exits and other spaces) consistent in the journal,
  chat and daily summaries. A zone/name is user context, not proof of an entry,
  exit, identity or event. Direction requires tested evidence for that zone.
- Monitoring/learning is opt-in and transparent. Warmup is bounded and must
  produce high-signal per-source coverage before any calibrated-baseline claim.
  Subsequent adaptation retains bounded event-derived aggregates/features, not
  continuous video, new face captures or identity learning without per-person
  consent. General/shared model training has a separate consent boundary.
- Provide feedback/corrections, explanation, reset/forget/export and audit.
  Tests and deployed E2E must verify these controls and their tenant scope before
  this workstream can be marked accepted.

## Camera Feature And Pilot Journey Gates

Every supported PTZ move/preset, audio/talkback, siren, light, I/O and
vendor-specific feature needs per-source read-only discovery, fresh evidence and
safety limits, an actual dashboard/chat control, role/site authorization,
immediate action-specific confirmation, result/audit and rollback status. Privacy
and recording controls additionally require their own policy and explicit scope;
this task does not authorize recorder configuration changes. An untested feature
is unknown, not a proven unsupported feature. No dummy control is acceptance.

The final household pilot must pass in production: all mapped cameras and honest
online/offline coverage; source-specific, evidence-grounded narratives; meaningful
risk/severity alerts; transparent chat outcomes and audit; safe human fallback;
consent/privacy; verified notification delivery and action authorization; portrait
mobile and a genuinely different device. A release being READY, local fixtures or
a single working camera does not pass this persona journey. The journey is still
open, including the known sustained-playback and cross-device Relay gaps.

## Chat Action Implementation Gate

The new local catalog separates status/event reads, guided navigation, saved
watch instructions and physical-action offers. Commands are anchored, ambiguous
or conditional commands ask for clarification, and stale/future/offline capability
evidence cannot prepare an action. Site roles and safe-action consent are checked.
Watch instructions are saved inactive until actual rule-executor evidence, even
when a camera reports connected. No connection flag is AI execution proof.

Requested and result states are audited without raw messages. Audit-start failure
prevents saving; a saved instruction with a failed result-audit is reported as
saved with an explicit warning, not a retryable failed save. The additive audit
type migration `20260831010000` was applied by the coordinator through the
authenticated SQL Editor. Chat is deployed at `4299d166`; it does not enable
physical actions, enrollment, consent or learning. Restrictive-policy catalog
proof remains pending separately from the verified constraint and RLS state.

Responses use site-scoped stored events from at most the last 48 hours, retain
camera scope before the query limit, and disclose missing continuous coverage.
Safe relative links point only to implemented camera/event/rule/people/settings/
add-source screens using authorized IDs. No private addresses or credentials are
returned. Remaining acceptance: consented preferences/zone/baseline context,
explain-why/corrections/reset/forget controls, duplicate request handling and the
complete household journey. Scoped Hebrew/mobile Chat E2E is now verified.
General live reasoning is
not enabled by this deterministic action catalog.

Current local chat QA passes: real route handler with synthetic scoped data,
role/source rejection, questions versus commands, ambiguous/conditional actions,
future/stale/offline evidence, consent, audit failures, inactive saved requests,
safe source links and no physical execution. Typecheck and existing event,
async-form and biometric-consent regression checks pass. Chrome control recovered
using a fresh agent tab in the same signed-in profile. A stored-status chat query
passed in production; rule execution and sustained live inference remain unproven.

- Historical CLI access returned `login_required`. The approved authenticated
  SQL Editor path resolved that deployment blocker without exporting credentials.
- The first full chat build hit a sandbox `binding to a port: Operation not
  permitted` error in Turbopack instrumentation. The permission-corrected rerun
  passed compilation, TypeScript and generation of all 481 pages. Existing event,
  site preservation, privacy, consent and new chat regression checks pass. The
  migration preserves all existing audit types; live database integrity/RLS and
  signed-in chat E2E were subsequently checked as recorded below; restrictive
  policy proof and actual rule execution remain separate gates.

## Current Follow-On Evidence

- Chat code `c911c49e` and scoped release `4299d166` are committed and pushed.
  The coordinator applied `20260831010000` in the authenticated Supabase SQL
  Editor. Read-only catalog evidence: constraint validated, chat audit type
  allowed and RLS enabled are all true. The separate restrictive-policy query
  displayed stale UI results; direct policy proof is pending, not claimed.
  Production deployment `dpl_D8MRyVcadZkhgN24jiNJS7DEkEaJ` is READY and the
  production target matches `4299d166`. Health/Supabase return OK; anonymous
  conversation access returns 401. Signed-in Chat reports stored 9/16 sources,
  distinguishes records from live analysis and offers nine site-scoped links.
- Fresh event E2E after the Chat release: the real camera-media-readiness event
  thumbnail loads at 640px; its clip advances from 0 to 8 seconds without error.
  Two prior human reviews survive reload. This is media-pipeline evidence, NOT
  entry/identity detection, storage expiry deletion or sustained live proof.
- Chat E2E exposed legacy false-green labels outside the response. A scoped
  hotfix replaces saved-rule/metric activity claims with stored/reported states.
  Edge readiness additionally requires current site consent, a non-future
  contract at most 20 minutes old, approved loaded model and passing self-test.
  Synthetic rendering/gate QA and full 481-page build pass. Work commit
  `c7ec41c6` and release `9fa7b769` are pushed. Earlier requests were rejected
  before execution because relayed approval did not satisfy the action gate.
  The user subsequently approved this exact production release directly.
  Deployment `dpl_Dzpu7eNUf5EN9L95Gaxj11uLebb3` was created for this SHA only;
  rollout is READY and signed-in Chat/mobile E2E passed as detailed above.
  No bypass was made.
- Fair scheduler core and synthetic QA cover 5/20/64 sources, bounded concurrency
  and sample/round budgets, consent expiry before/during sampling, single-flight
  rounds, failed/offline-source isolation, and non-cooperative timeout slot
  retention. Policy timeout is reported as consent unavailable and cached results
  from before a source's own attempt cannot count as successful analysis.
  It is now wired into the persistent runner locally, but NOT installed on the
  running Gateway. Authenticated per-round policy and integration QA pass as
  detailed below. Owner: Edge. Next gate: approved web deployment, staged Gateway
  update, telemetry persistence and live fairness proof without new consent.
- Coverage UI is implemented locally for dashboard/My Observer for every source, including
  offline sources without players. It uses current names/zones and only loaded
  stored reports from the last 48 hours; query failure and query-limit truncation
  are disclosed. Missing analysis telemetry stays "not reported", never no-event
  or active AI. Synthetic 20-source component QA passes at 360/390/768/1280px
  without overflow. Owner: Web + Events. Next gate: deploy, authenticated E2E,
  exact tenant-scoped counts beyond the existing 200-row runtime query and actual
  per-source analysis heartbeats. This coverage feature does not scan DVR recordings.
- Source attribution now consistently prioritizes explicit source metadata over
  conflicting legacy camera references. Coverage recognizes same-site legacy
  stream references, and the journal filter resolves the same actual source.
  Unknown explicit sources do not silently fall back to another camera. Synthetic
  regression coverage includes conflicting IDs, legacy IDs and tenant isolation.
  This source-resolution correction is local only and not in release 9fa7b769.

## Fresh Analysis Authorization And Bounded Rounds

- Implemented locally, not deployed or installed: the existing authenticated
  cloud-learning endpoint can authorize a 60-second round for requested sources
  belonging to the enrolled Gateway and site. It checks current active-site,
  monitoring-consent, privacy and schedule state, plus a non-future capability
  contract no older than 20 minutes with runtime/hardware/model self-test proof.
  Skeleton-only and child-handling sites are denied. Restricted schedule modes
  fail closed pending a tested time-window evaluator. Simple event-only/24-hour
  draft schedules remain compatible with the current explicit-consent settings
  path; draft alone never grants monitoring consent.
- Authorization uses existing device authentication (legacy signed requests
  remain compatible), nonce replay protection and required audit completion.
  Only source IDs, expiry and safe policy status return to the local runner.
  There are no new credentials, migrations, raw media or private endpoints in
  this authorization flow. Physical actions and biometric matching are false.
- The runner now requests permission before analysis, bounds concurrency to two,
  rotates through at most 20 sources per round and serializes the entire round,
  including uploads. Wrong-stream, stale, missing-model and malformed results
  cannot become successful no-event reports. Offline/failed sources stay isolated.
  Metrics upload failure does not suppress eligible event media; only successful
  publication starts cooldown. Expired authorization prevents another capture.
- Synthetic policy/route and cycle QA cover consent/revocation/privacy, tenant
  and device isolation, model/hardware failure, audit/replay/query failure,
  payload limits, legacy envelopes, timeouts, retry and no late publication.
  The existing 5/20/64-source scheduler and privacy/media/site/Keychain regression
  suites pass. A stale Keychain QA log-string assertion was updated to verify
  both the current contextual retry message and its initial call/bound.
  Typecheck, syntax/diff checks and the full 481-page production build pass.
- Remaining gates: scoped web release must precede the persistent Gateway
  upgrade (the older endpoint rejects the new operation, so analysis fails
  closed). The startup diagnostic capture and disconnected-request work gaps
  have since been addressed locally as detailed below, not installed or verified
  on the actual Gateway. No running service,
  consent, Keychain item or DVR state was changed during these local checks.
- Per-source telemetry persistence, genuine baseline calibration rather than
  sample-count heuristics, sustained live fairness and production event evidence
  remain open. This change does not establish continuous monitoring or learning.

## Request Cancellation And Startup Media

- Local-only follow-on to `58744e95`: persistent startup no longer creates a
  camera-media-readiness clip simply because the service restarted. The explicit
  diagnostic API remains available; verified detections still use the existing
  consent-gated event-evidence path. No monitoring/biometric consent changed.
- Insights and event-capture requests now own a bounded cancellation scope.
  Disconnect, request abort or deadline stops only their temporary producer/
  inference processes and waits for close. Shared live relays are not killed;
  a cancelled caller stops waiting for a shared relay without sampling it later.
  Normal POST-body completion does not count as disconnect. Listeners/timers
  are removed at completion. Child cleanup requires a valid positive PID and
  is idempotent, including a missing-executable failure.
- Event post-window waiting and encoding observe cancellation. Private 0700
  temporary event directories are removed on success, failure, thrown error
  and cancellation. No thumbnail step or returned media follows cancellation.
  Activity pixel buffers are bounded and cleared after computation; malformed,
  timed-out or failed process output cannot become a successful analysis.
  Cancelled analysis is processing failure, not falsely reported as no media.
- Verified locally: selected real Gateway function declarations loaded without
  startup/Keychain/model access; actual synthetic Node child termination; a real
  loopback HTTP aborted inference alongside a successful second request; normal
  POST handling, unauthorized rejection, missing executable/pipe failure,
  in-memory filesystem cleanup fixtures and listener removal. All 13 targeted
  QA scripts, typecheck and syntax/diff checks pass. No camera frames, actual
  model inference, recorder requests, physical commands or secrets were used.
- Next gates remain open: approved scoped web policy release followed by staged
  persistent Gateway installation/health, actual cancellation/media/live E2E,
  per-source telemetry and defensible baseline calibration. The running service
  was not restarted or updated. Production remains at the previously approved
  scoped release; no new deployed or household-pilot acceptance is claimed.

## Descriptive Source Metrics, Not Learned Routines

- Local-only follow-on: metric ingestion now requires the authenticated Gateway
  identity, current site consent/privacy/schedule and verified source mapping.
  Unknown, ambiguous, foreign-Gateway or foreign-site streams fail before writes.
  A mapped channel that goes offline or loses capability is skipped without
  blocking valid channels. Stale/future/duplicate samples cannot increase counts.
- Scores and averages are retained separately by source ID in the existing
  camera-activity JSON baseline. No new schema is required. Prior site-wide
  aggregates remain a bounded, explicitly unattributed historical snapshot;
  their counts/values are never assigned to the first camera. Other workflows'
  baselines are not overwritten. Optimistic updated-at matching and the existing
  unique key reject concurrent lost updates rather than silently merging them.
- A raw score batch no longer writes reviewable intelligence signals, global
  learning profiles, site AI state, calibration timestamps or anomaly readiness.
  Even 288 samples stay descriptive, with calibration_verified false and zero
  calibration/anomaly confidence. The old unused cloud-initiated polling entry
  point now rejects calls; only authorized local rounds may request analysis.
- My Observer distinguishes new per-source statistics from legacy mixed
  aggregates. Old v2 metric-only profiles are not displayed as calibrated in
  this view. Calendar-time accessibility text describes elapsed time rather than
  learning progress. New summaries and profile labels have synthetic QA.
- Twelve targeted QA scripts and typecheck pass: multi-source separation,
  same-site/multiple-Gateway concurrency, consent/privacy/source rejection,
  duplicates/timestamps, offline isolation, legacy preservation, no event/profile/
  site mutations, readonly legacy-poller rejection and existing chat/media/privacy
  regressions. These are local fixtures, not production database or camera E2E.
  The final source revision also passes the full 481-page production build and
  diff checks. Empty legacy baselines cannot imply low motion or low light.
- Release must include the per-round policy dependency from `58744e95`, the
  ingestion route/helper and new summary view together, before the staged local
  Gateway upgrade. No deployment, database mutation, recording, consent change,
  biometric processing or physical command occurred in this workstream.
- Still open: historical v2 learning-profile values and metric-only signals
  previously given first-camera attribution need an audited repair/review plan.
  They were not bulk rewritten or deleted. Other consumers of those legacy
  records, per-round analysis telemetry, calibrated zone/routine models and
  live rollout/acceptance remain separate gates. No general learning is enabled.
