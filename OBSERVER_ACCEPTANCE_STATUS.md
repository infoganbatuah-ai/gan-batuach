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

## Ownership and Acceptance Gates

Owner names below describe accountable workstreams, not external approvals.

| Requirement | Owner | Status | Current evidence | Next gate / blocker |
| --- | --- | --- | --- | --- |
| Local live, thumbnails, fullscreen and offline isolation | Gateway + Web | Partial | b150f891 production READY; nine streams advanced in pre-release samples, seven disconnected | Fresh post-release sustained Chrome media-time + fullscreen E2E; automation timed out |
| HTTPS cross-device relay | Gateway + Infrastructure | Blocked / implementation partial | Scoped relay fixture and fail-closed Realtime bootstrap QA pass; owned DNS zone verified | Cloudflare Worker creation denied Authentication error 10000; no Worker/SFU created; grant flow, publisher/subscriber, quota and cross-device media test still required |
| Event-only media, no new face capture | Edge + Privacy | Not accepted | Event-media regression QA passes, no live identity work done | Prove 48-hour deletion/download enforcement, no continuous archive and no new live/event face capture in code + production audit |
| Per-person biometric enrollment, consent, revocation and deletion | Identity + Privacy | Disabled pending proof | Consent/audit scaffolding; local health reports recognition false | Confirm migration/RLS; user-driven profile enrollment only, approved matching model and consent/revocation E2E |
| Resident / authorized visitor / unrecognized classification | Identity + Events | Not accepted | Required states defined above; no matching evidence | Tenant-safe profile lookup and uncertain/unknown fallback; never assert physical access denial |
| Entry/exit events and review notifications | Edge + Events | Not accepted | General event route exists, no current full workflow proof | Tested entry/exit model/rule with evidence, consented lookup, delivery and user review E2E |
| Reasoned journal, event thumbnail/clip, summaries and audit | Events + Web | Deployed / E2E blocked | 789dc86e READY; real route and server-rendered page fixtures pass tenant/source checks, expiry, review gates, reason/conclusion and truthful identity | Real event thumbnail/clip/review E2E; Chrome control times out; deletion worker and delivery still unverified |
| Edge / AI Shadow readiness and processing | Edge | Partial | Local runtime object/person/non-identifying face self-tests previously true | Fresh consent + runtime/model/hardware + sustained per-channel inference proof; audio/fire/distress/general learning unproven |
| Per-camera capability map and gated controls | Gateway + Web | Partial, physical execution off | Capability/action gate QA passes | Read-only per-channel evidence with freshness; adapter, immediate confirmation and audit before action test |
| Observer decisions, permissions and human fallback | Policy + Assistant | Partial | Approval/audit route exists | Full detect-to-decision-to-review workflow, uncertainty fallback and no chat-to-action bypass |
| Push/email/WhatsApp/emergency delivery | Notifications + Operations | Blocked pending provisioning/authority | No provider delivery acceptance; no emergency calls placed | Verified accounts/consents/address/escalation, sandbox tests, explicit operational authority, budget enforcement |
| Site-preserving onboarding and source mapping | Web + Gateway | Partial | Source-scoped playback validation tested | Same-site edits/resume, multi-channel recorder vs single IP camera, cross-device enrollment E2E |
| Mobile portrait/PWA/install identity | Web + Mobile | Partial | Existing implementation, no renewed visual acceptance | 360/390px, tablet/desktop and signed-in installed-app QA without hidden features |
| Production release, scale/security/cost | Release + Infrastructure | In progress | 789dc86e READY on both production domains; build/typecheck pass | Remaining scoped work + browser/audit evidence; 10,000-user load test and <= NIS 15/customer total provider budget |

## Current Release Evidence

- Latest scoped production release: `789dc86e2ac9ebeafe4e271fea10200cc5960690`,
  deployment `dpl_5urZrAEj29iKZYNHMTqKxZsYbD1V`, READY on 2026-08-31 for
  `gan-batuach.vercel.app` and `ganbatuach.com`. Applies event fix `f883e848` and
  form fix `0d72eaa5` onto the previously deployed `b150f891`; experimental Relay
  scaffolding was excluded. The release branch is clean and pushed.
- Public production health: HTTP 200, app and Supabase both OK. An unauthenticated
  event-media request returns 401. These checks do not prove private event media
  playback, review persistence or consent changes in a signed-in browser.
- Chrome discovery listed the signed-in camera tabs, but claim timed out after
  20 seconds. Official extension/native-host checks passed. An approved new Chrome
  window opened in the existing profile; the follow-up connection timed out too.
  No account/settings changes or browser-cookie extraction were attempted.
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

The event/form changes below are deployed in `789dc86e`, but browser acceptance
remains blocked. Local tests are not production media or consent evidence:

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

No Relay media was transmitted to an unverified host. No DVR credentials, browser
cookies, cloud service-role keys or private stream URLs are included in this ledger.
