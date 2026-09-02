# Digital Observer Acceptance Status

Updated: 2026-09-02. This is the project acceptance source of truth, NOT a
completed-product declaration. Every item requires deployed, current evidence.
Recorder recording schedules/storage administration are outside this task.

## Local Retention Regression: 2026-09-02

- The deployed `80e5af1` media intake lacked the expired-upload guard. A local
  synthetic handler regression reproduced HTTP 201 for a clip at the 48-hour
  expiry boundary. No production event or storage object was written by this test.
- A focused local fix rejects media at the configured 24/48-hour deadline,
  caps longer site settings at 48 hours, and rejects invalid stored event times.
  Tests verify rejection precedes storage uploads, clip inserts and nonce writes;
  valid media and the existing consent/source-scope tests still pass.
- This fix is not production-deployed. It does not prove the deletion worker
  ran, nor remove the requirement for a production deletion/audit acceptance test.

## Latest Production Acceptance: 2026-09-02

This evidence supersedes the older browser and production observations below.
It accepts the scoped live/event transport repair only; it does not accept the
overall product, cross-device Relay, biometrics, physical controls or external
notification/emergency providers.

- Corrective commit `80e5af1` is deployed as production deployment
  `9HV3w8ME8xkKVhXCHuW8zjxvqRZr`, verified `Ready`, `Production` and `Current`.
- The production Gateway event-ingestion function exists again. A read-only GET
  returns 405 and an unauthenticated POST returns 401. The ingestion fixture
  passes device-token validation/revocation, tenant/source scope, monitoring
  consent, replay/idempotency, evidence compatibility, media-fault lifecycle and
  notification retry checks.
- In the authenticated production camera page, all ten video elements advanced
  12.07-12.14 seconds during a twelve-second observation. Every player reported
  `paused=false`, `readyState=4` and no media error; all ten rendered `LIVE`.
  Six offline channels remained isolated outside the active grid.
- The authenticated recordings page rendered ten real event thumbnail
  backgrounds and ten download actions. A signed, authorized eight-second clip
  loaded with `readyState=4`, no media error and advanced 3.1 seconds during the
  playback check. Signed media coordinates were not exposed.
- Entrance person evidence and verified entrance crossing now request bounded
  event media; configured parking vehicle evidence does the same. Ordinary
  indoor person presence remains a text insight without recording. Media cannot
  originate an event: it may only enrich a previously validated, source-bound
  event inside the capture window.
- No DVR write, discovery refresh, biometric matching or physical command was
  used for this acceptance run.

## Latest Scoped Evidence: 20:36 UTC

This update supersedes older local counts below, but does not supersede another
workstream's production release or mark any complete-product gate accepted.

- The installed persistent Gateway and registered sources remain intact. Real
  discovery at 20:29:39.977 UTC found 16 channels: ten connected and six offline.
  No source/site was recreated and no recorder setting or physical control changed.
- Runtime fixes through `108751d8` are installed locally: asynchronous bounded
  Keychain access, contained poll errors, non-disruptive discovery, session
  heartbeat, verified hardware conversion, per-channel recovery and bounded final
  video flush. QA/evidence through `7fca2902` was pushed to the scoped work branch.
  This was not another Vercel deployment. See
  [the detailed live evidence](docs/observer-live-stability-2026-08-31.md).
- Exact local observation over 300.37 seconds measured 297.36-300.8 new media
  seconds for all ten channels, with no missing sequence numbers or resets.
  Upstream reconnection still paused sequence advancement for 3.019-4.024 seconds.
  Browser playback, fullscreen and event-media acceptance remain pending because
  Chrome control is unavailable; sequence completeness is not uninterrupted video.
- Post-restart cloud policy permits analysis for ten connected sources only and
  denies it for all six offline sources. The existing journal loop sampled eight
  at 20:36:01.735 UTC, with zero pending deliveries/failures. One source lacks a
  configured crossing line and another requires a specialized detector. Model
  self-test passed; identity, event accuracy and temporal coverage remain unproven.
