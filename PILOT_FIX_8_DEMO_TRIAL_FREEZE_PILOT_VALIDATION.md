# PILOT FIX 8 - Demo / Trial / Freeze Pilot Validation

Date: 2026-07-05

## Lifecycle States

| State | Pilot result |
|---|---|
| pending_admin_approval | Supported as role approval/onboarding state. |
| approved_pending_onboarding | Supported in manager flow readiness. |
| approved_pending_subscription | Supported in subscription access model. |
| demo_active | Supported by demo/subscription states where configured. |
| active | Supported but live provider proof required before billing is considered real. |
| payment_failed | Supported in subscription and child payment state messaging. |
| frozen | Supported in access evaluation. |
| suspended | Supported in access evaluation. |
| cancelled | Supported as manual/admin state. |

## Freeze / Suspend Behavior

The subscription access model restricts sensitive capabilities for frozen/suspended states, including child/staff management, parent leads, messages, camera playback, and finance updates.

## Scheduler Status

Demo expiration/freeze cron route exists, but production scheduler configuration was not verified locally.

Blocker: demo_freeze_scheduler_required_before_scale.

For a limited pilot, manual handling is acceptable if admin ownership and rollback are documented.
