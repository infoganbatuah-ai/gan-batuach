# GB-UXV9 Parent authorized daily hub — Development handoff

- Source: `origin/integration/development` at `462e2f58e31623e5586b85382c7dcd5afe6f7a0d` (verified through GitHub remote read).
- Branch: `codex/ux-v9-parent-authorized-daily-hub-20261106`.
- Scope: `/dashboard/parent`, its scoped style, parent child identity resolver, and related deterministic guards. No migration, provider activation, paid dependency, Digital Observer core, `main`, or Production change.
- Reference: `GB_UX_REF_PARENT_FULL_PLATFORM.png`, SHA-256 `bf9ee24689f0c7dceeed1c0e894dff6a4357f471e7c1e1ea0bda00359328d3d4`. The approved collage has one primary Parent Desktop dashboard and one primary Mobile dashboard; it does not show a separately labeled multi-child primary route.
- Baseline actual captures: private `Development/gan-batuach/uxv9-parent-baseline-462e2f58/manifest.json`, SHA-256 `9b936b8f8ce5ac05f82ff3d8b0a7394bb696013d58ed5d680b54b17e601a6c53`. The four full viewport captures are authenticated single/multi child Desktop 1440×1024 and Mobile 390×844 from the canonical Development Product at the source SHA. They are baseline evidence, **not final candidate evidence**.

## Corrected behavior and composition

- Visible authorized child cards and selected Garden context remain on the primary Parent route. Active enrollment is preferred over an older enrollment for the same permanent child file. Child selection updates the context immediately through the canonical route query and `selectAuthorizedChild`; an unknown child ID shows an unavailable state instead of unrelated child data.
- Permanent child file ID, Garden child ID, and enrollment ID are kept distinct. Enrollment requests and payment navigation use the permanent file ID; attendance, tuition periods, and documents use the Garden child ID. The dashboard derives today's attendance in the Israel timezone and displays authorized children together, as the reference does. It never derives attendance from cameras.
- The scoped Desktop composition gives the child selector and operational cards the reference's density; Mobile has a navy top area, compact visual child rail, attendance list, and above-fold links to messages, documents, and payments. The camera panel stays capability truthful, with no fabricated Live stream or AI.
- Failed data reads show an explicit unavailable notice. A tuition read failure cannot be presented as a zero balance.

## Verification state

- Passed locally: 20 deterministic authorized-child assertions; seven UX05 Parent focused tests; three tuition ledger tests; typecheck; lint baseline with zero regressions; migration ordering; release-contract safety; `git diff --check`.
- The domain gate passed the Parent-specific suites, then stopped at a missing tracked benchmark Markdown document omitted by this sparse feature worktree. A full checkout CI run is still required. The local security gate reached a pre-existing Digital Observer test that needs DiskManagement and loopback capabilities denied by this sandbox; it is **not a security PASS**.
- The local Turbopack build rejected this worktree's temporary `node_modules` symlink to the integration worktree. A clean locked-dependency CI build is required. No package or lockfile was changed.
- Post-merge authenticated candidate capture, visual comparison against the approved primary panels, child switching and role-boundary browser checks, exact-SHA CI gates, GitHub remote preservation, canonical ledger registration, and integration merge remain pending until recorded with their actual results. Do not infer owner approval from this source handoff.

## Preservation and next gate

Commit only this scoped branch, push it without a Preview/Production deployment, open a PR to `integration/development`, require all six exact-candidate CI gates, then merge through the integration owner. After merge, run the canonical Product from the integration worktree and capture fresh single/multi Desktop and Mobile screenshots from the exact merged SHA. Compare the actual primary Parent route with the approved reference panel; record material deviations honestly. Keep Production untouched.
