# PILOT FIX 1 - Feature Flag / Kill Switch Plan

Date: 2026-06-27

| Feature | Current implementation status | Desired switch | Affected roles | Safe default | Pilot requirement |
| --- | --- | --- | --- | --- | --- |
| Parent registration | app flow exists | env/admin toggle | parents | disabled for real pilot until legal/RLS | required |
| Parent enrollment | app flow exists | garden/pilot toggle | parents/managers | limited | required |
| Parent camera viewing | readiness/policy dependent | hard disable + per garden/camera policy | parents | disabled | required |
| Camera module | readiness exists | mode: disabled/readiness/internal/live | manager/admin/parent/inspector | readiness | required if camera visible |
| AI observer | readiness/shadow exists | mode: disabled/mock/shadow/live | admin/manager/inspector | shadow/disabled | required |
| AI parent summaries | should remain restricted | publish-approved toggle | parents | disabled | required |
| Payments | readiness/sandbox exists | mode: disabled/manual/sandbox/live | manager/admin | manual/sandbox | required |
| Notifications | in-app/provider readiness | channel toggles | all | in-app only | required |
| Digital Observer live features | readiness exists | product mode toggle | observer/admin | readiness | required |
| Document uploads | upload route exists | role/type toggle | parents/staff/manager/inspector | limited | required |
| Staff applications | app flow exists | garden toggle | staff/manager | controlled | required |
| Inspector access | assignment model exists | approval/assignment toggle | inspectors/admin | pending-only until assigned | required |

## Implementation Guidance

Do not implement new broad feature-flag architecture in this phase.

Next phases should verify whether existing provider modes, role states and admin controls are sufficient. If not, add minimal server-side flags for high-risk features.

kill_switch_status = plan_required_before_real_pilot