- The next unblocked code check identified RTSP false-positive readiness after
  malformed probe output, plus an obsolete socket-timeout option. Local-only QA
  now covers malformed/truncated/oversized output, late completion after failure,
  video/audio metadata preservation and source isolation. These RTSP changes are
  NOT installed or live-verified. No new DVR request or restart was used for them.
- The generic Docker recipe still copies only `server.mjs`, although that server
  imports several local modules. Container packaging/import validation remains a
  separate unaccepted gate; this observation does not affect the explicitly
  guarded Mac installation and is not a Docker build result.
- The Mac must remain powered, awake and network-connected. The existing AC
  awake guard was separately verified; this is not off-host availability or
  cross-device relay acceptance.

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

## Ownership and Acceptance Gates

Owner names below describe accountable workstreams, not external approvals.

| Requirement | Owner | Status | Current evidence | Next gate / blocker |
| --- | --- | --- | --- | --- |
| Local live, thumbnails, fullscreen and offline isolation | Gateway + Web | Partial | Installed runtime: ten local streams progressing, six offline; exact five-minute media measurement and automatic recovery | Current Chrome media-time/fullscreen E2E blocked; upstream recovery still pauses 3-4 seconds |
| HTTPS cross-device relay | Gateway + Infrastructure | Blocked / implementation partial | Scoped relay fixture and fail-closed Realtime bootstrap QA pass; owned DNS zone verified | Cloudflare Worker creation denied Authentication error 10000; no Worker/SFU created; grant flow, publisher/subscriber, quota and cross-device media test still required |
| Event-only media, no new face capture | Edge + Privacy | Not accepted | Event-media regression QA passes, no live identity work done | Prove 48-hour deletion/download enforcement, no continuous archive and no new live/event face capture in code + production audit |
| Per-person biometric enrollment, consent, revocation and deletion | Identity + Privacy | Disabled pending proof | Consent/audit scaffolding; local health reports recognition false | Confirm migration/RLS; user-driven profile enrollment only, approved matching model and consent/revocation E2E |
| Resident / authorized visitor / unrecognized classification | Identity + Events | Not accepted | Required states defined above; no matching evidence | Tenant-safe profile lookup and uncertain/unknown fallback; never assert physical access denial |
| Entry/exit events and review notifications | Edge + Events | Not accepted | General event route exists, no current full workflow proof | Tested entry/exit model/rule with evidence, consented lookup, delivery and user review E2E |
| Reasoned journal, event thumbnail/clip, summaries and audit | Events + Web | Deployed / media E2E partial | edb58921 READY; persisted approved audit read after refresh; thumbnail and 8-second clip loaded; prior release clip played to ended | Renew time-advancement after transport recovery; this is not AI entry/identity evidence; deletion worker and delivery still unverified |
| Edge / AI Shadow readiness and processing | Edge | Partial | Post-restart model self-test and consent gates verified; analysis allowed for ten connected, eight sampled, six offline denied | Resolve two rule/detector coverage gaps; verify detection accuracy and temporal coverage; identity/audio/fire/distress/general learning unproven |
| Per-camera capability map and gated controls | Gateway + Web | Partial, physical execution off | Capability/action gate QA passes | Read-only per-channel evidence with freshness; adapter, immediate confirmation and audit before action test |
| Observer decisions, permissions and human fallback | Policy + Assistant | Partial | Approval/audit route exists | Full detect-to-decision-to-review workflow, uncertainty fallback and no chat-to-action bypass |
| Professional evidence-grounded event narrative | Events + Policy | Deployed / report and audit read verified | edb58921 READY; signed-in media-check report shows facts, uncertainty, baseline unknown, risk and persisted review history | Repeat post-release clip advancement after browser timeout; not AI anomaly/identity evidence |
| Chat action interface | Assistant + Policy | Partial / catalog required | Existing watch-request and gated physical-action offers | Explicit intent/action catalog, role/site/consent/capability checks, audited non-physical execution and actionable next conditions; physical confirmation remains separate |
| Fair coverage of every source | Edge + Events + Web | Not accepted / gaps identified | Current journal attempts sixteen, samples eight and reports eight explicit rule/detector/offline gaps without discarding failures | Verify temporal coverage, per-source UI and larger-set fairness; no-event is not proof that an interval was examined |
| Privacy-safe continuous learning and semantic zones | Edge + Privacy + Assistant | Not accepted | Editable camera names and local aggregate scaffolding exist; no verified per-zone baseline | User-controlled names/zones across chat/events/daily summaries; opt-in bounded warmup/adaptation, corrections, explainability, reset/forget/export/audit and sustained per-camera evidence |
| Push/email/WhatsApp/emergency delivery | Notifications + Operations | Blocked pending provisioning/authority | No provider delivery acceptance; no emergency calls placed | Verified accounts/consents/address/escalation, sandbox tests, explicit operational authority, budget enforcement |
| Site-preserving onboarding and source mapping | Web + Gateway | Partial | Source-scoped playback validation tested; RTSP probe fail-closed/timeout fixes pass isolated QA, not installed | Same-site edits/resume, real multi-channel vs single IP discovery, cross-device enrollment E2E |
| Mobile portrait/PWA/install identity | Web + Mobile | Partial | Existing implementation, no renewed visual acceptance | 360/390px, tablet/desktop and signed-in installed-app QA without hidden features |
| Production release, scale/security/cost | Release + Infrastructure | In progress | edb58921 READY production target; build/typecheck pass | Remaining scoped work + browser/audit evidence; 10,000-user load test and <= NIS 15/customer total provider budget |

