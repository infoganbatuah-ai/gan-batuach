# PILOT QA 2 - Final Blocker Register

Date: 2026-08-06

## Critical / Hard Blocks

| ID | Blocker | Severity | Current status | Required action | Blocks |
|---|---|---|---|---|---|
| QA2-C1 | Live payments not approved | critical | Locked/off by Daniel | Keep disabled until explicit provider/legal approval | Live billing |
| QA2-C2 | Parent camera viewing not approved | critical | Locked/off by Daniel | Keep disabled until legal/RLS/token/audit/policy signoff | Parent camera viewing |
| QA2-C3 | Live AI/raw AI to parents not approved | critical | Locked/off by Daniel | Keep disabled; human review only after future approval | Live AI and parent AI |
| QA2-C4 | Production SMS/WhatsApp not approved | critical | Locked/off by Daniel | Keep disabled until explicit approval | Production external messages |

## High Blocks

| ID | Blocker | Severity | Current status | Required action | Blocks |
|---|---|---|---|---|---|
| QA2-H1 | Staff A/B RLS not provided | high | manual_required | Test staff unassigned and staff assigned A | Staff inclusion |
| QA2-H2 | Inspector A/B RLS not provided | high | manual_required | Test inspector unassigned and assigned A | Inspector inclusion |
| QA2-H3 | Support/incident owner missing | high | manual_required | Fill actual owner/contact before real users | Real-user pilot operation |
| QA2-H4 | External legal review missing | high | Daniel risk accepted only | Use temporary docs only for limited pilot; external review before scale | Broad/parent-child pilot |
| QA2-H5 | Visual review evidence missing | high for external demo/store | manual_required | Complete responsive visual checklist | External demo/store/full acceptance |
| QA2-H6 | Environment still transitioning | high | partial | Confirm demo/pilot data separation before real data | Real data entry |

## Reduced / Accepted For Limited Pilot

| ID | Item | Previous concern | Current status |
|---|---|---|---|
| QA2-R1 | No real children/parents currently | Real data may be mixed | Pass by Daniel: no real children/parents exist now. |
| QA2-R2 | Parent A/B isolation | RLS not signed | Pass by Daniel statement: Parent A cannot see Child B. |
| QA2-R3 | Manager A/B isolation | Tenant leakage risk | Pass by Daniel statement: Manager A cannot see Kindergarten B. |
| QA2-R4 | Legal docs | External review missing | Daniel risk accepted for limited pilot with temporary documents only. |

## Decision Impact

The system can move beyond internal demo only into **controlled limited pilot preparation**, but not into broad real pilot operation.

