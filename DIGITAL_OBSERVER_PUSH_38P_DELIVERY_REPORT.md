# PUSH 38P — private release-delivery handoff (14 September 2026)

Status: **NOT READY FOR LIVE TRANSITION**. PUSH 38 remains NOT DONE; PR #28 remains draft/unmerged. No cloud publication, protected trust installation, OTA staging, or live runtime update occurred in this step. Pre-soak, v8, and PUSH 39 did not start.

## Verified constraint

The approved Supabase Production project is on Pro with its spend cap enabled. Its Storage dashboard currently reports a **50 MB global file-size limit** and explicitly says this limit is reduced by the spend cap. The three already-qualified archives are 146,778,302 B (Connector transition), 147,360,407 B (Connector remediation), and 135,759,651 B (Gateway remediation): **429,898,360 B total**. Each exceeds 50 MB. The existing Event-media bucket has a 10 MB per-object limit and is not an appropriate release bucket. A proposed 256 MiB release-bucket migration cannot be activated against the present global limit. The spend cap was not disabled or raised.

The release manifests still refer to non-deployable QA URLs and broad/unpublished release metadata; no signed manifest was reissued for private cloud object identities. Exact Home-device eligibility, remote publication, post-upload download/hash proof, and signed-URL expiration therefore remain unproven. The live protected root pin and root-signed registry remain absent. The owner was **not** asked to authenticate because the prerequisite cloud/trust prechecks did not pass.

## Draft implementation, not an operational release

The PUSH 38 worktree contains a fail-closed draft of a Supabase private-object path, exact-device INTERNAL_QA scope check, managed-device authenticated short-lived URL endpoint, and OTA-agent grant request. Local static checks passed: typecheck, scoped ESLint, migration-file check, private-object/exact-device QA, agent-core QA, and OTA-contract QA. These checks do **not** prove a deployable 136–147 MB object, remote schema application, live device authentication, or live trust.

The draft migration's 256 MiB per-bucket limit is **blocked** by the current global 50 MB setting. It must not be applied or merged unchanged. The direct single-object contract must be revised to fit the cap (for example, a signed, bounded multi-part artifact protocol with exact whole-archive verification) or an already-approved private storage service with sufficient object limit must be selected and separately reviewed. Raising/disabling the spend cap requires an explicit new decision; it is not authorized by PUSH 38P. No provider changes were made.

The draft download endpoint is disabled unless `OBSERVER_EDGE_PRIVATE_RELEASE_DELIVERY=enabled` is deliberately configured after that review; the default is fail-closed.

## Data, cost, and release boundary

Business need: three exact QA release archives for the two owned Home managed devices, not camera media. Owner: managed-edge release control plane. Sensitivity: release binaries and device eligibility metadata; private access required. Intended volume: 429,898,360 B stored plus at least that much egress for one complete Home download, before retries or QA verification. The candidate audit table would record one authorization per issued grant, not video or signed URL tokens; retention and cleanup must be reviewed before migration activation. The draft rate cap is four grants per device per five minutes. Actual remote storage, egress, request, and billing usage for this candidate are **zero from this task** because it was not activated. Provider usage and migration history must be rechecked at the approved release window.

## Handoff to nightly reconciliation

- Task/owner: PUSH 38P private release delivery; branch `codex/push-38-reliability-qualification`; worktree `/private/tmp/gan-batuach-push38`; PR #28 stays draft and is **not** eligible for merge.
- Draft paths: `services/video-gateway/edge-release-object.*`, `services/video-gateway/edge-update-agent.mjs`, `services/video-gateway/edge-update-contract.d.mts`, `app/api/video-gateway/edge-updates/{route.ts,download/route.ts}`, `supabase/migrations/20260913020000_edge_private_release_delivery.sql`, `scripts/qa/check-push38p-release-delivery.mjs`, this report.
- No release publication, database migration, Vercel deployment, trust installation, or live device change is authorized from this draft. Do not include PUSH 38 in the 15 September production batch merely because a local commit exists.
- Next action: separately review a cap-compatible private artifact transport and its manifest/publisher semantics; prove upload, download, private access, exact-device authorization, cost and security QA in isolation. Only after the cloud path and root-signed registry prechecks pass may the owner be shown the native macOS administrator prompt for the previously authorized protected public-root installation. The live runtime transition remains a separate later step.

Existing V7 evidence and unrelated worktree files were not modified or staged.
