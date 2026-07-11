# PILOT BLOCKER FIX 1 - Role-Flow A/B Test Closure

Date: 2026-07-12

## Status

Status: **manual_required**

No automated A/B role-flow suite was found or executed in this phase. The required closure path is a manual or scripted synthetic dataset test in staging/pilot Supabase.

## Required Pairs

- Parent A / Parent B
- Manager A / Manager B
- Staff unassigned / Staff assigned A
- Inspector unassigned / Inspector assigned A
- Kindergarten A / Kindergarten B

## Test Matrix

| Pair | Allowed access | Denied access | Route guard | UI visibility | API boundary | Data query boundary | Status |
|---|---|---|---|---|---|---|---|
| Parent A / Parent B | Parent A sees own profile, Child A, own enrollment/messages | Child B, Parent B, all children list, provider records, raw AI/camera | verify manually | verify manually | verify manually | verify manually | MANUAL_REQUIRED |
| Manager A / Manager B | Manager A sees Kindergarten A children/staff/enrollments/subscription | Kindergarten B, Child B, Manager B data, provider webhooks, camera credentials | verify manually | verify manually | verify manually | verify manually | MANUAL_REQUIRED |
| Staff unassigned / assigned A | Assigned A sees permitted work context only | unassigned sees no child/parent records; assigned A cannot see B | verify manually | verify manually | verify manually | verify manually | MANUAL_REQUIRED |
| Inspector unassigned / assigned A | Assigned A sees assigned inspection scope | unassigned sees no gardens; assigned A cannot see B | verify manually | verify manually | verify manually | verify manually | MANUAL_REQUIRED |
| Kindergarten A / B | Role users scoped to their kindergarten | cross-kindergarten reads/writes denied | verify manually | verify manually | verify manually | verify manually | MANUAL_REQUIRED |

## Minimum Evidence

For every test capture:

- test account
- route or API called
- expected result
- actual result
- screenshot or sanitized response
- PASS/FAIL
- tester and timestamp

## Closure Rule

If any cross-tenant or cross-role access succeeds, real pilot remains blocked.
