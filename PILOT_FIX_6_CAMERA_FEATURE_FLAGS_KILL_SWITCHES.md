# PILOT FIX 6 - Camera Feature Flags / Kill Switches

Date: 2026-07-03

## Required Flags

| Flag | Safe default | Current status |
|---|---|---|
| `enable_camera_module` | readiness only | documented, unified server flag not confirmed |
| `enable_camera_gateway` | disabled unless env configured | env-gated |
| `enable_manager_camera_view` | disabled/readiness until signoff | policy-required |
| `enable_parent_camera_view` | disabled | required before any parent view |
| `enable_staff_camera_view` | disabled | camera row flag exists |
| `enable_inspector_camera_view` | disabled/policy-only | camera row policy exists |
| `enable_camera_recordings` | disabled | not approved |
| `enable_camera_audit_export` | disabled | not approved |
| `enable_digital_observer_camera_live` | separated/readiness | product-scoped flag required |

## Fix Applied

The legacy camera wizard now hard-locks parent viewing to false when saving camera sources.

## Remaining Requirement

A unified server-enforced feature flag model is still required before real pilot.

Status: **FEATURE_FLAG_REQUIRED_FOR_REAL_PILOT**
