# UXV10 Parent primary reference closure — Development evidence

Status: **scoped Product correction merged; direct visual comparison remains `NEEDS_VISUAL_CORRECTION`; external owner acceptance pending.**

## Source and custody

- Source Development SHA: `a4f3661bfe0aa3beb39edce557bcc77e587eaeda`.
- Final Product screenshot SHA: `09967c565cbee49ed967a58fd88e901f3f9a2081` on `origin/integration/development`.
- Feature branch: `codex/ux-v10-parent-primary-reference-closure-20261106`.
- Scoped source commits: `223fd7f479d5c40146e5aa6fcddbe608c8c97eb7`, `a8b8e2b9a6e85e7c8a144ad8fa13f41ea23ecd6e`, `c9adc2b4efa8cd1eae96acac07a109b393c6b465`.
- Development merges: [#304](https://github.com/infoganbatuah-ai/gan-batuach/pull/304) `56a113567e98ccdaa2112060cb80768d7f79c389`, [#305](https://github.com/infoganbatuah-ai/gan-batuach/pull/305) `347e036552ffbac4856ce3b04cc504cbc4cf42b8`, [#307](https://github.com/infoganbatuah-ai/gan-batuach/pull/307) `09967c565cbee49ed967a58fd88e901f3f9a2081`.
- Exact Product diff from source to final: only `app/dashboard/parent/page.tsx` and `app/styles/ux-v9-parent-authorized-daily-hub.css`. No migrations, provider configuration, QA persona reset, Digital Observer core, `main`, or Production changes.

## Direct primary-screen comparison

Reference `GB_UX_REF_PARENT_FULL_PLATFORM.png` SHA256 `bf9ee24689f0c7dceeed1c0e894dff6a4357f471e7c1e1ea0bda00359328d3d4`. Primary Desktop crop SHA256 `681157bced360a00cc9976e3eaed69e4af7dfbc5943dcc34862c231070df7588`; primary Mobile crop SHA256 `c0c0a74eba6be79d0236f7008932f2d7505ad581decf0344ac20993ec71937ea`.

Actual implementation is `/dashboard/parent`, with single-Parent, multi-Child and selected-second-Child states. The actions for messages, documents and tuition now form their own Mobile rail below attendance and above camera context. Desktop sidebar is 240px; action panels are 180px high. The latest 390×844 capture has header y=0–108, child selector y=238–403, attendance y=425–630, actions y=637–751, and camera context starting y=758. The action rail ends before the fixed bottom navigation. These positions were inspected against the individual primary reference panels, rather than the whole collage.

**Final visual status: `NEEDS_VISUAL_CORRECTION`, not owner approval.** Visible deviations remain: current official brand mark versus the reference's historical house mark; additional canonical header utilities; QA children have no authorized personal photos, so initials replace reference photography; no verified attendance event exists today, so green arrival chips and times are not fabricated; camera imagery is illustrative and Live remains unavailable; Desktop action cards retain flatter status imagery than the reference. The 390×940 Mobile reference crop contains a phone frame, while actual Product evidence is an uncropped 390×844 viewport; overlays indicate structure, not pixel identity. The owner must review these differences externally.

## Fresh exact-head evidence

Private owner index: `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/uxv10-parent-candidate-09967c56/OWNER-REVIEW.md`. Six authenticated actual Product screenshots and geometry are indexed at `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/uxv10-parent-candidate-09967c56/manifest.json`, SHA256 `8e67b30bdbb9444a757ad47170a3b48440762d08b80611dfe6cbbbcafc45e0e9`. Direct side-by-side panels, 50% overlays and annotated Desktop/Mobile boards are indexed by `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/uxv10-parent-candidate-09967c56/boards/boards-manifest.json`, SHA256 `3f9ebff8a605ca1edca44c9117b9f88c57f2f7b835e555b00f64cb2d12428be4`. Earlier a4f, 56a and 347 captures remain preserved as before/after evidence; none are labeled final.

## Validation and remaining gates

PR #304 CI run `42249657687`, Management context run `42249657693`; PR #305 CI `42252893099`, Management `42252892550`; PR #307 CI `42255038570`, Management `42255038485`. Each exact-head PR passed all six Digital Observer CI gates, canonical quality, Management tenant context and Snyk. At final merged head, local guarded `DEVELOPMENT / INTEGRATION` startup reported `http://127.0.0.1:3000` and `LOCAL_SUPABASE`; schema/history drift passed 259/259 without Production access.

Authenticated synthetic single/multi Parent capture verified child/Garden context switching, foreign-child denial, file-ID scoped navigation, RTL, no horizontal overflow, no page errors or HTTP 500, visible touch controls, keyboard search and Mobile actions clear of bottom navigation. This is scoped QA, not cumulative 21-domain, live provider, formal accessibility certification, or invoice-backed all-in ₪15 qualification. New paid dependency/fixed commitment: ₪0. QA personas were read and preserved. Digital Observer core diff: 0.

Next: review the actual annotated boards with the owner/coordinator. Resolve only deviations that can be corrected without inventing personal photos, attendance, Live camera or weakening required utilities; re-capture any new exact merged head. Full Product visual acceptance, cumulative release gates and any `main`/Production release remain separate and unapproved. Do not begin RELEASE-GAP-01.
