# PILOT FIX 8 - Wrong Recipient / Cross-Role Notification Tests

Date: 2026-07-05

| Test | Expected result | Actual result | Status | Severity | Fix needed |
|---|---|---|---|---:|---|
| Parent A does not receive Child B event | blocked | not executed against real dataset | MANUAL_REQUIRED | high | Run with Pilot Fix 4/5 dataset. |
| Parent notification not sent to wrong parent | blocked | not executed against real dataset | MANUAL_REQUIRED | high | Verify recipient query and child-parent link. |
| Manager A does not receive Kindergarten B event | blocked | not executed against real dataset | MANUAL_REQUIRED | high | Verify kindergarten ownership filter. |
| Staff unassigned does not receive child/internal events | blocked | not executed against real dataset | MANUAL_REQUIRED | high | Verify staff assignment filter. |
| Inspector unassigned does not receive garden events | blocked | not executed against real dataset | MANUAL_REQUIRED | high | Verify inspector assignment filter. |
| Inspector assigned A does not receive Kindergarten B events | blocked | not executed against real dataset | MANUAL_REQUIRED | high | Verify assigned garden filter. |
| Admin-only provider alerts not sent to normal users | blocked | code intent is admin/in-app; real test required | MANUAL_REQUIRED | medium | Test admin provider alert routing. |
| AI raw candidate not sent to parents | blocked | covered by AI policy; live test required | MANUAL_REQUIRED | critical if fails | Keep AI parent summary disabled. |
| Camera internal status not sent to parents unless approved | blocked | covered by camera policy; live test required | MANUAL_REQUIRED | critical if fails | Keep parent camera disabled. |
| Payment provider errors not sent to parents | blocked | must remain admin/manager scoped | MANUAL_REQUIRED | high | Review provider alert recipients. |

## Result

No production external notifications are approved until these tests pass with the synthetic/pilot-safe dataset.
