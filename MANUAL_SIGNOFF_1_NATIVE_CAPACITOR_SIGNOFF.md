# MANUAL SIGNOFF 1 - Native / Capacitor Signoff

Date: 2026-07-12

## Scope Decision

Current status: **native_mobile_not_included_in_current_pilot_scope**

Capacitor is configured and native projects exist, but this signoff round does not include native/mobile pilot distribution unless Daniel explicitly adds it.

## If Native/Mobile Is Included Later

Verify:

- `npx cap sync` completed after latest CSS/layout changes: yes / no
- Android debug build checked: yes / no
- iOS Xcode readiness checked: yes / no
- Real device validation completed: yes / no
- Push readiness checked: yes / no
- No signing secrets committed: yes / no
- Android/iOS safe-area and keyboard behavior checked: yes / no
- Login/register checked on device: yes / no
- Role dashboards checked on device: yes / no

## Signoff Options

- native_mobile_not_included_in_current_pilot_scope
- native_signed_off_for_internal_test
- native_failed
- native_blocked
- cap_sync_required
- real_device_validation_required

## Notes

Do not block a web-only pilot on native/mobile. Do block native/mobile distribution until cap sync and real-device validation are complete.