## Recorded Release Evidence

The following release observations are historical. Use the latest scoped runtime
evidence above for current local counts; do not infer the current production
target or current E2E acceptance from an earlier READY deployment.

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
type migration `20260831010000` is required and has NOT been applied. Chat changes
are not deployed and do not enable actions, enrollment, consent or learning.

Responses use site-scoped stored events from at most the last 48 hours, retain
camera scope before the query limit, and disclose missing continuous coverage.
Safe relative links point only to implemented camera/event/rule/people/settings/
add-source screens using authorized IDs. No private addresses or credentials are
returned. Remaining acceptance: consented preferences/zone/baseline context,
explain-why/corrections/reset/forget controls, duplicate request handling, deployed
Hebrew/mobile E2E and the complete household journey. General live reasoning is
not enabled by this deterministic action catalog.

Current local chat QA passes: real route handler with synthetic scoped data,
role/source rejection, questions versus commands, ambiguous/conditional actions,
future/stale/offline evidence, consent, audit failures, inactive saved requests,
safe source links and no physical execution. Typecheck and existing event,
async-form and biometric-consent regression checks pass. Migration and production
deployment of this chat work are still separate gates. Chrome transport checks
pass (running, extension enabled, native host valid) but subsequent tab control
times out intermittently; read evidence above is valid, missing playback checks
remain missing rather than being replaced by a configuration test.

- The chat migration/deployment is explicitly approved, but execution is gated
  on authenticated database access: the installed Supabase CLI returns
  `login_required`, this worktree is not linked, and Chrome tab control times out.
  No credentials were requested/copied, and no SQL was run against an unverified
  project. The existing event release remains production.
- The first full chat build hit a sandbox `binding to a port: Operation not
  permitted` error in Turbopack instrumentation. The permission-corrected rerun
  passed compilation, TypeScript and generation of all 481 pages. Existing event,
  site preservation, privacy, consent and new chat regression checks pass. The
  migration preserves all existing audit types; live database integrity/RLS and
  signed-in chat E2E remain unverified until authenticated migration/deployment.
