# PILOT FIX 4 – Access Control Test Dataset Requirements

Date: 2026-07-03

## Dataset Goal

Create enough synthetic records to prove that every role can access only its own scope.

## Required Negative Tests

| Test ID | Required assertion |
|---|---|
| AC-001 | Parent A cannot see Child B |
| AC-002 | Parent A cannot list all Kindergarten A children |
| AC-003 | Parent B cannot see Child A |
| AC-004 | Staff unassigned cannot see child records |
| AC-005 | Staff assigned to Kindergarten A cannot see Kindergarten B |
| AC-006 | Manager A cannot see Kindergarten B |
| AC-007 | Manager B cannot see Kindergarten A |
| AC-008 | Inspector unassigned cannot see gardens |
| AC-009 | Inspector assigned to Kindergarten A cannot see Kindergarten B |
| AC-010 | Parent/staff/inspector cannot see payment/provider records |
| AC-011 | Parent cannot see raw AI events |
| AC-012 | User cannot access camera credentials |
| AC-013 | Demo user cannot access pilot tenant data |
| AC-014 | Pilot user cannot access unrelated demo/private data |

## Required Positive Tests

| Test ID | Required assertion |
|---|---|
| AC-101 | Parent A can see own profile and Child A |
| AC-102 | Manager A can see Kindergarten A operational records |
| AC-103 | Staff assigned to Kindergarten A can see only permitted work context |
| AC-104 | Inspector assigned to Kindergarten A can see assigned inspection context |
| AC-105 | Admin can see platform status without secret values |

## Required Objects

- two kindergartens
- two managers
- two parents
- two children
- one assigned staff member
- one unassigned staff member
- one assigned inspector
- one unassigned inspector
- one document per child
- one payment/subscription record for Kindergarten A
- one camera record for Kindergarten A with no raw credential exposure
- one raw AI event for Kindergarten A with parent denial check
- one Digital Observer site record outside Gan Batuach child scope

