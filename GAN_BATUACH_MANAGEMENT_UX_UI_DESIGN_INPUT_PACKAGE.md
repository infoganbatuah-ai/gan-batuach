# Gan Batuach Management UX/UI design input package

This package freezes the canonical Management screen set for the future visual phase. It contains no final mockups and starts no UX implementation.

## Authorities

- Route/surface inventory: `GAN_BATUACH_MANAGEMENT_CANONICAL_UX_SURFACE_MAP.md`
- Detailed design contract: `GAN_BATUACH_MANAGEMENT_FINAL_UX_UI_HANDOFF.md`
- Deduplicated debt and batching: `GAN_BATUACH_MANAGEMENT_FINAL_UX_UI_BACKLOG.md`
- Canonical navigation behavior: GB-M37 dashboard report
- Surviving/redirected routes: GB-M38 route map and legacy matrix

## Per-screen design record

Every future reference must state Role, canonical route, purpose, primary user goal/actions, authoritative source domains, permissions, required data, mobile/desktop importance, all required states, edge cases, related screens, current UX issue, P2/P3 debt and design priority. References must use actual Hebrew copy density and actual actions from the implemented route.

## Exclusions

Do not design redirects, QA-only routes, engineering/internal controls, deprecated compatibility pages or Digital Observer standalone screens. Management-facing camera/safety surfaces remain in scope only as consumers of the signed capability contract.

## Surface freeze result

GB-M40 introduced no required new core user-facing screen. Configuration, credential remediation, restore proof and release operations are runbook/internal concerns. Therefore `UX/UI SURFACE FREEZE: READY` even though Production release qualification remains separately gated.
